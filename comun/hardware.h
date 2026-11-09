// =============================================================
// QawapMayu - Configuracion de hardware compartida (nodo y herramientas)
// =============================================================
#pragma once
#include <stdbool.h>

// Polaridad del modulo rele (GPIO 23):
// En mesa se confirmo que el modulo conmuta con nivel LOW (0 V)
// y se apaga con nivel HIGH (3.3 V).
#define RELE_ACTIVO_BAJO true

// Pin de lectura analogica para turbidez (TS-300B con divisor 10k/20k).
// GPIO 4 corresponde a ADC2_CH0; es seguro usarlo porque no se inicializa Wi-Fi ni BLE.
#define PIN_TURB 4

