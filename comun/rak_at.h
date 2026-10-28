// =============================================================
// QawapMayu - Funciones minimas para manejar el RAK3172/RAK3272S
// por comandos AT (firmware RUI3) en modo LoRa P2P.
// Version simple y bloqueante con timeouts cortos: suficiente para
// el esqueleto. Mas adelante se puede volver no bloqueante.
// =============================================================
#pragma once
#include <Arduino.h>

// Frecuencia:SF:BW:CR:preambulo:potencia  -> IGUAL en nodo y gateway.
// Grupo 5 -> 923.5 MHz (formato del lab: 923X00000, X = numero de grupo).
// Misma configuracion usada en el LAB 4. Si el BW "125" da AT_PARAM_ERROR, probar "0".
#define P2P_CONFIG "923500000:7:125:0:10:14"

static bool rak_eco = true;  // imprime lo que responde el RAK en Serial

// Espera una linea que contenga 'esperado'. Devuelve false ante AT_* de error o timeout.
static bool rak_esperar(HardwareSerial& s, const char* esperado, uint32_t timeout_ms) {
  uint32_t t0 = millis();
  String linea;
  while (millis() - t0 < timeout_ms) {
    while (s.available()) {
      char c = (char)s.read();
      if (c == '\n') {
        linea.trim();
        if (linea.length()) {
          if (rak_eco) { Serial.print("  RAK< "); Serial.println(linea); }
          if (linea.indexOf(esperado) >= 0) return true;
          if (linea.startsWith("AT_")) return false;  // AT_ERROR, AT_PARAM_ERROR, AT_BUSY_ERROR...
        }
        linea = "";
      } else {
        linea += c;
      }
    }
    delay(1);
  }
  return false;
}

static bool rak_cmd(HardwareSerial& s, const String& cmd,
                    const char* esperado = "OK", uint32_t timeout_ms = 1500) {
  while (s.available()) s.read();  // descartar basura previa
  if (rak_eco) { Serial.print("  RAK> "); Serial.println(cmd); }
  s.print(cmd);
  s.print("\r\n");
  return rak_esperar(s, esperado, timeout_ms);
}

// Deja el modulo en P2P con la configuracion comun.
// receptor = true -> queda escuchando en modo continuo (gateway)
static bool rak_configurar_p2p(HardwareSerial& s, bool receptor) {
  rak_cmd(s, "AT");                       // despertar / sincronizar
  rak_cmd(s, "AT+NWM=0", "OK", 3000);     // modo P2P (puede reiniciar el modulo)
  delay(1500);
  while (s.available()) s.read();
  rak_cmd(s, "AT+PRECV=0");               // salir de recepcion antes de configurar
  if (!rak_cmd(s, String("AT+P2P=") + P2P_CONFIG)) return false;
  if (receptor) return rak_cmd(s, "AT+PRECV=65534");
  return true;
}

// Envia un payload ya convertido a hex. Espera el OK y el evento de fin de TX.
static bool rak_enviar_hex(HardwareSerial& s, const char* hex) {
  if (!rak_cmd(s, String("AT+PSEND=") + hex, "OK", 2000)) return false;
  return rak_esperar(s, "TXP2P", 2000);  // "+EVT:TXP2P DONE"
}
