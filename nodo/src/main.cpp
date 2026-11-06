// =============================================================
// QawapMayu - Nodo QM01 (Sensores + Detector + FSM Bomba + LoRa P2P)
//
// Ciclo cada 5 s (sin deriva):
//   1. Si estado == EST_MUESTREANDO: no lee sensores ni usa el radio;
//      el loop se dedica exclusivamente a supervisar el corte de la bomba.
//   2. Lee DS18B20 (asincrono) y mediana de 31 muestras de pH y TDS.
//   3. Evalua DetectorAnomalia (3 ciclos consecutivos -> solicitud_captura).
//   4. Si hay solicitud_captura y estado == EST_ARMADO:
//      a) Persiste bloqueado=true, bombeando=true, evento=id en NVS.
//      b) Si NVS falla -> rele OFF y pasa a EST_FALLO.
//      c) Si NVS ok -> pasa a EST_MUESTREANDO, envia 1 trama con
//         EST_MUESTREANDO y recien despues enciende rele y fija t0_bomba.
//   5. Al cumplir T_CAPTURA_MS: rele OFF, guarda bombeando=false y
//      bloqueado=true en NVS, pasa a EST_CAPTURA_ESTIMADA, envia 1 trama
//      con EST_CAPTURA_ESTIMADA en el siguiente ciclo y pasa a EST_BLOQUEADO.
//
// Comandos por monitor serie (pruebas en mesa):
//   a -> activa / desactiva anomalia simulada de TDS
//   r -> solicita rearme manual (igual que pulsador en GPIO25)
//   x -> simula corte de seguridad durante el bombeo (-> EST_FALLO)
//   n -> simula fallo de escritura NVS en la proxima captura (-> EST_FALLO)
//   0 -> fija referencia TDS0 al valor actual de TDS
//   e -> imprime estado detallado
//   z -> borra la NVS de muestreo (reiniciar para empezar limpio)
// =============================================================
#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Preferences.h>
#include "trama.h"
#include "anomalia.h"
#include "rak_at.h"

// ---------- pines ----------
#define PIN_PH           35
#define PIN_TDS          34
#define PIN_TEMP         33
#define PIN_RELE         23
#define PIN_LED          2
#define PIN_REARME       25
#define RAK_RX           16
#define RAK_TX           17
#define RELE_ACTIVO_BAJO true

// ---------- parametros ----------
#define NODO_ID          1
#define N_MUESTRAS       31
#define MV_MIN_VALIDO    20
#define MV_MAX_VALIDO    3100

const uint32_t TA_MS                  = 5000;
const uint8_t  CICLOS_NORMALES_REARME = 3;
// T_CAPTURA_MS provisional (10 s); recalibrar como (100.0 / Q_cal) * 1000 con manguera de 6 mm
const uint32_t T_CAPTURA_MS           = 10000;
const uint32_t T_MAX_BOMBA_MS         = 2 * T_CAPTURA_MS;

// ---------- perifericos y estado ----------
OneWire oneWire(PIN_TEMP);
DallasTemperature ds(&oneWire);
Preferences nvs_nodo;
Preferences nvs_cal;
Preferences nvs_muestreo;

uint16_t boot_id  = 0;
uint32_t seq      = 0;
bool     radio_ok = false;

float ph_m = 0.0f, ph_b = 0.0f;
bool  ph_calibrado = false;
float ult_tds_ppm  = NAN;

DetectorAnomalia det;
LecturaSensores  ult_lec = {NAN, NAN, NAN, 0.0f, 0};

EstadoNodo estado           = EST_ARMADO;
uint16_t   evento_id        = 0;
uint32_t   t_ciclo          = 0;
uint32_t   t0_bomba         = 0;
bool       anomalia_sim     = false;
bool       corte_sim        = false;
bool       fallo_nvs_sim    = false;
bool       solicitud_rearme = false;

// ---------- control de rele ----------
void rele(bool encender) {
  bool nivel = encender ^ RELE_ACTIVO_BAJO;
  digitalWrite(PIN_RELE, nivel ? HIGH : LOW);
  digitalWrite(PIN_LED, encender ? HIGH : LOW);
}

void cambiar_estado(EstadoNodo nuevo, const char* motivo) {
  Serial.printf("[%8lu] %s -> %s (%s)\n", (unsigned long)millis(),
                NOMBRE_ESTADO[estado], NOMBRE_ESTADO[nuevo], motivo);
  estado = nuevo;
}

void imprimir_estado() {
  Serial.printf("[%8lu] estado=%s ev=%u val=0x%02X ano=0x%02X c_tds=%u c_ph=%u c_norm=%u tds0=%.0f sim_ano=%d sim_nvs=%d\n",
                (unsigned long)millis(), NOMBRE_ESTADO[estado], evento_id,
                ult_lec.validez, det.anomalias, det.c_tds, det.c_ph, det.c_normales,
                det.tds0, anomalia_sim ? 1 : 0, fallo_nvs_sim ? 1 : 0);
}

// ---------- lectura de sensores ----------
uint32_t mediana_mV(int pin, int n) {
  static uint16_t v[N_MUESTRAS];
  if (n > N_MUESTRAS) n = N_MUESTRAS;
  for (int i = 0; i < n; i++) {
    v[i] = analogReadMilliVolts(pin);
    delayMicroseconds(500);
  }
  for (int i = 1; i < n; i++) {
    uint16_t x = v[i];
    int j = i - 1;
    while (j >= 0 && v[j] > x) { v[j + 1] = v[j]; j--; }
    v[j + 1] = x;
  }
  return v[n / 2];
}

bool mv_valido(uint32_t mv) {
  return mv >= MV_MIN_VALIDO && mv <= MV_MAX_VALIDO;
}

float calcular_tds(float volt, float tempC) {
  float comp = volt / (1.0f + 0.02f * (tempC - 25.0f));
  return (133.42f * comp * comp * comp - 255.86f * comp * comp + 857.39f * comp) * 0.5f;
}

LecturaSensores leer_sensores() {
  // Lectura asincrona de la conversion lanzada en el ciclo previo (o en setup)
  float temp_raw = ds.getTempCByIndex(0);
  ds.requestTemperatures();  // dispara la siguiente conversion sin bloquear

  // Descarta desconexion (-127 C) y valor de power-on antes de convertir (85 C)
  bool temp_ok = (temp_raw != DEVICE_DISCONNECTED_C) && (temp_raw > -10.0f) && (temp_raw < 60.0f);
  float temp = temp_ok ? temp_raw : NAN;

  uint32_t ph_mv  = mediana_mV(PIN_PH, N_MUESTRAS);
  uint32_t tds_mv = mediana_mV(PIN_TDS, N_MUESTRAS);

  bool ph_ok     = mv_valido(ph_mv);
  bool tds_ok    = mv_valido(tds_mv) || tds_mv < MV_MIN_VALIDO;
  bool ph_valido = ph_calibrado && ph_ok;

  float ph  = ph_valido ? (ph_m * ph_mv + ph_b) : NAN;
  float tds = tds_ok    ? calcular_tds(tds_mv / 1000.0f, temp_ok ? temp : 25.0f) : NAN;
  ult_tds_ppm = tds;

  uint8_t validez = (ph_valido ? VAL_PH   : 0) |
                    (tds_ok    ? VAL_TDS  : 0) |
                    (temp_ok   ? VAL_TEMP : 0);

  if (anomalia_sim) {
    float base = det.tds0_fijado ? det.tds0 : 250.0f;
    if (!det.tds0_fijado) detector_fijar_tds0(&det, base);
    tds = base + UMBRAL_DELTA_TDS + 50.0f;
    validez |= VAL_TDS;
  }

  LecturaSensores lec = {
    .temp_c  = temp,
    .ph      = ph,
    .tds_ppm = tds,
    .it      = NAN,
    .validez = validez
  };
  return lec;
}

// ---------- envio de trama LoRa P2P ----------
void enviar_trama(const LecturaSensores* lec) {
  Trama t;
  memset(&t, 0, sizeof(t));
  t.version   = TRAMA_VERSION;
  t.nodo_id   = NODO_ID;
  t.boot_id   = boot_id;
  t.seq       = ++seq;
  t.t_ms      = millis();
  detector_llenar_trama(&t, lec, &det);
  t.estado    = (uint8_t)estado;
  t.evento_id = evento_id;
  trama_sellar(&t);

  char hex[2 * sizeof(Trama) + 1];
  a_hex((const uint8_t*)&t, sizeof(t), hex);

  Serial.printf("TX seq=%lu estado=%s ev=%u tds=%u val=0x%02X ano=0x%02X -> ",
                (unsigned long)t.seq, NOMBRE_ESTADO[estado], evento_id,
                t.tds_ppm, t.validez, t.anomalias);
  bool ok = rak_enviar_hex(Serial2, hex);
  Serial.println(ok ? "enviado" : "FALLO_RADIO (la FSM local sigue igual)");
}

// ---------- FSM del muestreador ----------
// Devuelve true si ya envio la trama de EST_MUESTREANDO y encendio la bomba.
bool iniciar_captura(const LecturaSensores* lec) {
  uint16_t nuevo_id = evento_id + 1;
  bool nvs_ok = false;
  if (fallo_nvs_sim) {
    fallo_nvs_sim = false;
    Serial.println("!! Simulando fallo de escritura en NVS");
  } else {
    nvs_ok = (nvs_muestreo.putBool("bloqueado", true) > 0) &&
             (nvs_muestreo.putBool("bombeando", true) > 0) &&
             (nvs_muestreo.putUShort("evento", nuevo_id) > 0);
  }

  if (!nvs_ok) {
    rele(false);
    cambiar_estado(EST_FALLO, "no se pudo guardar en NVS; no se activa la bomba");
    return false;
  }

  evento_id = nuevo_id;
  cambiar_estado(EST_MUESTREANDO, "anomalia persistente");

  // Unico envio en MUESTREANDO ANTES de encender el rele y fijar t0_bomba
  enviar_trama(lec);

  t0_bomba = millis();
  rele(true);
  return true;
}

void terminar_bombeo(EstadoNodo final, const char* motivo) {
  rele(false);
  bool nvs_ok = (nvs_muestreo.putBool("bombeando", false) > 0) &&
                (nvs_muestreo.putBool("bloqueado", true) > 0);

  if (!nvs_ok) {
    cambiar_estado(EST_FALLO, "error cerrando estado en NVS tras bombeo");
    return;
  }

  cambiar_estado(final, motivo);
  if (final == EST_CAPTURA_ESTIMADA) {
    Serial.printf("           Evento %u: bomba activa %lu ms (se enviara CAPTURA_ESTIMADA en el proximo ciclo)\n",
                  evento_id, (unsigned long)(millis() - t0_bomba));
  }
}

void supervisar_bomba(uint32_t ahora) {
  if (estado != EST_MUESTREANDO) {
    corte_sim = false;
    return;
  }
  if (corte_sim) {
    corte_sim = false;
    terminar_bombeo(EST_FALLO, "corte de seguridad");
  } else if (ahora - t0_bomba >= T_MAX_BOMBA_MS) {
    terminar_bombeo(EST_FALLO, "tiempo maximo de bomba excedido");
  } else if (ahora - t0_bomba >= T_CAPTURA_MS) {
    terminar_bombeo(EST_CAPTURA_ESTIMADA, "tiempo de captura cumplido");
  }
}

void atender_rearme() {
  if (!solicitud_rearme) return;
  solicitud_rearme = false;

  if (estado == EST_ARMADO) {
    Serial.println("Rearme ignorado: ya esta ARMADO");
    return;
  }
  if (estado == EST_MUESTREANDO || estado == EST_CAPTURA_ESTIMADA) {
    Serial.println("Rearme ignorado: captura en curso o pendiente de reportar");
    return;
  }
  if (det.c_normales < CICLOS_NORMALES_REARME) {
    Serial.printf("Rearme RECHAZADO: %u/%u ciclos normales\n",
                  det.c_normales, CICLOS_NORMALES_REARME);
    return;
  }

  bool nvs_ok = (nvs_muestreo.putBool("bloqueado", false) > 0) &&
                (nvs_muestreo.putBool("bombeando", false) > 0);
  if (!nvs_ok) {
    cambiar_estado(EST_FALLO, "error limpiando bloqueo en NVS durante rearme");
    return;
  }

  detector_reiniciar_contadores(&det);
  anomalia_sim = false;
  cambiar_estado(EST_ARMADO, "rearme manual confirmado");
}

// ---------- entradas (pulsador y serie) ----------
void leer_pulsador() {
  static bool crudo_ant = HIGH, estable = HIGH;
  static uint32_t t_cambio = 0;
  bool crudo = digitalRead(PIN_REARME);
  if (crudo != crudo_ant) {
    crudo_ant = crudo;
    t_cambio = millis();
  }
  if (millis() - t_cambio > 50 && crudo != estable) {
    estable = crudo;
    if (estable == LOW) {
      Serial.println("Pulsador de rearme detectado");
      solicitud_rearme = true;
    }
  }
}

void leer_serial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    switch (c) {
      case 'a':
        anomalia_sim = !anomalia_sim;
        Serial.printf(">> Anomalia simulada: %s\n", anomalia_sim ? "ON" : "OFF");
        break;
      case 'r':
        solicitud_rearme = true;
        break;
      case 'x':
        corte_sim = true;
        break;
      case 'n':
        fallo_nvs_sim = !fallo_nvs_sim;
        Serial.printf(">> Fallo NVS simulado en proxima captura: %s\n", fallo_nvs_sim ? "ON" : "OFF");
        break;
      case '0':
        if (isnan(ult_tds_ppm)) {
          Serial.println(">> Sin lectura valida de TDS para fijar TDS0.");
        } else {
          detector_fijar_tds0(&det, ult_tds_ppm);
          Serial.printf(">> TDS0 fijado en %.0f ppm (umbral > %.0f ppm)\n",
                        det.tds0, det.tds0 + UMBRAL_DELTA_TDS);
        }
        break;
      case 'e':
        imprimir_estado();
        break;
      case 'z':
        nvs_muestreo.clear();
        evento_id = 0;
        Serial.println(">> NVS 'muestreo' borrada (reinicia el ESP32 para arrancar limpio)");
        break;
      default:
        break;
    }
  }
}

void setup() {
  // 1) Seguridad fisica inmediata: rele apagado antes de cualquier otra cosa
  rele(false);
  pinMode(PIN_RELE, OUTPUT);
  pinMode(PIN_LED, OUTPUT);
  rele(false);
  pinMode(PIN_REARME, INPUT_PULLUP);

  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RAK_RX, RAK_TX);
  delay(300);
  Serial.println("\n=== QawapMayu - Nodo QM01 integrado ===");

  // 2) Sensores: ADC y primera conversion asincrona del DS18B20
  analogReadResolution(12);
  ds.begin();
  ds.setWaitForConversion(false);
  ds.requestTemperatures();

  // 3) NVS: contador de boot, calibracion de pH y estado del muestreador
  nvs_nodo.begin("nodo", false);
  boot_id = nvs_nodo.getUShort("boot", 0) + 1;
  nvs_nodo.putUShort("boot", boot_id);

  nvs_cal.begin("cal", true);
  ph_calibrado = nvs_cal.getBool("ph_ok", false);
  ph_m = nvs_cal.getFloat("ph_m", 0.0f);
  ph_b = nvs_cal.getFloat("ph_b", 0.0f);

  nvs_muestreo.begin("muestreo", false);
  bool bloqueado = nvs_muestreo.getBool("bloqueado", false);
  bool bombeando = nvs_muestreo.getBool("bombeando", false);
  evento_id = nvs_muestreo.getUShort("evento", 0);

  detector_iniciar(&det);

  estado = EST_ARMADO;
  if (bombeando) {
    nvs_muestreo.putBool("bombeando", false);
    nvs_muestreo.putBool("bloqueado", true);
    cambiar_estado(EST_FALLO, "reinicio detectado durante el bombeo: requiere revision");
  } else if (bloqueado) {
    cambiar_estado(EST_BLOQUEADO, "bloqueo previo en NVS");
  } else {
    Serial.println("Estado inicial -> ARMADO");
  }

  Serial.printf("boot_id=%u evento_id=%u ph_cal=%d DS18B20=%d\n",
                boot_id, evento_id, ph_calibrado ? 1 : 0, ds.getDeviceCount());

  // 4) Radio LoRa P2P
  radio_ok = rak_configurar_p2p(Serial2, false);
  Serial.println(radio_ok ? "RAK configurado en P2P (TX)" : "!! Fallo configurando el RAK (el nodo opera igual)");

  t_ciclo = millis();
}

void loop() {
  uint32_t ahora = millis();

  leer_serial();
  leer_pulsador();
  supervisar_bomba(ahora);
  atender_rearme();

  if (ahora - t_ciclo < TA_MS) return;
  t_ciclo += TA_MS;

  // Regla 3: mientras la bomba corre, no se muestrean sensores ni se usa el radio
  if (estado == EST_MUESTREANDO) {
    return;
  }

  ult_lec = leer_sensores();

  bool tds0_antes = det.tds0_fijado;
  detector_evaluar(&det, &ult_lec);
  if (!tds0_antes && det.tds0_fijado) {
    Serial.printf(">> [AUTO] TDS0 fijado en %.0f ppm (umbral > %.0f ppm)\n",
                  det.tds0, det.tds0 + UMBRAL_DELTA_TDS);
  }

  if (det.solicitud_captura && estado == EST_ARMADO) {
    if (iniciar_captura(&ult_lec)) {
      // iniciar_captura ya envio la trama con EST_MUESTREANDO y encendio la bomba
      return;
    }
  }

  enviar_trama(&ult_lec);

  // Regla 1: tras enviar la trama con EST_CAPTURA_ESTIMADA, pasar a EST_BLOQUEADO
  if (estado == EST_CAPTURA_ESTIMADA) {
    cambiar_estado(EST_BLOQUEADO, "captura reportada, esperando rearme");
  }
}
