// =============================================================
// QawapMayu - Herramienta de sensores + decision de anomalia (Paso 1 y 2)
//
// Imprime una linea CSV por segundo:
//   ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,turb_mV,it,validez,tds0_ppm,vt0_mV,anomalias,c_ph,c_tds,c_turb,solicitud_captura
// (el monitor guarda automaticamente pruebas/sensores_<fecha_hora>.csv y .log)
//
// Comandos (escribir la letra o comando + Enter):
//   ph <val> -> captura el voltaje actual para el pH medido con la tira (ej. ph 3.0)
//   c -> calcula la recta pH = m*mV + b con los puntos capturados
//   s -> guarda m y b en la NVS de ESTE ESP32
//   b -> borra la calibracion guardada
//   0 -> fija la referencia base TDS0 al valor actual de tds_ppm
//   t -> captura y guarda en NVS la referencia VT0 (agua clara) del TS-300B
//   r -> reinicia los contadores de anomalia y baja solicitud_captura
//   p -> pausa / reanuda la impresion CSV
//   h -> ayuda
//
// IMPORTANTE: usar el ESP32 que sera el NODO, porque la calibracion
// queda guardada en su memoria NVS.
// =============================================================
#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Preferences.h>
#include "anomalia.h"
#include "hardware.h"

#define PIN_PH      32   // ADC1
#define PIN_TDS     34   // ADC1
#define PIN_TEMP    33   // 1-Wire (pull-up 4.7k a 3.3V)
#define PIN_LED_SIM  2   // LED integrado del ESP32 (bomba simulada para Paso 2)

#define N_MUESTRAS 31        // lecturas rapidas por canal; se usa la mediana

OneWire oneWire(PIN_TEMP);
DallasTemperature ds(&oneWire);
Preferences nvs;

// Calibracion de pH y Turbidez (TS-300B)
float ph_m = 0, ph_b = 0;
bool  ph_calibrado = false;
float vt0_mv = NAN;
bool  vt0_calibrado = false;

#define MAX_PUNTOS_PH 5
float cap_ph[MAX_PUNTOS_PH];
float cap_mV[MAX_PUNTOS_PH];
int   n_puntos_ph = 0;

bool  imprimir = true;

// Detector de anomalia persistente
DetectorAnomalia det;
float ult_tds_ppm = NAN;
bool  solicitud_prev = false;

// ---------- utilidades ----------
uint32_t mediana_mV(int pin, int n) {
  static uint16_t v[201];
  if (n > 201) n = 201;
  for (int i = 0; i < n; i++) {
    v[i] = analogReadMilliVolts(pin);  // usa la calibracion de fabrica del ADC
    delayMicroseconds(500);
  }
  for (int i = 1; i < n; i++) {        // ordenamiento por insercion
    uint16_t x = v[i];
    int j = i - 1;
    while (j >= 0 && v[j] > x) { v[j + 1] = v[j]; j--; }
    v[j + 1] = x;
  }
  return v[n / 2];
}

bool ph_mv_valido(uint32_t mv)   { return mv >= PH_MIN_VALIDO_MV && mv <= PH_MAX_VALIDO_MV; }
bool tds_mv_valido(uint32_t mv)  { return mv <= TDS_MAX_VALIDO_MV; }
bool turb_mv_valido(uint32_t mv) { return mv >= TURB_MIN_CONECTADO_MV && mv <= TURB_MAX_VALIDO_MV; }

// Formula del fabricante (Keyestudio/DFRobot) con compensacion termica
float calcular_tds(float volt, float tempC) {
  float comp = volt / (1.0f + 0.02f * (tempC - 25.0f));
  return (133.42f * comp * comp * comp - 255.86f * comp * comp + 857.39f * comp) * 0.5f;
}

void ayuda() {
  Serial.println();
  Serial.println("--- Comandos: ph <val> [mV] (ej. ph 3 414) | setph <m> <b> | c calcular | s guardar | b borrar | 0 fijar TDS0 | t fijar VT0 | r reiniciar | p pausa | h ayuda ---");
  if (ph_calibrado) Serial.printf("Calibracion actual: pH = %.6f * mV + %.4f\n", ph_m, ph_b);
  else Serial.println("pH SIN calibrar (la columna pH sale como nan y VAL_PH = 0)");
  if (det.tds0_fijado) Serial.printf("Referencia TDS0 actual: %.0f ppm (umbral disparo > %.0f ppm)\n", det.tds0, det.tds0 + UMBRAL_DELTA_TDS);
  else Serial.printf("Referencia TDS0 pendiente (se auto-fija al superar %.0f ppm o con tecla '0')\n", TDS_MIN_AGUA_PPM);
  if (vt0_calibrado) Serial.printf("Referencia VT0 (TS-300B) actual: %.0f mV (umbral IT > %.3f)\n", vt0_mv, UMBRAL_IT_MAX);
  else Serial.printf("Referencia VT0 (TS-300B) pendiente (se auto-fija al superar %d mV o con tecla 't')\n", TURB_MIN_AGUA_CLARA_MV);
  Serial.println("ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,turb_mV,it,validez,tds0_ppm,vt0_mV,anomalias,c_ph,c_tds,c_turb,solicitud_captura");
}

void capturar_punto(float ph_ref, float mv_manual = -1.0f) {
  uint32_t mv = (mv_manual >= 0.0f) ? (uint32_t)mv_manual : mediana_mV(PIN_PH, 201);
  int idx = -1;
  for (int i = 0; i < n_puntos_ph; i++) {
    if (fabsf(cap_ph[i] - ph_ref) < 0.05f) {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    if (n_puntos_ph >= MAX_PUNTOS_PH) {
      n_puntos_ph = 0;
    }
    idx = n_puntos_ph++;
  }
  cap_mV[idx] = (float)mv;
  cap_ph[idx] = ph_ref;
  Serial.printf(">> Punto pH %.2f capturado: %lu mV%s (%d punto%s)\n",
                ph_ref, (unsigned long)mv,
                ph_mv_valido(mv) ? "" : "  (!! fuera de rango del ADC, revisar divisor/offset)",
                n_puntos_ph, n_puntos_ph > 1 ? "s" : "");
}

void calcular() {
  if (n_puntos_ph < 2) {
    Serial.println(">> Necesito al menos 2 puntos capturados (usa 'ph <valor>').");
    return;
  }
  double n = n_puntos_ph, sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (int i = 0; i < n_puntos_ph; i++) {
    double x = cap_mV[i], y = cap_ph[i];
    sx += x; sy += y; sxy += x * y; sxx += x * x;
  }
  double den = n * sxx - sx * sx;
  if (den == 0) {
    Serial.println(">> Los voltajes son iguales: revisar conexion de la sonda.");
    return;
  }
  ph_m = (float)((n * sxy - sx * sy) / den);
  ph_b = (float)((sy - ph_m * sx) / n);
  ph_calibrado = true;
  Serial.printf(">> pH = %.6f * mV + %.4f   (%d puntos)\n", ph_m, ph_b, n_puntos_ph);
  Serial.printf(">> Sensibilidad: %.1f mV por unidad de pH\n", 1.0 / ph_m);
  for (int i = 0; i < n_puntos_ph; i++) {
    float pred = ph_m * cap_mV[i] + ph_b;
    Serial.printf("   punto %.2f -> modelo %.2f (error %+.2f)\n", cap_ph[i], pred, pred - cap_ph[i]);
  }
  Serial.println(">> Anoten estos valores en docs/calibracion.md y usen 's' para guardar.");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(PIN_LED_SIM, OUTPUT);
  digitalWrite(PIN_LED_SIM, LOW);
  analogReadResolution(12);
  ds.begin();
  nvs.begin("cal", false);
  ph_calibrado = nvs.getBool("ph_ok", false);
  ph_m = nvs.getFloat("ph_m", 0);
  ph_b = nvs.getFloat("ph_b", 0);
  vt0_calibrado = nvs.getBool("vt0_ok", false);
  vt0_mv = nvs.getFloat("vt0_mv", NAN);
  if (vt0_calibrado && (isnan(vt0_mv) || vt0_mv < TURB_MIN_AGUA_CLARA_MV || vt0_mv > TURB_MAX_VALIDO_MV)) {
    vt0_calibrado = false;
  }
  detector_iniciar(&det);
  Serial.printf("\nQawapMayu - sensores. DS18B20 encontrados: %d\n", ds.getDeviceCount());
  ayuda();
}

void loop() {
  static String cmd = "";
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') {
      continue;
    }
    if (c == '\n') {
      cmd.trim();
      if (cmd.length() > 0) {
        if (cmd.startsWith("ph ") || cmd.startsWith("PH ")) {
          String arg = cmd.substring(3);
          arg.trim();
          int sep = arg.indexOf(' ');
          if (sep > 0) {
            float val = arg.substring(0, sep).toFloat();
            float mv = arg.substring(sep + 1).toFloat();
            if (val >= 0.0f && val <= 14.0f && mv > 0.0f) {
              capturar_punto(val, mv);
            } else {
              Serial.println(">> Formato: ph <valor> [mV_manual]");
            }
          } else {
            float val = arg.toFloat();
            if (arg.length() > 0 && val >= 0.0f && val <= 14.0f && (val > 0.0f || arg[0] == '0')) {
              capturar_punto(val);
            } else {
              Serial.printf(">> Valor de pH invalido: '%s' (debe estar entre 0 y 14)\n", arg.c_str());
            }
          }
        } else if (cmd.startsWith("setph ") || cmd.startsWith("SETPH ")) {
          String arg = cmd.substring(6);
          arg.trim();
          int sep = arg.indexOf(' ');
          if (sep > 0) {
            ph_m = arg.substring(0, sep).toFloat();
            ph_b = arg.substring(sep + 1).toFloat();
            ph_calibrado = true;
            nvs.putFloat("ph_m", ph_m);
            nvs.putFloat("ph_b", ph_b);
            nvs.putBool("ph_ok", true);
            Serial.printf(">> Calibracion fijada directamente en NVS: pH = %.6f * mV + %.4f\n", ph_m, ph_b);
          } else {
            Serial.println(">> Uso: setph <m> <b>");
          }
        } else if (cmd == "c" || cmd == "C") {
          calcular();
        } else if (cmd == "s" || cmd == "S") {
          if (!ph_calibrado) {
            Serial.println(">> Primero calcula con 'c'.");
          } else {
            nvs.putFloat("ph_m", ph_m);
            nvs.putFloat("ph_b", ph_b);
            nvs.putBool("ph_ok", true);
            Serial.println(">> Calibracion guardada en NVS.");
          }
        } else if (cmd == "b" || cmd == "B") {
          nvs.clear();
          n_puntos_ph = 0;
          ph_calibrado = false;
          vt0_calibrado = false;
          vt0_mv = NAN;
          Serial.println(">> Calibracion borrada.");
        } else if (cmd == "t" || cmd == "T") {
          uint32_t mv = mediana_mV(PIN_TURB, 201);
          if (mv < TURB_MIN_AGUA_CLARA_MV || mv > TURB_MAX_VALIDO_MV) {
            Serial.printf(">> Lectura TS-300B fuera de rango de agua clara (%lu mV, esperado %d-%d mV); revisar conexion y divisor 10k/20k en GPIO35.\n",
                          (unsigned long)mv, TURB_MIN_AGUA_CLARA_MV, TURB_MAX_VALIDO_MV);
          } else {
            vt0_mv = (float)mv;
            vt0_calibrado = true;
            nvs.putFloat("vt0_mv", vt0_mv);
            nvs.putBool("vt0_ok", true);
            det.c_turb = 0;
            det.anomalias &= (uint8_t)~ANO_TURB;
            Serial.printf(">> Referencia VT0 (agua clara) guardada en NVS: %.0f mV (umbral IT > %.3f)\n",
                          vt0_mv, UMBRAL_IT_MAX);
          }
        } else if (cmd == "0") {
          if (isnan(ult_tds_ppm)) {
            Serial.println(">> Aun no hay lectura valida de TDS para fijar TDS0.");
          } else {
            detector_fijar_tds0(&det, ult_tds_ppm);
            solicitud_prev = det.solicitud_captura;
            digitalWrite(PIN_LED_SIM, det.solicitud_captura ? HIGH : LOW);
            Serial.printf(">> TDS0 fijado manualmente en %.0f ppm (umbral disparo > %.0f ppm).\n",
                          det.tds0, det.tds0 + UMBRAL_DELTA_TDS);
          }
        } else if (cmd == "r" || cmd == "R") {
          detector_reiniciar_contadores(&det);
          solicitud_prev = false;
          digitalWrite(PIN_LED_SIM, LOW);
          Serial.println(">> Contadores de anomalia y solicitud_captura reiniciados.");
        } else if (cmd == "p" || cmd == "P") {
          imprimir = !imprimir;
        } else if (cmd == "h" || cmd == "H") {
          ayuda();
        } else {
          Serial.printf(">> Comando no reconocido: '%s' (usa 'h' para ayuda)\n", cmd.c_str());
        }
      }
      cmd = "";
    } else {
      if (cmd.length() < 64) {
        cmd += c;
      }
    }
  }

  static uint32_t t_ult = 0;
  if (!imprimir || millis() - t_ult < 1000) return;
  t_ult = millis();

  // Temperatura (bloquea ~750 ms a 12 bits; aceptable en esta herramienta)
  ds.requestTemperatures();
  float temp = ds.getTempCByIndex(0);
  bool temp_ok = (temp != DEVICE_DISCONNECTED_C) && temp > -10 && temp < 60;

  uint32_t ph_mv   = mediana_mV(PIN_PH, N_MUESTRAS);
  uint32_t tds_mv  = mediana_mV(PIN_TDS, N_MUESTRAS);
  uint32_t turb_mv = mediana_mV(PIN_TURB, N_MUESTRAS);
  bool ph_ok   = ph_mv_valido(ph_mv);
  bool tds_ok  = tds_mv_valido(tds_mv);  // agua destilada puede dar ~0 V
  bool turb_ok = turb_mv_valido(turb_mv);
  bool ph_valido = ph_calibrado && ph_ok;

  if (!vt0_calibrado && turb_ok && turb_mv >= TURB_MIN_AGUA_CLARA_MV) {
    vt0_mv = (float)turb_mv;
    vt0_calibrado = true;
    Serial.printf(">> [AUTO] Referencia VT0 fijada en %.0f mV (usa 't' para guardar en NVS)\n", vt0_mv);
  }
  bool turb_valido = vt0_calibrado && turb_ok;

  float ph  = ph_valido   ? ph_m * ph_mv + ph_b : NAN;
  float tds = tds_ok      ? calcular_tds(tds_mv / 1000.0f, temp_ok ? temp : 25.0f) : NAN;
  float it  = turb_valido ? calcular_it(turb_mv, vt0_mv) : NAN;
  ult_tds_ppm = tds;

  uint8_t validez = (ph_valido   ? VAL_PH   : 0) |
                    (tds_ok      ? VAL_TDS  : 0) |
                    (turb_valido ? VAL_TURB : 0) |
                    (temp_ok     ? VAL_TEMP : 0);

  LecturaSensores lec = {
    .temp_c  = temp,
    .ph      = ph,
    .tds_ppm = tds,
    .it      = it,
    .validez = validez
  };

  bool tds0_antes = det.tds0_fijado;
  detector_evaluar(&det, &lec);
  if (!tds0_antes && det.tds0_fijado) {
    Serial.printf(">> [AUTO] TDS0 fijado en %.0f ppm (umbral disparo > %.0f ppm)\n",
                  det.tds0, det.tds0 + UMBRAL_DELTA_TDS);
  }

  digitalWrite(PIN_LED_SIM, det.solicitud_captura ? HIGH : LOW);
  if (det.solicitud_captura && !solicitud_prev) {
    Serial.printf(">> [DISPARO] solicitud_captura = 1 (c_tds=%u, c_ph=%u, c_turb=%u, anomalias=0x%02X)\n",
                  det.c_tds, det.c_ph, det.c_turb, det.anomalias);
  }
  solicitud_prev = det.solicitud_captura;

  Serial.printf("%lu,%.2f,%lu,%.2f,%lu,%.0f,%lu,%.3f,%u,%.0f,%.0f,%u,%u,%u,%u,%u\n",
                (unsigned long)millis(), temp, (unsigned long)ph_mv, ph,
                (unsigned long)tds_mv, tds, (unsigned long)turb_mv, it, validez,
                det.tds0, vt0_mv, det.anomalias, det.c_ph, det.c_tds, det.c_turb,
                det.solicitud_captura ? 1U : 0U);
}
