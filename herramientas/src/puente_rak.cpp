// =============================================================
// Puente USB <-> RAK3272S
// Escriban comandos AT en el monitor serial y presionen Enter.
// Conexion: RAK TX -> GPIO16, RAK RX -> GPIO17, 3V3 y GND comunes.
//
// Prueba P2P (en AMBOS modulos):
//   AT
//   AT+NWM=0
//   AT+P2P=923500000:7:125:0:10:14   (grupo 5)      (si da error, BW=0 en vez de 125)
// Receptor:  AT+PRECV=65534
// Emisor:    AT+PRECV=0
//            AT+PSEND=48454C4C4F       ("HELLO" en hex)
// =============================================================
#include <Arduino.h>

#define RAK_RX 16  // entra al ESP32 (viene del TX del RAK)
#define RAK_TX 17  // sale del ESP32 (va al RX del RAK)

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RAK_RX, RAK_TX);
  delay(300);
  Serial.println();
  Serial.println("=== Puente RAK listo. Escribe AT y presiona Enter ===");
}

void loop() {
  while (Serial.available())  Serial2.write(Serial.read());
  while (Serial2.available()) Serial.write(Serial2.read());
}
