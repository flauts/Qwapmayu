// =============================================================
// QawapMayu - Herramienta de sensores: pH + TDS + temperatura
//
// Imprime una linea CSV por segundo:
//   ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,validez
// (copien el monitor a un .csv en /pruebas para tener evidencia)
//
// Asistente de calibracion de pH (escribir la letra + Enter):
//   4 -> captura el voltaje actual como buffer 4.01
//   7 -> captura el voltaje actual como buffer 6.86
//   9 -> captura el voltaje actual como buffer 9.18
//   c -> calcula la recta pH = m*mV + b con los puntos capturados
//   s -> guarda m y b en la NVS de ESTE ESP32
//   b -> borra la calibracion guardada
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

#define PIN_PH    35   // ADC1
#define PIN_TDS   34   // ADC1
#define PIN_TEMP  4    // 1-Wire (pull-up 4.7k a 3.3V)

#define N_MUESTRAS 31        // lecturas rapidas por canal; se usa la mediana
#define MV_MIN_VALIDO 20     // por debajo: sonda desconectada o en corto
#define MV_MAX_VALIDO 3100   // por encima: ADC saturado (rango util ~0-3.1 V)

OneWire oneWire(PIN_TEMP);
DallasTemperature ds(&oneWire);
Preferences nvs;

// Calibracion de pH
float ph_m = 0, ph_b = 0;
bool  ph_calibrado = false;
const float BUF_PH[3] = {4.01f, 6.86f, 9.18f};
float cap_mV[3];
bool  cap_ok[3] = {false, false, false};
bool  imprimir = true;

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

bool mv_valido(uint32_t mv) { return mv >= MV_MIN_VALIDO && mv <= MV_MAX_VALIDO; }

// Formula del fabricante (Keyestudio/DFRobot) con compensacion termica
float calcular_tds(float volt, float tempC) {
  float comp = volt / (1.0f + 0.02f * (tempC - 25.0f));
  return (133.42f * comp * comp * comp - 255.86f * comp * comp + 857.39f * comp) * 0.5f;
}

void ayuda() {
  Serial.println();
  Serial.println("--- Comandos: 4/7/9 capturar buffer | c calcular | s guardar | b borrar | p pausa | h ayuda ---");
  if (ph_calibrado) Serial.printf("Calibracion actual: pH = %.6f * mV + %.4f\n", ph_m, ph_b);
  else Serial.println("pH SIN calibrar (la columna pH sale como nan)");
  Serial.println("ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,validez");
}

void capturar(int idx) {
  uint32_t mv = mediana_mV(PIN_PH, 201);
  cap_mV[idx] = mv;
  cap_ok[idx] = true;
  Serial.printf(">> Buffer %.2f capturado: %lu mV%s\n", BUF_PH[idx], (unsigned long)mv,
                mv_valido(mv) ? "" : "  (!! fuera de rango del ADC, revisar divisor/offset)");
}

void calcular() {
  double n = 0, sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (int i = 0; i < 3; i++) {
    if (!cap_ok[i]) continue;
    double x = cap_mV[i], y = BUF_PH[i];
    n++; sx += x; sy += y; sxy += x * y; sxx += x * x;
  }
  if (n < 2) { Serial.println(">> Necesito al menos 2 buffers capturados."); return; }
  double den = n * sxx - sx * sx;
  if (den == 0) { Serial.println(">> Los voltajes son iguales: revisar conexion de la sonda."); return; }
  ph_m = (float)((n * sxy - sx * sy) / den);
  ph_b = (float)((sy - ph_m * sx) / n);
  ph_calibrado = true;
  Serial.printf(">> pH = %.6f * mV + %.4f   (%d puntos)\n", ph_m, ph_b, (int)n);
  Serial.printf(">> Sensibilidad: %.1f mV por unidad de pH\n", 1.0 / ph_m);
  for (int i = 0; i < 3; i++) {
    if (!cap_ok[i]) continue;
    float pred = ph_m * cap_mV[i] + ph_b;
    Serial.printf("   buffer %.2f -> modelo %.2f (error %+.2f)\n", BUF_PH[i], pred, pred - BUF_PH[i]);
  }
  Serial.println(">> Anoten estos valores en docs/calibracion.md y usen 's' para guardar.");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  analogReadResolution(12);
  ds.begin();
  nvs.begin("cal", false);
  ph_calibrado = nvs.getBool("ph_ok", false);
  ph_m = nvs.getFloat("ph_m", 0);
  ph_b = nvs.getFloat("ph_b", 0);
  Serial.printf("\nQawapMayu - sensores. DS18B20 encontrados: %d\n", ds.getDeviceCount());
  ayuda();
}

void loop() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    switch (c) {
      case '4': capturar(0); break;
      case '7': capturar(1); break;
      case '9': capturar(2); break;
      case 'c': calcular(); break;
      case 's':
        if (!ph_calibrado) { Serial.println(">> Primero calcula con 'c'."); break; }
        nvs.putFloat("ph_m", ph_m); nvs.putFloat("ph_b", ph_b); nvs.putBool("ph_ok", true);
        Serial.println(">> Calibracion guardada en NVS.");
        break;
      case 'b':
        nvs.clear(); ph_calibrado = false;
        Serial.println(">> Calibracion borrada.");
        break;
      case 'p': imprimir = !imprimir; break;
      case 'h': ayuda(); break;
      default: break;  // ignora \r, \n y otros
    }
  }

  static uint32_t t_ult = 0;
  if (!imprimir || millis() - t_ult < 1000) return;
  t_ult = millis();

  // Temperatura (bloquea ~750 ms a 12 bits; aceptable en esta herramienta)
  ds.requestTemperatures();
  float temp = ds.getTempCByIndex(0);
  bool temp_ok = (temp != DEVICE_DISCONNECTED_C) && temp > -10 && temp < 60;

  uint32_t ph_mv  = mediana_mV(PIN_PH, N_MUESTRAS);
  uint32_t tds_mv = mediana_mV(PIN_TDS, N_MUESTRAS);
  bool ph_ok  = mv_valido(ph_mv);
  bool tds_ok = mv_valido(tds_mv) || tds_mv < MV_MIN_VALIDO;  // agua destilada puede dar ~0 V

  float ph  = (ph_calibrado && ph_ok) ? ph_m * ph_mv + ph_b : NAN;
  float tds = tds_ok ? calcular_tds(tds_mv / 1000.0f, temp_ok ? temp : 25.0f) : NAN;

  uint8_t validez = (ph_ok ? 1 : 0) | (tds_ok ? 2 : 0) | (temp_ok ? 8 : 0);
  Serial.printf("%lu,%.2f,%lu,%.2f,%lu,%.0f,%u\n",
                (unsigned long)millis(), temp, (unsigned long)ph_mv, ph,
                (unsigned long)tds_mv, tds, validez);
}
