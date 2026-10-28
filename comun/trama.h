// =============================================================
// QawapMayu - Formato de la trama LoRa P2P (compartido nodo/gateway)
// Cualquier cambio aqui se debe acordar entre TODO el equipo y
// subir TRAMA_VERSION.
// =============================================================
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>

#define TRAMA_VERSION 1

enum EstadoNodo : uint8_t {
  EST_BLOQUEADO        = 0,
  EST_ARMADO           = 1,
  EST_MUESTREANDO      = 2,
  EST_CAPTURA_ESTIMADA = 3,
  EST_FALLO            = 4
};

static const char* const NOMBRE_ESTADO[] = {
  "BLOQUEADO", "ARMADO", "MUESTREANDO", "CAPTURA_ESTIMADA", "FALLO"
};

// Banderas de validez (bit = 1 -> canal valido)
#define VAL_PH    0x01
#define VAL_TDS   0x02
#define VAL_TURB  0x04
#define VAL_TEMP  0x08

// Banderas de anomalia (bit = 1 -> canal fuera de umbral en este ciclo)
#define ANO_PH    0x01
#define ANO_TDS   0x02
#define ANO_TURB  0x04

// Trama binaria empaquetada: 27 bytes -> 54 caracteres hex en AT+PSEND
typedef struct __attribute__((packed)) {
  uint8_t  version;     // TRAMA_VERSION
  uint8_t  nodo_id;     // 1 = QM01
  uint16_t boot_id;     // contador de reinicios (guardado en NVS)
  uint32_t seq;         // numero de secuencia, reinicia en cada boot
  uint32_t t_ms;        // ms desde el encendido
  int16_t  ph_x100;     // pH * 100           (7.05  -> 705)
  uint16_t tds_ppm;     // TDS en ppm
  int16_t  it_x1000;    // indice turbidez IT * 1000 (0.125 -> 125)
  int16_t  temp_x100;   // temperatura C * 100 (22.5 -> 2250)
  uint8_t  validez;     // VAL_*
  uint8_t  anomalias;   // ANO_*
  uint8_t  estado;      // EstadoNodo
  uint16_t evento_id;   // id de la ultima captura (0 = ninguna)
  uint16_t crc;         // CRC-16/CCITT-FALSE de todos los bytes anteriores
} Trama;

// ---------- CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) ----------
static inline uint16_t crc16_ccitt(const uint8_t* d, size_t n) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < n; i++) {
    crc ^= (uint16_t)((uint16_t)d[i] << 8);
    for (int b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
    }
  }
  return crc;
}

static inline void trama_sellar(Trama* t) {
  t->crc = crc16_ccitt((const uint8_t*)t, sizeof(Trama) - 2);
}

static inline bool trama_valida(const Trama* t) {
  return t->version == TRAMA_VERSION &&
         t->crc == crc16_ccitt((const uint8_t*)t, sizeof(Trama) - 2);
}

// ---------- Conversion binario <-> hex (AT+PSEND usa hex ASCII) ----------
// out debe tener espacio para 2*n + 1 caracteres
static inline void a_hex(const uint8_t* d, size_t n, char* out) {
  static const char H[] = "0123456789ABCDEF";
  for (size_t i = 0; i < n; i++) {
    out[2 * i]     = H[d[i] >> 4];
    out[2 * i + 1] = H[d[i] & 0x0F];
  }
  out[2 * n] = '\0';
}

static inline int nibble_hex(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  return -1;
}

// Devuelve true solo si s tiene exactamente 2*n caracteres hex validos
static inline bool de_hex(const char* s, uint8_t* out, size_t n) {
  if (strlen(s) != 2 * n) return false;
  for (size_t i = 0; i < n; i++) {
    int hi = nibble_hex(s[2 * i]);
    int lo = nibble_hex(s[2 * i + 1]);
    if (hi < 0 || lo < 0) return false;
    out[i] = (uint8_t)((hi << 4) | lo);
  }
  return true;
}
