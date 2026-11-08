// =============================================================
// QawapMayu - Herramienta de calibracion manual de la bomba
//
// Permite accionar la bomba (o LED testigo) por un tiempo exacto
// configurable para medir el volumen bombeado y determinar el
// caudal Q_cal (mL/s).
//
// Accion fisica:
//   Pulsador en GPIO25 -> Inicia el ensayo de duracion t_bomba_ms.
//
// Comandos por puerto serie (115200 baud, enviar con Enter):
//   <numero> -> Configura el tiempo de bombeo en segundos (ej. 5 o 2.5)
//   s / S    -> Corte de emergencia / detencion manual inmediata
//   h / ?    -> Imprime mensaje de ayuda con la configuracion actual
// =============================================================

#include <Arduino.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "hardware.h"

// ---------- Configuracion de pines y constantes ----------
#define PIN_RELE  23
#define PIN_BOTON 25
#define PIN_LED    2

const uint32_t T_BOMBA_DEFECTO_MS = 5000;
const uint32_t T_MAX_MS = 15000;
const uint32_t T_DEBOUNCE_MS = 50;

// ---------- Maquina de estados ----------
enum EstadoBomba {
  EST_IDLE,
  EST_BOMBEANDO
};

EstadoBomba estado = EST_IDLE;
uint32_t t0_bomba = 0;
uint32_t t_bomba_ms = T_BOMBA_DEFECTO_MS;
uint32_t n_ensayo = 0;

// ---------- Control de rele y LED testigo ----------
void fijar_rele(bool encender) {
  bool nivel = encender ^ RELE_ACTIVO_BAJO;
  digitalWrite(PIN_RELE, nivel ? HIGH : LOW);
  digitalWrite(PIN_LED, encender ? HIGH : LOW);
}

// ---------- Finalizacion de bombeo con reporte ----------
void terminar_bombeo(const char* motivo) {
  fijar_rele(false);
  estado = EST_IDLE;
  uint32_t t_real_ms = millis() - t0_bomba;
  Serial.printf("[BOMBA] ensayo=%u, t_pedido_ms=%lu, t_real_ms=%lu, motivo=%s\n",
                (unsigned int)n_ensayo, (unsigned long)t_bomba_ms, (unsigned long)t_real_ms, motivo);
}

// ---------- Inicio de bombeo ----------
void iniciar_bombeo() {
  if (estado != EST_IDLE) return;
  n_ensayo++;
  estado = EST_BOMBEANDO;
  t0_bomba = millis();
  fijar_rele(true);
  Serial.printf("[BOMBA] Iniciando ensayo=%u, t_pedido_ms=%lu (%.2f s)\n",
                (unsigned int)n_ensayo, (unsigned long)t_bomba_ms, t_bomba_ms / 1000.0f);
}

// ---------- Ayuda por puerto serie ----------
void imprimir_ayuda() {
  Serial.println();
  Serial.println(F("============================================================="));
  Serial.println(F(" QawapMayu - Calibracion manual del caudal de la bomba"));
  Serial.println(F("============================================================="));
  Serial.println(F("Comandos disponibles (escribir y presionar Enter):"));
  Serial.println(F("  <numero> : Configura la duracion del bombeo en segundos"));
  Serial.printf( "             (ej: '5', '2.5', '10') [Max: %.1f s]\n", T_MAX_MS / 1000.0f);
  Serial.println(F("  s / S    : Detiene el bombeo de emergencia"));
  Serial.println(F("  h / ?    : Muestra este mensaje de ayuda"));
  Serial.println(F("Accion fisica:"));
  Serial.println(F("  Pulsador (GPIO25): Inicia el ensayo de bombeo"));
  Serial.printf( "Configuracion actual: t_bomba = %lu ms (%.2f s)\n",
                (unsigned long)t_bomba_ms, t_bomba_ms / 1000.0f);
  Serial.println(F("============================================================="));
  Serial.println();
}

// ---------- Lectura y antirrebote del pulsador (50 ms) ----------
void leer_pulsador() {
  static int estado_anterior = HIGH;
  static int estado_estable = HIGH;
  static uint32_t t_ultimo_cambio = 0;

  int lectura = digitalRead(PIN_BOTON);
  if (lectura != estado_anterior) {
    estado_anterior = lectura;
    t_ultimo_cambio = millis();
  }

  if ((millis() - t_ultimo_cambio) >= T_DEBOUNCE_MS) {
    if (lectura != estado_estable) {
      estado_estable = lectura;
      // Flanco de bajada (HIGH -> LOW en pin con pull-up interno)
      if (estado_estable == LOW) {
        if (estado == EST_IDLE) {
          iniciar_bombeo();
        }
        // Si EST_BOMBEANDO, la pulsacion se descarta de forma segura
      }
    }
  }
}

// ---------- Procesamiento de lineas de comando serie ----------
void procesar_linea(char* buffer) {
  // Recortar espacios iniciales
  char* p = buffer;
  while (*p && isspace((unsigned char)*p)) {
    p++;
  }
  if (*p == '\0') {
    return;
  }
  // Recortar espacios finales
  char* fin = p + strlen(p) - 1;
  while (fin >= p && isspace((unsigned char)*fin)) {
    *fin = '\0';
    fin--;
  }

  // Comando corte por 's' o 'S'
  if ((p[0] == 's' || p[0] == 'S') && p[1] == '\0') {
    if (estado == EST_BOMBEANDO) {
      terminar_bombeo("corte por 's'");
    } else {
      Serial.println(F("[AVISO] La bomba ya se encuentra apagada."));
    }
    return;
  }

  // Comando ayuda por 'h', 'H' o '?'
  if ((p[0] == 'h' || p[0] == 'H' || p[0] == '?') && p[1] == '\0') {
    imprimir_ayuda();
    return;
  }

  // Parseo numerico (segundos)
  char* endptr = nullptr;
  double seg = strtod(p, &endptr);

  while (endptr && *endptr && isspace((unsigned char)*endptr)) {
    endptr++;
  }

  if (endptr == p || *endptr != '\0' || seg <= 0.0) {
    Serial.printf("[ERROR] Valor invalido '%s'. Ingrese un tiempo positivo en segundos (ej: 5 o 2.5).\n", p);
    return;
  }

  uint32_t nuevo_t_ms = (uint32_t)round(seg * 1000.0);
  if (nuevo_t_ms == 0) {
    Serial.printf("[ERROR] Tiempo demasiado corto '%s' s.\n", p);
    return;
  }

  if (nuevo_t_ms > T_MAX_MS) {
    Serial.printf("[AVISO] El tiempo solicitado (%.2f s) excede el limite maximo de %lu ms (%.1f s). Limitando a %lu ms.\n",
                  seg, (unsigned long)T_MAX_MS, T_MAX_MS / 1000.0f, (unsigned long)T_MAX_MS);
    nuevo_t_ms = T_MAX_MS;
  }

  t_bomba_ms = nuevo_t_ms;
  Serial.printf("Tiempo configurado: %lu ms (%.2f s)\n",
                (unsigned long)t_bomba_ms, t_bomba_ms / 1000.0f);
}

// ---------- Lectura no bloqueante por puerto serie ----------
void leer_serial() {
  static char buffer[64];
  static size_t idx = 0;

  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r' || c == '\n') {
      if (idx > 0) {
        buffer[idx] = '\0';
        procesar_linea(buffer);
        idx = 0;
      }
    } else {
      if (idx < sizeof(buffer) - 1) {
        buffer[idx++] = c;
      } else {
        idx = 0; // Descartar en caso de desbordamiento de buffer
      }
    }
  }
}

// ---------- Setup ----------
void setup() {
  // Lo PRIMERO: asegurar rele apagado antes y despues de configurar el pin
  fijar_rele(false);
  pinMode(PIN_RELE, OUTPUT);
  fijar_rele(false);

  // Configurar LED testigo
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  // Pulsador con pull-up interno
  pinMode(PIN_BOTON, INPUT_PULLUP);

  // Inicializar puerto serie
  Serial.begin(115200);
  delay(200);

  imprimir_ayuda();
}

// ---------- Loop principal (estrictamente no bloqueante) ----------
void loop() {
  uint32_t ahora = millis();

  // 1. Verificacion de tiempos durante el bombeo
  if (estado == EST_BOMBEANDO) {
    uint32_t t_transcurrido = ahora - t0_bomba;
    if (t_transcurrido >= T_MAX_MS) {
      terminar_bombeo("tope");
    } else if (t_transcurrido >= t_bomba_ms) {
      terminar_bombeo("normal");
    }
  }

  // 2. Lectura no bloqueante del pulsador
  leer_pulsador();

  // 3. Lectura no bloqueante del puerto serie
  leer_serial();
}
