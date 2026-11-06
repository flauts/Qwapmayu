// =============================================================
// QawapMayu - Deteccion de anomalia persistente (Paso 1)
// Modulo compartido entre herramientas/src/sensores.cpp y nodo/src/main.cpp
// =============================================================
#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include "trama.h"

// Umbrales deducidos de docs/bitacora.md:
// - Aire / pin sin senal: ~142 mV (~58-59 ppm)
// - Agua de cano (base TDS0): ~700-840 mV (~250-310 ppm)
// - Pizca de sal: sube por encima de 400-450 ppm
#define TDS_MIN_AGUA_PPM    100.0f   // Evita fijar TDS0 cuando la sonda sigue en el aire (~59 ppm)
#define UMBRAL_DELTA_TDS    100.0f   // Anomalia si TDS > TDS0 + 100 ppm
#define UMBRAL_PH_MIN            6.5f     // LpH (anomalia si pH < 6.5)
#define UMBRAL_PH_MAX            8.5f     // UpH (anomalia si pH > 8.5)
#define UMBRAL_IT_MAX            0.200f   // Indice de turbidez maximo (TS-300B: IT > 0.200)
#define TURB_MIN_CONECTADO_MV    300      // Descarta pin ADC flotante (~142 mV) cuando TS-300B no esta conectado
#define TURB_MIN_AGUA_CLARA_MV   1000     // Voltaje minimo en agua clara (con divisor 2/3 da ~2000-3000 mV)
#define CICLOS_PERSISTENCIA      3        // Ciclos anomalos consecutivos para levantar solicitud_captura
#define VALOR_INVALIDO_I16       INT16_MIN // Centinela entero (-32768) cuando el bit de validez es 0

// Indice relativo de turbidez IT = (V_T0 - V_T) / V_T0, acotado a >= 0.0
static inline float calcular_it(uint32_t turb_mv, float vt0_mv) {
  if (vt0_mv <= 0.0f) return NAN;
  float it = (vt0_mv - (float)turb_mv) / vt0_mv;
  return (it < 0.0f) ? 0.0f : it;
}

typedef struct {
  float   temp_c;
  float   ph;
  float   tds_ppm;
  float   it;
  uint8_t validez; // VAL_PH | VAL_TDS | VAL_TURB | VAL_TEMP
} LecturaSensores;

typedef struct {
  float   tds0;
  bool    tds0_fijado;
  uint8_t c_ph;
  uint8_t c_tds;
  uint8_t c_turb;
  uint8_t c_normales;
  uint8_t anomalias;          // ANO_PH | ANO_TDS | ANO_TURB
  bool    solicitud_captura;
} DetectorAnomalia;

static inline uint8_t _inc_sat_u8(uint8_t v) {
  return (v < 255U) ? (uint8_t)(v + 1U) : 255U;
}

static inline void detector_iniciar(DetectorAnomalia* d) {
  d->tds0              = NAN;
  d->tds0_fijado       = false;
  d->c_ph              = 0;
  d->c_tds             = 0;
  d->c_turb            = 0;
  d->c_normales        = 0;
  d->anomalias         = 0;
  d->solicitud_captura = false;
}

static inline void detector_fijar_tds0(DetectorAnomalia* d, float tds_base) {
  if (!isnan(tds_base) && tds_base >= 0.0f) {
    d->tds0        = tds_base;
    d->tds0_fijado = true;
  } else {
    d->tds0        = NAN;
    d->tds0_fijado = false;
  }
  d->c_tds             = 0;
  d->anomalias        &= (uint8_t)~ANO_TDS;
  d->solicitud_captura = (d->c_ph   >= CICLOS_PERSISTENCIA) ||
                         (d->c_tds  >= CICLOS_PERSISTENCIA) ||
                         (d->c_turb >= CICLOS_PERSISTENCIA);
}

static inline void detector_reiniciar_contadores(DetectorAnomalia* d) {
  d->c_ph              = 0;
  d->c_tds             = 0;
  d->c_turb            = 0;
  d->c_normales        = 0;
  d->anomalias         = 0;
  d->solicitud_captura = false;
}

static inline void detector_evaluar(DetectorAnomalia* d, const LecturaSensores* lec) {
  d->anomalias = 0;

  bool ph_valido   = ((lec->validez & VAL_PH)   != 0) && !isnan(lec->ph);
  bool tds_valido  = ((lec->validez & VAL_TDS)  != 0) && !isnan(lec->tds_ppm);
  bool turb_valido = ((lec->validez & VAL_TURB) != 0) && !isnan(lec->it);

  // Auto-captura de TDS0 al detectar sonda sumergida en agua (>= TDS_MIN_AGUA_PPM)
  if (!d->tds0_fijado && tds_valido && lec->tds_ppm >= TDS_MIN_AGUA_PPM) {
    d->tds0        = lec->tds_ppm;
    d->tds0_fijado = true;
  }

  // 1. Evaluacion de TDS
  if (tds_valido && d->tds0_fijado) {
    if (lec->tds_ppm > (d->tds0 + UMBRAL_DELTA_TDS)) {
      d->anomalias |= ANO_TDS;
      d->c_tds = _inc_sat_u8(d->c_tds);
    } else {
      d->c_tds = 0;
    }
  } else {
    d->c_tds = 0;
  }

  // 2. Evaluacion de pH
  if (ph_valido) {
    if (lec->ph < UMBRAL_PH_MIN || lec->ph > UMBRAL_PH_MAX) {
      d->anomalias |= ANO_PH;
      d->c_ph = _inc_sat_u8(d->c_ph);
    } else {
      d->c_ph = 0;
    }
  } else {
    d->c_ph = 0;
  }

  // 3. Evaluacion de Turbidez (mientras no este el sensor, VAL_TURB == 0 -> c_turb = 0)
  if (turb_valido) {
    if (lec->it > UMBRAL_IT_MAX) {
      d->anomalias |= ANO_TURB;
      d->c_turb = _inc_sat_u8(d->c_turb);
    } else {
      d->c_turb = 0;
    }
  } else {
    d->c_turb = 0;
  }

  // Contador de ciclos normales consecutivos (solo si al menos un canal fue evaluado contra su umbral)
  bool algun_canal_evaluado = (tds_valido && d->tds0_fijado) || ph_valido || turb_valido;
  if (algun_canal_evaluado && d->anomalias == 0) {
    d->c_normales = _inc_sat_u8(d->c_normales);
  } else {
    d->c_normales = 0;
  }

  // Bandera de disparo por persistencia (3 ciclos anomalos consecutivos)
  d->solicitud_captura = (d->c_tds  >= CICLOS_PERSISTENCIA) ||
                         (d->c_ph   >= CICLOS_PERSISTENCIA) ||
                         (d->c_turb >= CICLOS_PERSISTENCIA);
}

static inline void detector_llenar_trama(Trama* t, const LecturaSensores* lec, const DetectorAnomalia* d) {
  bool ph_valido   = ((lec->validez & VAL_PH)   != 0) && !isnan(lec->ph);
  bool tds_valido  = ((lec->validez & VAL_TDS)  != 0) && !isnan(lec->tds_ppm);
  bool turb_valido = ((lec->validez & VAL_TURB) != 0) && !isnan(lec->it);
  bool temp_valido = ((lec->validez & VAL_TEMP) != 0) && !isnan(lec->temp_c);

  t->ph_x100   = ph_valido   ? (int16_t)lroundf(lec->ph * 100.0f)      : VALOR_INVALIDO_I16;
  t->tds_ppm   = (tds_valido && lec->tds_ppm >= 0.0f) ? (uint16_t)lroundf(lec->tds_ppm) : 0;
  t->it_x1000  = turb_valido ? (int16_t)lroundf(lec->it * 1000.0f)     : VALOR_INVALIDO_I16;
  t->temp_x100 = temp_valido ? (int16_t)lroundf(lec->temp_c * 100.0f)  : VALOR_INVALIDO_I16;
  t->validez   = lec->validez;
  t->anomalias = d->anomalias;
}
