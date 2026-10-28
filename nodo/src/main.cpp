// =============================================================
// QawapMayu - Nodo QM01 (ESQUELETO con datos falsos)
//
// Objetivo de la sesion S2: que estos datos falsos lleguen a
// ThingsBoard pasando por LoRa P2P y el gateway. Luego se van
// reemplazando por sensores.cpp y la FSM real, uno por uno.
//
// Comando: 'a' + Enter -> activa/desactiva una anomalia falsa de TDS
// =============================================================
#include <Arduino.h>
#include <Preferences.h>
#include "trama.h"
#include "rak_at.h"

#define RAK_RX 16
#define RAK_TX 17
#define NODO_ID 1
const uint32_t TA_MS = 5000;

Preferences nvs;
uint16_t boot_id = 0;
uint32_t seq = 0;
bool anomalia_falsa = false;
bool radio_ok = false;

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RAK_RX, RAK_TX);
  delay(500);
  Serial.println("\n=== QawapMayu nodo QM01 (datos falsos) ===");

  nvs.begin("nodo", false);
  boot_id = nvs.getUShort("boot", 0) + 1;
  nvs.putUShort("boot", boot_id);
  Serial.printf("boot_id = %u, trama = %u bytes\n", boot_id, (unsigned)sizeof(Trama));

  radio_ok = rak_configurar_p2p(Serial2, false);
  Serial.println(radio_ok ? "RAK configurado en P2P (TX)" : "!! Fallo configurando el RAK");
  randomSeed(esp_random());
}

void loop() {
  while (Serial.available()) {
    if (Serial.read() == 'a') {
      anomalia_falsa = !anomalia_falsa;
      Serial.printf("Anomalia falsa: %s\n", anomalia_falsa ? "ON" : "OFF");
    }
  }

  static uint32_t t_ciclo = 0;
  if (millis() - t_ciclo < TA_MS) return;
  t_ciclo = millis();

  Trama t;
  memset(&t, 0, sizeof(t));
  t.version   = TRAMA_VERSION;
  t.nodo_id   = NODO_ID;
  t.boot_id   = boot_id;
  t.seq       = ++seq;
  t.t_ms      = millis();
  t.ph_x100   = 700 + random(-5, 6);                       // ~7.00
  t.tds_ppm   = anomalia_falsa ? 450 + random(0, 20) : 150 + random(0, 10);
  t.it_x1000  = 20 + random(0, 5);                         // ~0.02
  t.temp_x100 = 2250 + random(-10, 11);                    // ~22.5 C
  t.validez   = VAL_PH | VAL_TDS | VAL_TURB | VAL_TEMP;
  t.anomalias = anomalia_falsa ? ANO_TDS : 0;
  t.estado    = EST_ARMADO;
  t.evento_id = 0;
  trama_sellar(&t);

  char hex[2 * sizeof(Trama) + 1];
  a_hex((const uint8_t*)&t, sizeof(t), hex);

  Serial.printf("TX seq=%lu tds=%u -> ", (unsigned long)t.seq, t.tds_ppm);
  bool ok = rak_enviar_hex(Serial2, hex);
  Serial.println(ok ? "enviado" : "FALLO (el nodo sigue funcionando igual)");
}
