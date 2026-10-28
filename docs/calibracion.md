# Calibraciones

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
