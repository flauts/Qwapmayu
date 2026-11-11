# Calibraciones

> **IMPORTANTE (Estado actual y protocolo completo paso a paso):** Ver [`docs/protocolo_calibracion_sensores.md`](protocolo_calibracion_sensores.md) para la guía maestra actualizada al 2026-11-11 con los pines en ADC1 (`GPIO32/33/34/35`), comandos exactos (`ph <val> [mV]`, `setph`, `t`, `0`, `r`), criterios de aprobación, plantillas de tablas y el avance real de cada uno de los 4 sensores.

## 1. pH (PH-4502C) – usar la herramienta `sensores`

**Antes de empezar**
1. Usar el ESP32 que será el **nodo** (la calibración queda en su NVS).
2. Con la sonda en el buffer 6.86, medir Po con multímetro. Ajustar el potenciómetro de **offset** (normalmente el más cercano al conector BNC; el otro regula la salida digital Do, que no usamos) para que quede cerca de **1.6–1.8 V**. Así los otros buffers caen dentro del rango del ADC.
3. Verificar con multímetro que en 4.01 y 9.18 la salida **no pase de 3.1 V**. Si pasa, poner divisor 10k/20k (la calibración absorbe el factor).
4. Después de calibrar, **no volver a tocar el potenciómetro** (fijarlo con cinta).

**Procedimiento**
1. Servir un poco de cada buffer en vasitos limpios. Nunca devolver líquido al frasco.
2. Enjuagar la sonda con agua destilada y secar con papel (sin frotar el bulbo).
3. Sumergir en 6.86, esperar 1–2 min a que el valor se estabilice, presionar `7`.
4. Enjuagar → 4.01 → esperar → `4`.
5. Enjuagar → 9.18 → esperar → `9`.
6. `c` para calcular, revisar el error de cada punto, `s` para guardar.
7. Comprobación: volver a meter la sonda en 6.86 y verificar que marque ~6.86.
8. Guardar la sonda húmeda en su capuchón.

| Fecha | Buffer | Voltaje (mV) | Temp (°C) | Multímetro (V) |
|---|---|---|---|---|
| | 6.86 | | | |
| | 4.01 | | | |
| | 9.18 | | | |

**Resultado:** pH = `m` × mV + `b` → m = ______ b = ______ sensibilidad = ______ mV/pH

### 1.1 Registro de calibración con tiras reactivas (2026-11-10)

Ante la indisponibilidad de buffers certificados estándar, se realizó la calibración mediante tiras reactivas de 4 almohadillas (escala entera 0–14, incertidumbre de lectura visual $\pm 0.5$ pH) utilizando dos puntos extremos y agua de grifo como comprobación independiente:

| Muestra | pH tira | Voltaje medio (mV) | Rol | Archivo de evidencia |
|---|---|---|---|---|
| Vinagre blanco diluido | 3.00 | 414.0 | Calibración (Punto 1) | `pruebas/sensores_20261110_221530_cal_ph_tiras.csv` |
| Bicarbonato de sodio | 9.00 (químico ~8.3) | 2208.0 | Calibración (Punto 2) | `pruebas/sensores_20261110_231503_cal_ph_tiras.csv` |
| Agua de la llave | 7.00 | ~1680–1693 | Comprobación independiente | `pruebas/sensores_20261110_233020_comp_agua_llave.csv` |

**Ecuación de calibración resultante:**
- Con escala de tira (pH 9.00): $\text{pH} = 0.003344 \times \text{mV} + 1.6154$ (Sensibilidad: $299.0\text{ mV/pH}$)
- Comprobación en agua de la llave ($1690\text{ mV}$): $\text{pH}_{\text{medido}} = 7.27 \implies \text{Error} = +0.27\text{ pH}$ (Aprobado: menor a $\pm 0.5$ pH).

**Interferencia TDS–pH (agua de caño)**

| Condición | pH leído |
|---|---|
| Solo sonda de pH | |
| pH + TDS en el mismo vaso, TDS desconectado | |
| pH + TDS en el mismo vaso, TDS conectado | |

Si cambia más de ~0.1, alternar: apagar el TDS mientras se lee el pH (alimentar el TDS desde un GPIO libre).

## 2. ADC del ESP32 vs multímetro

| Punto medido | Multímetro (V) | ESP32 (mV) | Diferencia |
|---|---|---|---|
| | | | |

## 3. TDS (KS0429)

| Muestra | Temp (°C) | tds_mV | TDS (ppm) |
|---|---|---|---|
| Agua destilada | | | |
| Agua de caño | | | |
| Caño + 1 pizca de sal | | | |
| Caño + 2 pizcas | | | |
| Caño + 3 pizcas | | | |

## 4. Caudal de la bomba (Q_cal) – 10 ensayos

Bombear durante un tiempo fijo `t` y pesar o medir el volumen (1 g ≈ 1 mL de agua).

| # | t (s) | Volumen (mL) | Q (mL/s) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |
| 8 | | | |
| 9 | | | |
| 10 | | | |

Q_cal promedio = ______ mL/s → `T_CAPTURA_MS` = 100 / Q_cal × 1000 = ______ ms

## 5. Turbidez (TS-300B) – referencia

| Muestra | V_T (mV) | IT = (V_T0 − V_T)/V_T0 |
|---|---|---|
| Agua clara (V_T0) | | 0 |
| + arcilla 1 | | |
| + arcilla 2 | | |
