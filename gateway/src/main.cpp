// =============================================================
// QawapMayu - Gateway GW01
// RAK3272S (P2P RX continuo) -> valida CRC -> descarta duplicados
// -> calcula PDR -> cola circular -> MQTT (topicos geograficos)
// =============================================================
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <stdarg.h>
#include <time.h>
#include "trama.h"
#include "rak_at.h"

#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.example.h"
  #warning "Usando config.example.h: crea src/config.h con tus datos"
#endif

#ifndef MQTT_HOST
  #define MQTT_HOST "192.168.x.x"
  #warning "MQTT_HOST no definido en config.h: usando valor por defecto"
#endif

#ifndef MQTT_PORT
  #define MQTT_PORT 1883
  #warning "MQTT_PORT no definido en config.h: usando 1883"
#endif

#define RAK_RX 16
#define RAK_TX 17
#define TAM_COLA 16
#define NODE_OFFLINE_MS 30000UL

struct InfoNodo {
  uint8_t id;
  const char* zona;
  const char* sitio;
  const char* nodo;
  const char* nombre;
  double lat;
  double lon;
  bool simulado;
};

static const InfoNodo NODOS[] = {
  {1, "barranco", "utec", "qm01", "Estación UTEC", -12.1352, -77.0221, false},
};
static constexpr size_t NUM_NODOS = sizeof(NODOS) / sizeof(NODOS[0]);

struct EstadoNodoTrack {
  bool     vista = false;
  bool     en_linea = false;
  uint32_t t_ultima_trama = 0;
  uint8_t  ultimo_estado = 0;
  uint8_t  ultimas_anomalias = 0;
  uint16_t ultimo_evento = 0;
  uint8_t  ultimo_evento_estado = 0;
  uint64_t ts_ultimo_estado = 0;
  uint64_t ts_ultimo_evento = 0;
  uint16_t boot_actual = 0;
  uint32_t seq_primera = 0;
  uint32_t seq_ultima = 0;
  uint32_t recibidas = 0;
  uint32_t contador = 0;
};

EstadoNodoTrack estados_nodos[NUM_NODOS];

struct MensajeCola {
  String topico;
  String payload;
  bool retained;
};

WiFiClient wifi;
PubSubClient tb(wifi);

// Cola circular de mensajes JSON pendientes
MensajeCola cola[TAM_COLA];
uint8_t cab = 0, n_cola = 0;

void encolar(const char* topico, const char* payload, bool retained) {
  if (n_cola == TAM_COLA) {
    cab = (cab + 1) % TAM_COLA;
    n_cola--;
    Serial.println("Cola llena: se descarta el mas antiguo");
  }
  uint8_t dst = (cab + n_cola) % TAM_COLA;
  cola[dst].topico = topico;
  cola[dst].payload = payload;
  cola[dst].retained = retained;
  n_cola++;
}

// Estadisticas globales del enlace y recuperacion por silencio del RAK
uint32_t recibidas = 0, err_crc = 0, duplicadas = 0;
uint32_t t_ultima_trama = 0, t_ultimo_reintento = 0;
uint8_t reintentos_rx = 0;

int buscar_nodo(uint8_t id) {
  for (size_t i = 0; i < NUM_NODOS; i++) {
    if (NODOS[i].id == id) return (int)i;
  }
  return -1;
}

uint64_t epoch_ms() {
  time_t ahora = time(nullptr);
  if (ahora < 1700000000) return 0;  // NTP aun no sincronizado
  struct timeval tv; gettimeofday(&tv, nullptr);
  return (uint64_t)tv.tv_sec * 1000ULL + tv.tv_usec / 1000;
}

void construir_topico(char* buf, size_t cap, const InfoNodo& nodo, const char* canal) {
  snprintf(buf, cap, "qawapmayu/v1/%s/%s/%s/%s", nodo.zona, nodo.sitio, nodo.nodo, canal);
}

void formatear_coord(char* buf, size_t cap, double val) {
  snprintf(buf, cap, "%.6f", val);
  char* dot = strchr(buf, '.');
  if (!dot) return;
  size_t n = strlen(buf);
  while (n > (size_t)(dot - buf + 2) && buf[n - 1] == '0') {
    buf[--n] = '\0';
  }
}

void append_fmt(char* buf, size_t cap, size_t& pos, const char* fmt, ...) {
  if (pos >= cap) return;
  va_list args;
  va_start(args, fmt);
  int n = vsnprintf(buf + pos, cap - pos, fmt, args);
  va_end(args);
  if (n > 0) {
    size_t rem = cap - pos;
    pos += ((size_t)n < rem) ? (size_t)n : (rem - 1);
  }
}

void publicar_meta(const InfoNodo& nodo) {
  char topico[96], lat_s[24], lon_s[24], payload[256];
  construir_topico(topico, sizeof(topico), nodo, "meta");
  formatear_coord(lat_s, sizeof(lat_s), nodo.lat);
  formatear_coord(lon_s, sizeof(lon_s), nodo.lon);
  snprintf(payload, sizeof(payload),
           "{\"nombre\":\"%s\",\"zona\":\"%s\",\"lat\":%s,\"lon\":%s,\"simulado\":%s}",
           nodo.nombre, nodo.zona, lat_s, lon_s, nodo.simulado ? "true" : "false");
  tb.publish(topico, payload, true);
}

void publicar_conexion_nodo(const InfoNodo& nodo, bool en_linea) {
  char topico[96];
  construir_topico(topico, sizeof(topico), nodo, "conexion");
  tb.publish(topico, en_linea ? "en_linea" : "fuera_de_linea", true);
}

void publicar_estado(const InfoNodo& nodo, uint8_t estado, uint8_t anomalias, uint64_t ts) {
  char topico[96], payload[128];
  construir_topico(topico, sizeof(topico), nodo, "estado");
  const char* nombre = NOMBRE_ESTADO[estado % 5];
  if (ts > 0) {
    snprintf(payload, sizeof(payload),
             "{\"estado\":\"%s\",\"anomalias\":%u,\"ts\":%llu}",
             nombre, anomalias, (unsigned long long)ts);
  } else {
    snprintf(payload, sizeof(payload),
             "{\"estado\":\"%s\",\"anomalias\":%u}",
             nombre, anomalias);
  }
  tb.publish(topico, payload, true);
}

void publicar_evento(const InfoNodo& nodo, uint16_t evento_id, uint8_t estado, uint64_t ts) {
  char topico[96], payload[128];
  construir_topico(topico, sizeof(topico), nodo, "evento");
  const char* nombre = NOMBRE_ESTADO[estado % 5];
  if (ts > 0) {
    snprintf(payload, sizeof(payload),
             "{\"evento\":%u,\"estado\":\"%s\",\"ts\":%llu}",
             evento_id, nombre, (unsigned long long)ts);
  } else {
    snprintf(payload, sizeof(payload),
             "{\"evento\":%u,\"estado\":\"%s\"}",
             evento_id, nombre);
  }
  tb.publish(topico, payload, true);
}

void publicar_enlace(const InfoNodo& nodo, int rssi, int snr, float pdr, uint32_t seq, uint16_t boot) {
  char topico[96], payload[128];
  construir_topico(topico, sizeof(topico), nodo, "enlace");
  snprintf(payload, sizeof(payload),
           "{\"rssi\":%d,\"snr\":%d,\"pdr\":%.1f,\"seq\":%lu,\"boot\":%u}",
           rssi, snr, pdr, (unsigned long)seq, boot);
  tb.publish(topico, payload, true);
}

void publicar_al_conectar() {
  tb.publish("qawapmayu/v1/gw/gw01/conexion", "en_linea", true);
  for (size_t i = 0; i < NUM_NODOS; i++) {
    publicar_meta(NODOS[i]);
    const EstadoNodoTrack& est = estados_nodos[i];
    if (!est.vista) continue;
    publicar_conexion_nodo(NODOS[i], est.en_linea);
    publicar_estado(NODOS[i], est.ultimo_estado, est.ultimas_anomalias, est.ts_ultimo_estado);
    if (est.ultimo_evento > 0) {
      publicar_evento(NODOS[i], est.ultimo_evento, est.ultimo_evento_estado, est.ts_ultimo_evento);
    }
  }
}

void procesar_linea(String linea) {
  // Formato esperado (RUI3): +EVT:RXP2P:<RSSI>:<SNR>:<payload_hex>
  // Si su version de RUI3 imprime otro formato, ajustar aqui.
  if (!linea.startsWith("+EVT:RXP2P")) return;
  int rssi = 0, snr = 0;
  sscanf(linea.c_str() + 11, "%d:%d", &rssi, &snr);
  String hex = linea.substring(linea.lastIndexOf(':') + 1);
  hex.trim();

  Trama t;
  if (!de_hex(hex.c_str(), (uint8_t*)&t, sizeof(t)) || !trama_valida(&t)) {
    err_crc++;
    Serial.printf("Trama invalida (largo %u, errores=%lu): %s\n", hex.length(), (unsigned long)err_crc, linea.c_str());
    return;
  }

  t_ultima_trama = millis();
  reintentos_rx = 0;

  int idx = buscar_nodo(t.nodo_id);
  if (idx < 0) {
    Serial.printf("Nodo desconocido id=%u, trama descartada\n", (unsigned)t.nodo_id);
    return;
  }
  const InfoNodo& info = NODOS[idx];
  EstadoNodoTrack& est = estados_nodos[idx];

  // Duplicados y PDR (se reinician si el nodo reinicio)
  if (!est.vista || t.boot_id != est.boot_actual) {
    est.boot_actual = t.boot_id;
    est.seq_primera = t.seq;
    est.seq_ultima = 0;
    est.recibidas = 0;
    Serial.printf("Nuevo boot nodo %s (id=%u): %u\n", info.nodo, (unsigned)info.id, est.boot_actual);
  }
  if (t.seq <= est.seq_ultima) { duplicadas++; return; }
  est.seq_ultima = t.seq;
  est.recibidas++;
  recibidas++;
  float pdr = 100.0f * est.recibidas / (t.seq - est.seq_primera + 1);

  Serial.printf("RX [%s] seq=%lu estado=%s tds=%u rssi=%d snr=%d PDR=%.1f%%\n",
                info.nodo, (unsigned long)t.seq, NOMBRE_ESTADO[t.estado % 5],
                t.tds_ppm, rssi, snr, pdr);

  uint64_t ts = epoch_ms();
  bool primera_vez = !est.vista;
  bool recien_en_linea = !est.en_linea;
  est.vista = true;
  est.en_linea = true;
  est.t_ultima_trama = millis();

  if (recien_en_linea && tb.connected()) {
    publicar_conexion_nodo(info, true);
  }

  if (primera_vez || t.estado != est.ultimo_estado || t.anomalias != est.ultimas_anomalias) {
    est.ultimo_estado = t.estado;
    est.ultimas_anomalias = t.anomalias;
    est.ts_ultimo_estado = ts;
    if (tb.connected()) {
      publicar_estado(info, t.estado, t.anomalias, ts);
    }
  }

  if (t.evento_id > 0 && t.evento_id != est.ultimo_evento) {
    est.ultimo_evento = t.evento_id;
    est.ultimo_evento_estado = t.estado;
    est.ts_ultimo_evento = ts;
    if (tb.connected()) {
      publicar_evento(info, t.evento_id, t.estado, ts);
    }
  }

  if (tb.connected()) {
    publicar_enlace(info, rssi, snr, pdr, t.seq, t.boot_id);
  }

  est.contador++;
  bool importante = t.anomalias || t.estado != EST_ARMADO;
  if (!importante && (est.contador % PUBLICAR_CADA) != 0) return;

  char topico[96];
  construir_topico(topico, sizeof(topico), info, "telemetria");

  char payload[384];
  size_t pos = 0;
  append_fmt(payload, sizeof(payload), pos, "{");
  if (ts > 0) {
    append_fmt(payload, sizeof(payload), pos, "\"ts\":%llu,", (unsigned long long)ts);
  }
  if ((t.validez & VAL_PH) != 0) {
    append_fmt(payload, sizeof(payload), pos, "\"ph\":%.2f,", t.ph_x100 / 100.0);
  }
  if ((t.validez & VAL_TDS) != 0) {
    append_fmt(payload, sizeof(payload), pos, "\"tds\":%u,", t.tds_ppm);
  }
  if ((t.validez & VAL_TURB) != 0) {
    append_fmt(payload, sizeof(payload), pos, "\"it\":%.3f,", t.it_x1000 / 1000.0);
  }
  if ((t.validez & VAL_TEMP) != 0) {
    append_fmt(payload, sizeof(payload), pos, "\"temp\":%.2f,", t.temp_x100 / 100.0);
  }
  append_fmt(payload, sizeof(payload), pos,
             "\"validez\":%u,\"anomalias\":%u,"
             "\"estado\":\"%s\",\"evento\":%u,\"seq\":%lu,\"boot\":%u,\"rssi\":%d,\"snr\":%d,\"pdr\":%.1f}",
             t.validez, t.anomalias, NOMBRE_ESTADO[t.estado % 5], t.evento_id,
             (unsigned long)t.seq, t.boot_id, rssi, snr, pdr);

  encolar(topico, payload, true);
}

void atender_rak() {
  static String linea;
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n') { linea.trim(); if (linea.length()) procesar_linea(linea); linea = ""; }
    else if (linea.length() < 600) linea += c;
  }
}

void atender_wifi() {
  static uint32_t t_wifi = 0;
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - t_wifi < 10000) return;
  t_wifi = millis();
  Serial.println("[wifi] Intentando reconectar WiFi...");
  WiFi.reconnect();
}

void atender_mqtt() {
  atender_wifi();
  static uint32_t t_intento = 0;
  if (WiFi.status() != WL_CONNECTED) return;
  if (!tb.connected()) {
    if (millis() - t_intento < 5000) return;  // reintento sin bloquear
    t_intento = millis();
    Serial.print("Conectando a MQTT... ");
    bool ok = tb.connect("qawapmayu-gw01",
                         "qawapmayu/v1/gw/gw01/conexion", 1, true, "fuera_de_linea");
    Serial.println(ok ? "OK" : "fallo");
    if (ok) {
      publicar_al_conectar();
    }
    return;
  }
  tb.loop();
  if (n_cola) {
    if (tb.publish(cola[cab].topico.c_str(), cola[cab].payload.c_str(), cola[cab].retained)) {
      cab = (cab + 1) % TAM_COLA; n_cola--;
    }
  }
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RAK_RX, RAK_TX);
  delay(500);
  Serial.println("\n=== QawapMayu gateway GW01 ===");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);   // no bloquea; se revisa en loop
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  tb.setServer(MQTT_HOST, MQTT_PORT);
  tb.setKeepAlive(30);
  tb.setBufferSize(768);

  bool ok = rak_configurar_p2p(Serial2, true);
  Serial.println(ok ? "RAK escuchando en P2P" : "!! Fallo configurando el RAK");
  rak_eco = false;  // a partir de aqui solo se procesan eventos
  t_ultima_trama = millis();
}

void loop() {
#ifdef PRUEBA_SORDERA
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == 's') {
      bool ok = rak_cmd(Serial2, "AT+PRECV=0");
      Serial.printf("[PRUEBA_SORDERA] AT+PRECV=0 -> %s\n", ok ? "OK" : "error");
    }
  }
#endif

  atender_rak();
  atender_mqtt();

  uint32_t ahora = millis();
  for (size_t i = 0; i < NUM_NODOS; i++) {
    if (estados_nodos[i].vista && estados_nodos[i].en_linea &&
        (ahora - estados_nodos[i].t_ultima_trama > NODE_OFFLINE_MS)) {
      estados_nodos[i].en_linea = false;
      if (tb.connected()) {
        publicar_conexion_nodo(NODOS[i], false);
      }
    }
  }

  if (ahora - t_ultima_trama > 60000UL &&
      (reintentos_rx == 0 || (ahora - t_ultimo_reintento >= 60000UL))) {
    if (reintentos_rx >= 3) {
      Serial.println("[SORDERA] 3 reintentos sin recuperar RX, reiniciando ESP32...");
      delay(100);
      ESP.restart();
    } else {
      reintentos_rx++;
      t_ultimo_reintento = ahora;
      Serial.printf("[SORDERA] sin tramas hace %lu s, rearmando RX (intento %u)\n",
                    (unsigned long)((ahora - t_ultima_trama) / 1000UL),
                    (unsigned)reintentos_rx);
      if (tb.connected()) tb.loop();
      bool ok = rak_configurar_p2p(Serial2, true);
      Serial.println(ok ? "[SORDERA] RX rearmado OK" : "[SORDERA] !! Fallo rearmando RX");
    }
  }

  static uint32_t t_estado = 0;
  if (millis() - t_estado > 30000) {
    t_estado = millis();
    Serial.printf("[estado] WiFi=%s MQTT=%s cola=%u recibidas=%lu crc_err=%lu dup=%lu reintentos_rx=%u\n",
                  WiFi.status() == WL_CONNECTED ? "ok" : "no",
                  tb.connected() ? "ok" : "no", n_cola,
                  (unsigned long)recibidas, (unsigned long)err_crc, (unsigned long)duplicadas,
                  (unsigned)reintentos_rx);
  }
}
