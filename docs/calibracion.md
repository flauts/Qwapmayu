# Calibraciones

> **IMPORTANTE (Estado actual y protocolo completo paso a paso):** Ver [`docs/protocolo_calibracion_sensores.md`](protocolo_calibracion_sensores.md) para la guía maestra actualizada al 2026-11-11 con los pines en ADC1 (`GPIO32/33/34/35` (pH 33, temp 32, turbidez 34, TDS 35)), comandos exactos (`ph <val> [mV]`, `setph`, `t`, `0`, `r`), criterios de aprobación, plantillas de tablas y el avance real de cada uno de los 4 sensores.

## 1. pH (DFRobot SEN0169) – usar la herramienta `sensores`

**Antes de empezar**
1. Los parámetros de calibración de pH (`PH_M` y `PH_B`) se definen en `comun/calibracion.h` y se compilan tanto en el nodo como en herramientas (no dependen de NVS).
2. Con la sonda en el buffer 6.86, medir Po con multímetro. Ajustar el potenciómetro de **offset** (normalmente el más cercano al conector BNC; el otro regula la salida digital Do, que no usamos) para que quede cerca de **1.6–1.8 V**. Así los otros buffers caen dentro del rango del ADC.
3. Verificar con multímetro que en 4.01 y 9.18 la salida **no pase de 3.1 V**. Si pasa, poner divisor 10k/20k (la calibración absorbe el factor).
4. Después de calibrar, **no volver a tocar el potenciómetro** (fijarlo con cinta).

**Procedimiento**
1. Servir un poco de cada buffer en vasitos limpios. Nunca devolver líquido al frasco.
2. Enjuagar la sonda con agua destilada y secar con papel (sin frotar el bulbo).
3. Sumergir en 6.86, esperar 1–2 min a que el valor se estabilice, presionar `7`.
4. Enjuagar → 4.01 → esperar → `4`.
5. Enjuagar → 9.18 → esperar → `9`.
6. `c` para calcular, revisar el error de cada punto; `s` imprime las líneas `#define PH_M` y `#define PH_B` para copiarlas a `comun/calibracion.h`.
7. Comprobación: volver a meter la sonda en 6.86 y verificar que marque ~6.86.
8. Guardar la sonda húmeda en su capuchón.

| Fecha | Buffer | Voltaje (mV) | Temp (°C) | Multímetro (V) |
|---|---|---|---|---|
| | 6.86 | | | |
| | 4.01 | | | |
| | 9.18 | | | |

**Resultado:** pH = `m` × mV + `b` → m = ______ b = ______ sensibilidad = ______ mV/pH

### 1.1 Registro de calibración con tiras reactivas (2026-11-10) [DESCARTADA]

> **NOTA (2026-11-11):** Esta recta inicial ($\text{pH} = 0.003344 \cdot \text{mV} + 1.6154$) fue **descartada** y reemplazada por la calibración del 2026-11-11 (sección 1.2). Se conservan los registros previos como trazabilidad histórica.

Ante la indisponibilidad de buffers certificados estándar, se realizó la calibración mediante tiras reactivas de 4 almohadillas (escala entera 0–14, incertidumbre de lectura visual $\pm 0.5$ pH) utilizando dos puntos extremos y agua de grifo como comprobación independiente:

| Muestra | pH tira | Voltaje medio (mV) | Rol | Archivo de evidencia |
|---|---|---|---|---|
| Vinagre blanco diluido | 3.00 | 414.0 | Calibración (Punto 1) | `pruebas/sensores_20261110_221530_cal_ph_tiras.csv` |
| Bicarbonato de sodio | 9.00 (químico ~8.3) | 2208.0 | Calibración (Punto 2) | `pruebas/sensores_20261110_231503_cal_ph_tiras.csv` |
| Agua de la llave | 7.00 | ~1680–1693 | Comprobación independiente | `pruebas/sensores_20261110_233020_comp_agua_llave.csv` |

**Ecuación de calibración resultante:**
- Con escala de tira (pH 9.00): $\text{pH} = 0.003344 \times \text{mV} + 1.6154$ (Sensibilidad: $299.0\text{ mV/pH}$)
- Comprobación en agua de la llave ($1690\text{ mV}$): $\text{pH}_{\text{medido}} = 7.27 \implies \text{Error} = +0.27\text{ pH}$ (Aprobado: menor a $\pm 0.5$ pH).

### 1.2 Calibración vigente (código) (2026-11-11)

* **Condiciones de hardware:** Placa DFRobot SEN0169 alimentada por el riel de 5 V del HW-131 (jack DC), con $V_{CC}$ medido en $5.00\text{ V}$ y divisor resistivo 10k/20k conectado a pin por confirmar (mapa vigente en ese momento).
  > **Nota de historial de pines:** El 2026-11-11 (tarde) se reasignaron los pines para ordenar mejor el cableado físico: pH GPIO32->33, DS18B20 GPIO33->32, TDS GPIO34->35, turbidez GPIO35->34. Hora exacta del cambio: [HH:MM, por confirmar].
* **Procedimiento:** Sin buffers certificados estándar; calibración por 2 puntos y verificación con tiras reactivas con resolución de escala entera (pasos de 1 unidad de pH):
  * **Punto A (Referencia neutra):** Conector BNC en cortocircuito = pH 7.00, $1345\text{ mV}$ (pin por confirmar (mapa vigente en ese momento); capturado en sesión previa y reingresado con `ph 7 1345`).
  * **Punto B (Ácido):** Vinagre blanco diluido, tira = 3, $341\text{ mV}$ (pin por confirmar (mapa vigente en ese momento); la lectura aún derivaba ~10–15 mV/min al momento de la captura).

**Ecuación de calibración resultante e integrada en código (`comun/calibracion.h`):**
$$\text{pH} = 0.003984 \times \text{mV} + 1.6410 \qquad (\text{Sensibilidad: } 251.0\text{ mV/pH})$$
*(Definida como `#define PH_M 0.003984f` y `#define PH_B 1.6410f`; implementado en código, pendiente de verificar en hardware en `GPIO33` sin depender de NVS. El comando `s` en `sensores` solo imprime los `#define` para copiarlos).*

**Verificación independiente con tiras reactivas (pasos de 1):**

| Muestra | Voltaje medido (`ph_mV`) | pH calculado (recta vigente) | pH tira (pasos de 1) | Observación | Evidencia en `pruebas/` |
|---|---|---|---|---|---|
| Agua de caño | ~1400 mV (pin por confirmar (mapa vigente en ese momento)) | 7.22 | 7 | Concordancia dentro de la resolución de la tira | [`pruebas/sensores_20261111_141425_comp_agua_llave.csv`](../pruebas/sensores_20261111_141425_comp_agua_llave.csv) y `.log` |
| Agua hervida en reposo (hace días) | ~1713 mV (pin por confirmar (mapa vigente en ese momento)) | 8.46 | 7 – 8 | Causa no establecida | [`pruebas/sensores_20261111_132707_comp_agua_llave.csv`](../pruebas/sensores_20261111_132707_comp_agua_llave.csv) |

**Incertidumbre declarada y limitaciones:**
* **Incertidumbre:** Error absoluto estimado de hasta $\sim\pm 1\text{ pH}$, debido a la resolución entera de las tiras de comprobación, deriva observada en solución ácida y ausencia de soluciones buffer patrón.
* **Discrepancia de sensibilidad:** La sensibilidad medida (251 mV/pH) difiere de la nominal referida al pin (190.5 mV/pH, calculada con la ecuación de DFRobot y el divisor 2/3) en ~32%. Sin buffers no se pudo determinar la causa (ganancia de la placa no verificada).
* **Compensación térmica:** Según revisión del código en [`herramientas/src/sensores.cpp:301`](../herramientas/src/sensores.cpp#L301) y [`nodo/src/main.cpp:159`](../nodo/src/main.cpp#L159), no hay compensación por temperatura en el pH.

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

* **Rango del sensor:** 0 a 1000 ppm (salida analógica 0–2.3 V; fuera de rango, lectura no fiable).
* **Estado:** Verificado funcionalmente, sin calibración absoluta; ensayo reproducible dentro de rango pendiente.
* **Evidencias del 2026-11-11 (pin por confirmar (mapa vigente en ese momento)):**
  - **Línea base en agua de caño (500 mL, solo KS0429 y DS18B20 sumergidos):** [`pruebas/sensores_20261111_204920_cal_tds_base.csv`](../pruebas/sensores_20261111_204920_cal_tds_base.csv), ~1080 muestras, media ~183 ppm, desv. ~28, TDS0 = 180 (tecla 0), 0 muestras sobre 280 ppm.
  - **Ensayo con sal en exceso (muy fuera de rango):** [`pruebas/sensores_20261111_223040_cal_tds_base.csv`](../pruebas/sensores_20261111_223040_cal_tds_base.csv), 375–681 ppm, `c_tds` llegó a 138, `anomalias = 3`.
* **Algoritmo de detección:** Auto-fijado diferido (~60 s, mediana) y tecla `'0'` con mediana de muestras en búfer (implementado en código, pendiente de verificar en hardware).

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

## 5. Turbidez (TS-300B) – referencia VT0

> **Nota sobre VT0 en NVS:** El valor previo de `VT0` en NVS se capturó con pines anteriores (`GPIO4` o `GPIO35`). Al operar ahora en `GPIO34` con divisor 10k/20k, hay que repetirlo con la tecla `'t'` en agua clara limpia.

| Muestra | V_T (mV) | IT = (V_T0 − V_T)/V_T0 |
|---|---|---|
| Agua clara (V_T0) | | 0 |
| + arcilla 1 | | |
| + arcilla 2 | | |

## 6. Temperatura (DS18B20)

Verificación funcional en régimen permanente, sin contraste contra termómetro patrón (ante la indisponibilidad de termómetro de referencia en banco de pruebas). La exactitud especificada por el fabricante de $\pm 0.5\,^{\circ}\text{C}$ ($-10$ a $+85\,^{\circ}\text{C}$, $3\sigma$) se encuentra verificada contra la hoja de datos de Analog Devices (rev. 6, 07/2019, sección *Thermometer Error* de las características eléctricas DC; referencia [5] del informe). Se hace constar que dicha especificación corresponde al circuito integrado DS18B20 y no a la sonda encapsulada comercial. La estabilidad registrada en la prueba mide la repetibilidad del sensor en régimen estacionario, no su exactitud, y el objetivo de error $\le 1.0\,^{\circ}\text{C}$ se apoya en la especificación del fabricante y no en un ensayo propio.

> **Nota de pin:** La corrida 162901 se midió con pin por confirmar (mapa vigente en ese momento).

Según revisión del código en [`herramientas/src/sensores.cpp:80-83, 284, 302`](../herramientas/src/sensores.cpp#L80-L83) y [`nodo/src/main.cpp:128-131, 139-140, 160`](../nodo/src/main.cpp#L128-L131), la lectura de temperatura es consumida por la función `calcular_tds()` para compensar la conductividad a la referencia de 25 °C; si la temperatura es inválida (`-127.00` o fuera de rango), ambos archivos descartan la lectura (`temp_ok = false`) y emplean el valor de respaldo nominal de 25.0 °C.

| Parámetro | Valor observado | Notas de ensayo |
|---|---|---|
| Condición de ensayo | Sonda en agua de caño, vaso en reposo | Pin por confirmar (mapa vigente en ese momento), pull-up $4.7\text{ k}\Omega$ |
| Archivo de evidencia | [`pruebas/sensores_20261111_162901_cal_temp_arranque.csv`](../pruebas/sensores_20261111_162901_cal_temp_arranque.csv) | Monitor serie del entorno `sensores` |
| Número de muestras | 62 | Muestreo continuo durante 61 s |
| Temperatura media | 24.24 °C | Dispersión min–max: 24.19 °C – 24.31 °C |
| Desviación estándar ($\sigma$) | 0.025 °C | Repetibilidad en régimen estacionario |
| Resolución del sensor | 0.0625 °C (12 bits) | 24.19 → 24.25 → 24.31 en el CSV (redondeado a 2 decimales); pasos de 0.0625 °C |
| Estado de validez | 11 (`VAL_PH` + `VAL_TDS` + `VAL_TEMP`) | Bit `VAL_TEMP` (0x08) activo en todas las filas |

