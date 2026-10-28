// =============================================================
// QawapMayu - Maquina de estados del muestreador (simulada)
//
// La "bomba" es el rele con un LED en su contacto NO.
// La anomalia se simula por serial; el rearme con el pulsador.
//
// Comandos (letra + Enter):
//   a -> activa / desactiva la anomalia simulada
//   r -> solicitud de rearme (igual que el pulsador en GPIO25)
//   x -> simula un corte de seguridad durante el bombeo
//   e -> imprime el estado actual
//   z -> borra la NVS del muestreador (solo para pruebas)
//
// Ensayos de la matriz que se pueden hacer YA con este programa:
//   * Pico aislado: 'a', esperar ~5 s, 'a' otra vez  -> 0 activaciones
//   * Anomalia persistente: 'a' y dejarla -> 1 sola captura
//   * Enclavamiento: tras la captura, reiniciar (boton EN) -> BLOQUEADO
//   * Reinicio durante bombeo: EN mientras el LED esta prendido -> FALLO
//   * Rearme: quitar anomalia ('a'), esperar 3 ciclos normales, pulsador
// =============================================================
#include <Arduino.h>
#include <Preferences.h>
#include "trama.h"   // EstadoNodo y NOMBRE_ESTADO compartidos

// ---------- configuracion ----------
#define PIN_RELE         23
#define PIN_REARME       25     // pulsador a GND, pull-up interno
#define RELE_ACTIVO_BAJO true   // AJUSTAR segun la prueba rele_arranque

const uint32_t TA_MS                 = 5000;   // periodo de adquisicion
const uint8_t  CICLOS_PERSISTENCIA   = 3;      // ciclos anomalos para capturar
const uint8_t  CICLOS_NORMALES_REARME = 3;     // ciclos normales para permitir rearme
const uint32_t T_CAPTURA_MS          = 10000;  // luego: 100 mL / Q_cal
const uint32_t T_MAX_BOMBA_MS        = 30000;  // corte de seguridad absoluto

// ---------- estado ----------
Preferences nvs;
EstadoNodo estado;
bool     anomalia_sim = false;
bool     corte_sim = false;
bool     solicitud_rearme = false;
uint8_t  ciclos_anomalos = 0;
uint8_t  ciclos_normales = 0;
uint16_t evento_id = 0;
uint32_t t_ciclo = 0;
uint32_t t0_bomba = 0;

void rele(bool encender) {
  bool nivel = encender ^ RELE_ACTIVO_BAJO;  // activo bajo: encender -> LOW
  digitalWrite(PIN_RELE, nivel ? HIGH : LOW);
}

void cambiar_estado(EstadoNodo nuevo, const char* motivo) {
  Serial.printf("[%8lu] %s -> %s  (%s)\n", (unsigned long)millis(),
                NOMBRE_ESTADO[estado], NOMBRE_ESTADO[nuevo], motivo);
  estado = nuevo;
}

void imprimir_estado() {
  Serial.printf("[%8lu] estado=%s anomalia=%d anomalos=%u normales=%u evento=%u\n",
                (unsigned long)millis(), NOMBRE_ESTADO[estado], anomalia_sim,
                ciclos_anomalos, ciclos_normales, evento_id);
}

// Persiste el bloqueo ANTES de encender la bomba. Si falla, no se bombea.
void iniciar_captura() {
  uint16_t nuevo_id = evento_id + 1;
  bool ok = nvs.putBool("bloqueado", true) > 0 &&
            nvs.putBool("bombeando", true) > 0 &&
            nvs.putUShort("evento", nuevo_id) > 0;
  if (!ok) {
    rele(false);
    cambiar_estado(EST_FALLO, "no se pudo guardar en NVS; no se activa la bomba");
    return;
  }
  evento_id = nuevo_id;
  t0_bomba = millis();
  rele(true);
  cambiar_estado(EST_MUESTREANDO, "anomalia persistente");
}

void terminar_bombeo(EstadoNodo final, const char* motivo) {
  rele(false);
  nvs.putBool("bombeando", false);  // "bloqueado" se mantiene en true
  cambiar_estado(final, motivo);
  if (final == EST_CAPTURA_ESTIMADA) {
    Serial.printf("           Evento %u: bomba %lu ms\n", evento_id,
                  (unsigned long)(millis() - t0_bomba));
    cambiar_estado(EST_BLOQUEADO, "captura registrada, esperando rearme");
  }
}

void atender_rearme() {
  if (!solicitud_rearme) return;
  solicitud_rearme = false;
  if (estado == EST_ARMADO)      { Serial.println("Rearme ignorado: ya esta ARMADO"); return; }
  if (estado == EST_MUESTREANDO) { Serial.println("Rearme ignorado: bomba activa"); return; }
  if (ciclos_normales < CICLOS_NORMALES_REARME) {
    Serial.printf("Rearme RECHAZADO: %u/%u ciclos normales\n", ciclos_normales, CICLOS_NORMALES_REARME);
    return;
  }
  // El operador confirma con el pulsador que reemplazo el frasco y preparo la linea
  nvs.putBool("bloqueado", false);
  ciclos_anomalos = 0;
  cambiar_estado(EST_ARMADO, "rearme manual confirmado");
}

void leer_pulsador() {
  static bool crudo_ant = HIGH, estable = HIGH;
  static uint32_t t_cambio = 0;
  bool crudo = digitalRead(PIN_REARME);
  if (crudo != crudo_ant) { crudo_ant = crudo; t_cambio = millis(); }
  if (millis() - t_cambio > 50 && crudo != estable) {
    estable = crudo;
    if (estable == LOW) { Serial.println("Pulsador de rearme"); solicitud_rearme = true; }
  }
}

void leer_serial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    switch (c) {
      case 'a': anomalia_sim = !anomalia_sim;
                Serial.printf("Anomalia simulada: %s\n", anomalia_sim ? "ON" : "OFF"); break;
      case 'r': solicitud_rearme = true; break;
      case 'x': corte_sim = true; break;
      case 'e': imprimir_estado(); break;
      case 'z': nvs.clear(); evento_id = 0; Serial.println("NVS borrada (reinicia para empezar limpio)"); break;
      default: break;
    }
  }
}

void setup() {
  // Lo PRIMERO: rele apagado
  rele(false);
  pinMode(PIN_RELE, OUTPUT);
  rele(false);
  pinMode(PIN_REARME, INPUT_PULLUP);

  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== QawapMayu - FSM muestreador (simulacion con LED) ===");

  nvs.begin("muestreo", false);
  bool bloqueado = nvs.getBool("bloqueado", false);
  bool bombeando = nvs.getBool("bombeando", false);
  evento_id = nvs.getUShort("evento", 0);

  estado = EST_ARMADO;  // valor inicial para el log
  if (bombeando) {
    nvs.putBool("bombeando", false);
    nvs.putBool("bloqueado", true);
    cambiar_estado(EST_FALLO, "reinicio durante el bombeo: requiere revision");
  } else if (bloqueado) {
    cambiar_estado(EST_BLOQUEADO, "bloqueo previo en NVS");
  } else {
    Serial.println("Sin bloqueo previo -> ARMADO");
  }
  imprimir_estado();
  t_ciclo = millis();
}

void loop() {
  uint32_t ahora = millis();
  leer_serial();
  leer_pulsador();

  // 1) Supervision de la bomba (cada iteracion, no solo cada ciclo)
  if (estado == EST_MUESTREANDO) {
    if (corte_sim) {
      corte_sim = false;
      terminar_bombeo(EST_FALLO, "corte de seguridad");
    } else if (ahora - t0_bomba >= T_MAX_BOMBA_MS) {
      terminar_bombeo(EST_FALLO, "tiempo maximo de bomba excedido");
    } else if (ahora - t0_bomba >= T_CAPTURA_MS) {
      terminar_bombeo(EST_CAPTURA_ESTIMADA, "tiempo de captura cumplido");
    }
  } else {
    corte_sim = false;
  }

  // 2) Ciclo de adquisicion cada TA_MS
  if (ahora - t_ciclo >= TA_MS) {
    t_ciclo += TA_MS;
    if (anomalia_sim) {
      if (ciclos_anomalos < 255) ciclos_anomalos++;
      ciclos_normales = 0;
    } else {
      ciclos_anomalos = 0;
      if (ciclos_normales < 255) ciclos_normales++;
    }
    imprimir_estado();
    if (estado == EST_ARMADO && ciclos_anomalos >= CICLOS_PERSISTENCIA) {
      iniciar_captura();
    }
  }

  // 3) Rearme manual
  atender_rearme();
}
