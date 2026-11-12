// Calibracion del sensor de pH, compartida por nodo y herramientas.
#pragma once

// 2 puntos: BNC en corto = pH 7 a 1345 mV; vinagre, tira = 3, a 341 mV; 2026-11-11;
// error absoluto ~±1 pH; sin compensación por temperatura
// pH = PH_M * mV + PH_B
#define PH_M 0.003984f
#define PH_B 1.6410f
