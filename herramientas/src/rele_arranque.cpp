// =============================================================
// QawapMayu - Prueba del rele (con LED en el contacto NO)
//
// Objetivo: responder 3 preguntas y anotarlas en la bitacora
//  1) ¿El modulo es activo en BAJO o en ALTO?
//  2) ¿Hace "clic" o enciende el LED al conectar / reiniciar el ESP32
//     (boton EN), ANTES de que el programa tome control del pin?
//  3) ¿Conmuta bien con la senal de 3.3 V del ESP32?
//
// Secuencia: 5 s con el pin SIN configurar (observar), luego
// alterna el nivel del pin cada 3 s indicando HIGH/LOW.
// =============================================================
#include <Arduino.h>

#define PIN_RELE 23

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== Prueba de rele ===");
  Serial.println("Fase 1: pin SIN configurar durante 5 s. ¿Esta el LED encendido? ¿Hubo clic al arrancar?");
  delay(5000);
  pinMode(PIN_RELE, OUTPUT);
  Serial.println("Fase 2: alternando el pin. Anoten con que nivel se ENCIENDE el LED.");
}

void loop() {
  static bool nivel = HIGH;
  digitalWrite(PIN_RELE, nivel);
  Serial.printf("GPIO%d = %s\n", PIN_RELE, nivel ? "HIGH" : "LOW");
  nivel = !nivel;
  delay(3000);
}
