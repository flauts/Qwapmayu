// =============================================================
// QawapMayu - Gateway GW01
// RAK3272S (P2P RX continuo) -> valida CRC -> descarta duplicados
// -> calcula PDR -> cola circular -> MQTT -> ThingsBoard
// =============================================================
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <time.h>
#include "trama.h"
#include "rak_at.h"

#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.example.h"
  #warning "Usando config.example.h: crea src/config.h con tus datos"
#endif

#define RAK_RX 16
#define RAK_TX 17
#define TAM_COLA 16

WiFiClient wifi;
PubSubClient tb(wifi);

// Cola circular de mensajes JSON pendientes
String cola[TAM_COLA];
uint8_t cab = 0, n_cola = 0;

void encolar(const String& s) {
  if (n_cola == TAM_COLA) { cab = (cab + 1) % TAM_COLA; n_cola--; Serial.println("Cola llena: se descarta el mas antiguo"); }
  cola[(cab + n_cola) % TAM_COLA] = s;
  n_cola++;
}

// Estadisticas del enlace
uint16_t boot_actual = 0;
uint32_t seq_primera = 0, seq_ultima = 0, recibidas = 0;
uint32_t err_crc = 0, duplicadas = 0, contador = 0;

uint64_t epoch_ms() {
  time_t ahora = time(nullptr);
  if (ahora < 1700000000) return 0;  // NTP aun no sincronizado
  struct timeval tv; gettimeofday(&tv, nullptr);
  return (uint64_t)tv.tv_sec * 1000ULL + tv.tv_usec / 1000;
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

  // Duplicados y PDR (se reinician si el nodo reinicio)
  if (t.boot_id != boot_actual) {
    boot_actual = t.boot_id; seq_primera = t.seq; seq_ultima = 0; recibidas = 0;
    Serial.printf("Nuevo boot del nodo: %u\n", boot_actual);
  }
  if (t.seq <= seq_ultima) { duplicadas++; return; }
  seq_ultima = t.seq;
  recibidas++;
  float pdr = 100.0f * recibidas / (t.seq - seq_primera + 1);

  Serial.printf("RX seq=%lu estado=%s tds=%u rssi=%d snr=%d PDR=%.1f%%\n",
                (unsigned long)t.seq, NOMBRE_ESTADO[t.estado % 5], t.tds_ppm, rssi, snr, pdr);

  contador++;
  bool importante = t.anomalias || t.estado != EST_ARMADO;
  if (!importante && (contador % PUBLICAR_CADA) != 0) return;

  char valores[400];
  snprintf(valores, sizeof(valores),
    "{\"ph\":%.2f,\"tds\":%u,\"it\":%.3f,\"temp\":%.2f,\"validez\":%u,\"anomalias\":%u,"
    "\"estado\":\"%s\",\"evento\":%u,\"seq\":%lu,\"boot\":%u,\"rssi\":%d,\"snr\":%d,\"pdr\":%.1f}",
    t.ph_x100 / 100.0, t.tds_ppm, t.it_x1000 / 1000.0, t.temp_x100 / 100.0,
    t.validez, t.anomalias, NOMBRE_ESTADO[t.estado % 5], t.evento_id,
    (unsigned long)t.seq, t.boot_id, rssi, snr, pdr);

  uint64_t ts = epoch_ms();
  if (ts) {
    char msg[480];
    snprintf(msg, sizeof(msg), "{\"ts\":%llu,\"values\":%s}", (unsigned long long)ts, valores);
    encolar(msg);
  } else {
    encolar(valores);  // ThingsBoard usara su propia hora de llegada
  }
}

void atender_rak() {
  static String linea;
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n') { linea.trim(); if (linea.length()) procesar_linea(linea); linea = ""; }
    else if (linea.length() < 600) linea += c;
  }
}

void atender_mqtt() {
  static uint32_t t_intento = 0;
  if (WiFi.status() != WL_CONNECTED) return;
  if (!tb.connected()) {
    if (millis() - t_intento < 5000) return;  // reintento sin bloquear
    t_intento = millis();
    Serial.print("Conectando a ThingsBoard... ");
    Serial.println(tb.connect("qawapmayu-gw01", TB_TOKEN, nullptr) ? "OK" : "fallo");
    return;
  }
  tb.loop();
  if (n_cola) {
    if (tb.publish("v1/devices/me/telemetry", cola[cab].c_str())) {
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
  tb.setServer(TB_HOST, TB_PORT);
  tb.setBufferSize(600);

  bool ok = rak_configurar_p2p(Serial2, true);
  Serial.println(ok ? "RAK escuchando en P2P" : "!! Fallo configurando el RAK");
  rak_eco = false;  // a partir de aqui solo se procesan eventos
}

void loop() {
  atender_rak();
  atender_mqtt();

  static uint32_t t_estado = 0;
  if (millis() - t_estado > 30000) {
    t_estado = millis();
    Serial.printf("[estado] WiFi=%s MQTT=%s cola=%u recibidas=%lu crc_err=%lu dup=%lu\n",
                  WiFi.status() == WL_CONNECTED ? "ok" : "no",
                  tb.connected() ? "ok" : "no", n_cola,
                  (unsigned long)recibidas, (unsigned long)err_crc, (unsigned long)duplicadas);
  }
}
