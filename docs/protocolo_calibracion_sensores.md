# Guía Maestra y Estado de Calibración de Sensores – QawapMayu (Nodo QM01)

**Última actualización:** 2026-11-11  
**Propósito:** Documento base autocontenido para ejecutar cada calibración y prueba de validación de sensores en sesiones/chats individuales antes del *code freeze* (13 de noviembre). Contiene el estado real de avance, el mapa de pines vigente, las protecciones de memoria NVS, los comandos exactos de consola y el protocolo paso a paso trazado al código fuente.

---

## 1. Resumen Ejecutivo de Estado y Avance por Sensor

| # | Sensor | Pin ESP32 | Estado actual | Resumen de resultados / Qué falta hacer |
|---|---|---|---|---|
| **1** | **pH (DFRobot SEN0169)** | `GPIO33` (ADC1_CH5, con divisor 10k/20k) | **calibrado aproximado, sin buffers (±1 pH)** | **Actualizado (2026-11-11):** Placa DFRobot SEN0169 alimentada por riel 5 V del HW-131, divisor 10k/20k (medido con pin por confirmar (mapa vigente en ese momento); reasignado a `GPIO33`).<br>• **Calibración 2 puntos:** Punto A (BNC en corto = pH 7.00, $1345\text{ mV}$); Punto B (vinagre diluido, tira = 3, $341\text{ mV}$).<br>• **Recta vigente en código (`comun/calibracion.h`):** $\text{pH} = 0.003984 \cdot \text{mV} + 1.6410$ (Sensibilidad: $251\text{ mV/pH}$), fijada mediante constantes `PH_M` y `PH_B` en arranque (**implementado en código, pendiente de verificar en hardware en `GPIO33`**; no depende de NVS).<br>• **Comprobación con tiras (pasos de 1):** Agua de caño $\sim 1400\text{ mV}$ (pH 7.22, tira 7; `pruebas/sensores_20261111_141425_comp_agua_llave.csv`).<br>• **Incertidumbre:** Error absoluto de hasta $\sim\pm 1\text{ pH}$. Sin compensación térmica. |
| **2** | **Temperatura (DS18B20)** | `GPIO32` (1-Wire, pull-up $4.7\text{ k}\Omega$ a 3.3V) | **verificado funcionalmente, sin contraste** | **Completado (2026-11-11):** Sensor conectado con pull-up de $4.7\text{ k}\Omega$ a 3.3V, detectando 1 dispositivo (`DS18B20 encontrados: 1`); medido con pin por confirmar (mapa vigente en ese momento); reasignado a `GPIO32`.<br>• **Prueba funcional:** 62 muestras continuas en agua de caño ([`pruebas/sensores_20261111_162901_cal_temp_arranque.csv`](../pruebas/sensores_20261111_162901_cal_temp_arranque.csv)).<br>• **Resultados:** Media de $24.24\,^{\circ}\text{C}$, $\sigma = 0.025\,^{\circ}\text{C}$, resolución $0.0625\,^{\circ}\text{C}$ y `validez = 11` permanente.<br>• **Metrología:** Exactitud del fabricante $\pm 0.5\,^{\circ}\text{C}$ según hoja de datos; verificación funcional en régimen permanente sin contraste contra termómetro patrón externo. |
| **3** | **Turbidez (TS-300B)** | `GPIO34` (ADC1_CH6, con divisor 10k/20k) | **PENDIENTE EN GPIO34** *(Prioridad #2)* | **Estado actual:** El divisor 10k/20k opera en **`GPIO34`** (ADC1_CH6). La referencia previa de `VT0` en NVS se capturó en pines anteriores (`GPIO4` o `GPIO35`).<br>• **Qué hacer:** (1) Verificar en agua limpia que marque `2000–3250 mV`; (2) presionar **`t`** para capturar y guardar el nuevo `VT0` en NVS en `GPIO34`; (3) ejecutar prueba de **pico aislado** ($< 3$ ciclos con maicena $\rightarrow$ `c_turb` a `1` o `2` y regresa a `0` con `solicitud_captura = 0`). |
| **4** | **TDS (Keyestudio KS0429)** | `GPIO35` (ADC1_CH7, directo 0–2.3V) | **verificado funcionalmente, sin calibración absoluta; ensayo reproducible dentro de rango pendiente** *(Prioridad #3)* | **Rango del sensor:** 0 a 1000 ppm (lecturas del 2026-11-11 con pin por confirmar (mapa vigente en ese momento); pin actual `GPIO35`).<br>• **Evidencias del 2026-11-11:** Línea base en agua de caño, 500 mL, solo KS0429 y DS18B20 sumergidos (`pruebas/sensores_20261111_204920_cal_tds_base.csv`, ~1080 muestras, media ~183 ppm, desv. ~28, TDS0 = 180 con tecla 0, 0 muestras sobre 280 ppm). Ensayo con sal en exceso muy fuera de rango (`pruebas/sensores_20261111_223040_cal_tds_base.csv`, 375-681 ppm, `c_tds` llegó a 138, `anomalias = 3`).<br>• **Auto-fijado diferido (~60 s, mediana) y tecla '0' con mediana:** **Implementado en código, pendiente de verificar en hardware**.<br>• **Qué hacer:** Sumergir en ~500 mL de agua de la llave, esperar auto-fijado de `TDS0` a los ~60–70 s (o pulsar `0`), y añadir dosis de 5 mL de solución concentrada (1/4 cucharita en 100 mL; máx. 4 dosis, parar en ~800 ppm), verificando incremento monótono sin salir del rango lineal y disparo (`solicitud_captura = 1`) al superar $\text{TDS0} + 100\text{ ppm}$. |

---

## 2. Reglas Críticas de Hardware, Pines y Protección de NVS

### 2.1 Mapa de pines vigente en código (`herramientas/src/sensores.cpp`, `nodo/src/main.cpp`, `comun/hardware.h`)

> **Historial de pines:** El 2026-11-11 (tarde) se reasignaron los pines para ordenar mejor el cableado físico: pH GPIO32->33, DS18B20 GPIO33->32, TDS GPIO34->35, turbidez GPIO35->34. Hora exacta del cambio: [HH:MM, por confirmar].

| Canal / Función | Macro en código | Pin ESP32 | Convertidor / Bus | Rango válido en código (`comun/anomalia.h`) |
|---|---|---|---|---|
| **pH (DFRobot SEN0169)** | `PIN_PH` | **`GPIO33`** | `ADC1_CH5` | `20 mV <= ph_mV <= 3100 mV` (`PH_MIN_VALIDO_MV`, `PH_MAX_VALIDO_MV`). |
| **Temperatura (DS18B20)** | `PIN_TEMP` | **`GPIO32`** | `1-Wire` (pull-up $4.7\text{ k}\Omega$ a `3V3`) | `-10.0 °C < temp_C < 60.0 °C` y `!= -127.00 °C` |
| **Turbidez (TS-300B)** | `PIN_TURB` | **`GPIO34`** | `ADC1_CH6` (solo entrada, divisor 10k/20k) | Conectado: `>= 300 mV`. Agua clara (`VT0`): `2000 mV <= turb_mV <= 3250 mV` en NVS `"cal"` (requiere recaptura con 't'). |
| **TDS (KS0429)** | `PIN_TDS` | **`GPIO35`** | `ADC1_CH7` (solo entrada, directo 0–2.3V) | Rango: 0–1000 ppm. `tds_mV <= 2500 mV`. Auto-fijado (60 s, mediana) y tecla '0' con mediana en RAM (**implementado en código, pendiente de verificar en hardware**). |
| **LED simulador bomba** | `PIN_LED_SIM` / `PIN_LED` | **`GPIO2`** | Salida digital | `HIGH` cuando `solicitud_captura == 1` |
| **Relé de bomba (Nodo)** | `PIN_RELE` | **`GPIO23`** | Salida digital (`RELE_ACTIVO_BAJO = true`) | **Bomba de 12 V DESCONECTADA durante pruebas en `sensores`** |

### 2.2 ¡CUIDADO! Teclas que borran o sobrescriben la memoria NVS

El ESP32 del nodo guarda la calibración permanente en la partición NVS bajo el namespace **`"cal"`**:
* Claves de pH: `"ph_m"` (`float`), `"ph_b"` (`float`), `"ph_ok"` (`bool`). *(Nota: el firmware actual en `setup()` carga `ph_m` y `ph_b` fijos desde `comun/calibracion.h`, independientemente de lo que haya en NVS)*.
* Claves de Turbidez: `"vt0_mv"` (`float`), `"vt0_ok"` (`bool`).
* *(Nota: `TDS0` no se guarda en NVS; vive únicamente en RAM en `det.tds0` y se fija en cada arranque tras 60 s o con la tecla `0`).*

**Reglas de interacción con NVS:**
1. **Comando `b` en `sensores` (`sensores.cpp:224-230`):** Ejecuta `nvs.clear()` sobre `"cal"`, borrando la referencia `VT0` de turbidez. El pH no se pierde porque al reiniciar `setup()` lo inicializa desde `comun/calibracion.h`.
2. **Precaución con la tecla `t` (`sensores.cpp:231-245`, `nodo/src/main.cpp:348-364`):** Sobrescribe `"vt0_mv"` en NVS `"cal"` si la lectura en `GPIO34` está entre `2000` y `3250 mV`. Debido a que la referencia guardada previamente se midió en otro pin (`GPIO4` o `GPIO35`), **es indispensable presionar `t` en agua clara con la sonda en `GPIO34`**.
3. **La tecla `z` en `nodo` es segura para los sensores:** En `nodo/src/main.cpp:368-372`, `z` ejecuta `nvs_muestreo.clear()`, que borra únicamente el enclavamiento de la bomba (`bloqueado`, `bombeando`, `evento`) en el namespace `"muestreo"` y **NO toca** el namespace `"cal"`.

---

## 3. Referencia Rápida del Entorno `sensores` (`herramientas/src/sensores.cpp`)

### 3.1 Cómo abrir el monitor serie guardando evidencia automática en `pruebas/`

El archivo `herramientas/platformio.ini` tiene configurados los filtros `send_on_enter` y `evidencia` (`herramientas/monitor/filter_evidencia.py`). Cada vez que se abre el monitor, crea automáticamente dos archivos en `pruebas/`:
* `pruebas/sensores_<AAAAMMDD_HHMMSS>_<PRUEBA>.log` (todo el texto y comandos).
* `pruebas/sensores_<AAAAMMDD_HHMMSS>_<PRUEBA>.csv` (solo la cabecera y las filas CSV limpias de 16 columnas).

**Comando canónico para iniciar cualquier sesión (reemplazando `<NOMBRE_PRUEBA>`):**
```bash
cd /home/flauta/Documents/qawapmayu/herramientas && PRUEBA=<NOMBRE_PRUEBA> /home/flauta/.platformio/penv/bin/pio device monitor -e sensores
```
*(Para salir del monitor en cualquier momento: presionar `Ctrl + C`).*

### 3.2 Todos los comandos interactivos de `sensores` (escribir comando + `Enter`)

| Comando + `Enter` | Acción exacta en `herramientas/src/sensores.cpp` |
|---|---|
| `ph <val>` | Captura la mediana de 201 muestras del ADC en `GPIO33` para el pH de referencia `<val>` (ej. `ph 3`, `ph 9`). Además, `filter_evidencia.py` respalda el punto automáticamente en `pruebas/calibracion.log`. |
| `ph <val> <mV>` | Inyecta manualmente en RAM un punto $(\text{pH}, \text{mV})$ medido previamente sin necesidad de sumergir la sonda de nuevo (ej. `ph 3 414`). |
| `c` | Calcula por mínimos cuadrados ordinarios (OLS) la recta $\text{pH} = \text{ph\_m} \cdot \text{mV} + \text{ph\_b}$ con los puntos cargados ($n \ge 2$) e imprime la sensibilidad y el error residual de cada punto. |
| `s` | Imprime las líneas `#define PH_M` y `#define PH_B` por Serial para copiarlas a `comun/calibracion.h` (`sensores.cpp:216-223`; ya no escribe en NVS). |
| `setph <m> <b>` | Escribe `ph_m = <m>` y `ph_b = <b>` en RAM y en NVS `"cal"` (`sensores.cpp:199-210`), pero al reiniciar `setup()` (`sensores.cpp:156-158`) los sobrescribe con las constantes de `comun/calibracion.h`. |
| `0` | Fija `det.tds0` calculando la mediana de las muestras en búfer (si hay $\ge 15$ muestras en `sensores`) o fallback a la última lectura (`comun/anomalia.h:89-97`), reinicia `c_tds = 0` y apaga `ANO_TDS`. |
| `t` | Mide la mediana de 201 muestras en `GPIO34` y, si está en `[2000, 3250] mV`, guarda `vt0_mv` y `vt0_ok = true` en NVS `"cal"` (`sensores.cpp:231-245`). |
| `r` | Reinicia a `0` todos los contadores de persistencia (`c_ph`, `c_tds`, `c_turb`, `c_normales`), limpia `solicitud_captura = 0` y apaga el LED en `GPIO2`. |
| `p` | Pausa o reanuda la impresión de líneas CSV cada segundo (útil para escribir comandos con calma). |
| `h` | Imprime la lista de comandos, el estado actual de calibración (`pH`, `TDS0`, `VT0`) y vuelve a imprimir la cabecera CSV. |
| `b` | Borra todo el namespace NVS `"cal"` (`sensores.cpp:224-230`), eliminando `VT0` de turbidez. El pH no se pierde al reiniciar porque `setup()` lo carga desde `comun/calibracion.h`. |

### 3.3 Estructura de las 16 columnas del CSV (`1 línea por segundo`)

```text
ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,turb_mV,it,validez,tds0_ppm,vt0_mV,anomalias,c_ph,c_tds,c_turb,solicitud_captura
```

* **`validez` (suma de bits en decimal):**
  * `VAL_PH = 1` (`0x01`)
  * `VAL_TDS = 2` (`0x02`)
  * `VAL_TURB = 4` (`0x04`)
  * `VAL_TEMP = 8` (`0x08`)
  * *Ejemplos:* `3` = pH + TDS válidos; `7` = pH + TDS + Turbidez válidos; `11` = pH + TDS + Temp válidos; **`15` = los 4 sensores válidos simultáneamente**.
* **`anomalias` (suma de bits en decimal):**
  * `0` = Todo dentro de rango normal.
  * `1` (`ANO_PH = 0x01`) = $\text{pH} < 6.5$ o $\text{pH} > 8.5$.
  * `2` (`ANO_TDS = 0x02`) = $\text{tds\_ppm} > \text{tds0\_ppm} + 100$.
  * `4` (`ANO_TURB = 0x04`) = $\text{it} > 0.200$.
* **Disparo por persistencia (`CICLOS_PERSISTENCIA = 3`):**
  * Cuando `c_ph >= 3`, `c_tds >= 3` o `c_turb >= 3`, la última columna `solicitud_captura` pasa de `0` a `1` y se imprime:
    `>> [DISPARO] solicitud_captura = 1 (c_tds=..., c_ph=..., c_turb=..., anomalias=0x...)`

---

## 4. Protocolo Detallado por Sensor

---

### SENSOR 1: pH (DFRobot SEN0169 en `GPIO33`) — [CALIBRADO APROXIMADO, SIN BUFFERS (±1 pH)]

#### 4.1.1 Calibración vigente en código (2026-11-11)
* **Condiciones de hardware:** Placa DFRobot SEN0169 alimentada por el riel de 5 V del HW-131 (jack DC, $V_{CC}$ medido en $5.00\text{ V}$), divisor resistivo 10k/20k conectado a pin por confirmar (mapa vigente en ese momento).
  > **Nota de historial de pines:** El 2026-11-11 (tarde) se reasignaron los pines para ordenar mejor el cableado físico: pH GPIO32->33, DS18B20 GPIO33->32, TDS GPIO34->35, turbidez GPIO35->34. Hora exacta del cambio: [HH:MM, por confirmar].
* **Procedimiento:** Sin buffers certificados estándar; calibración por 2 puntos y verificación con tiras reactivas (resolución en pasos de 1 unidad de pH):
  * **Punto A (Referencia neutra):** Conector BNC en cortocircuito = pH 7.00, $1345\text{ mV}$ (pin por confirmar (mapa vigente en ese momento); capturado en sesión previa y reingresado manualmente con `ph 7 1345`).
  * **Punto B (Ácido):** Vinagre blanco diluido, tira = 3, $341\text{ mV}$ (pin por confirmar (mapa vigente en ese momento); la lectura aún derivaba ~10–15 mV/min al momento de la captura).
* **Ecuación lineal vigente en código (`comun/calibracion.h`):**
  $$\text{pH} = 0.003984 \cdot \text{mV} + 1.6410 \qquad (\text{Sensibilidad: } 251.0\text{ mV/pH})$$
  *(Definida como `#define PH_M 0.003984f` y `#define PH_B 1.6410f`; implementada en código, pendiente de verificar en hardware en `GPIO33` sin depender de NVS. El comando `s` en `sensores` solo imprime los `#define` para copiarlos).*
* **Comprobación independiente con tiras reactivas (pasos de 1 unidad):**
  * **Agua de caño:** $\sim 1400\text{ mV}$ (pin por confirmar (mapa vigente en ese momento)) $\implies \text{pH} \approx 7.22$ con la recta (tira = 7; evidencia en [`pruebas/sensores_20261111_141425_comp_agua_llave.csv`](../pruebas/sensores_20261111_141425_comp_agua_llave.csv) y `.log`).
  * **Agua hervida en reposo (hace días):** $\sim 1713\text{ mV}$ (pin por confirmar (mapa vigente en ese momento)) $\implies \text{pH} \approx 8.46$ con la recta (tira entre 7 y 8; causa no establecida; evidencia en [`pruebas/sensores_20261111_132707_comp_agua_llave.csv`](../pruebas/sensores_20261111_132707_comp_agua_llave.csv)).
* **Incertidumbre declarada y limitaciones:**
  * **Incertidumbre:** Error absoluto estimado de hasta $\sim\pm 1\text{ pH}$ debido a la resolución entera de las tiras de comprobación, deriva en solución ácida y ausencia de patrones estándar.
  * **Discrepancia de sensibilidad:** La sensibilidad medida (251 mV/pH) difiere de la nominal referida al pin (190.5 mV/pH, calculada con la ecuación de DFRobot y el divisor 2/3) en ~32%. Sin buffers no se pudo determinar la causa (ganancia de la placa no verificada).
  * **Compensación térmica:** Según revisión del código en [`herramientas/src/sensores.cpp:301`](../herramientas/src/sensores.cpp#L301) y [`nodo/src/main.cpp:159`](../nodo/src/main.cpp#L159), no hay compensación por temperatura en el pH.

#### 4.1.2 Registro histórico descartado (2026-11-10)
> **ESTADO: DESCARTADA.** La calibración inicial realizada el 2026-11-10 fue sustituida el 2026-11-11 por la recta actual con cortocircuito BNC y vinagre. Se conserva la tabla previa únicamente como trazabilidad histórica de laboratorio:

| Solución | Rol | pH tira (escala entera) | `ph_mV` estable (mV) | pH sonda | Error ($\text{pH}_{\text{sonda}} - \text{pH}_{\text{tira}}$) | Evidencia en `pruebas/` |
|---|---|---|---|---|---|---|
| Vinagre blanco diluido | Punto 1 (Calibración) | 3 | 414 | 3.00 | 0.00 | `sensores_20261110_221530_cal_ph_tiras.csv` |
| Agua con bicarbonato | Punto 2 (Calibración) | 9 *(buffer ~8.3)* | 2208 | 9.00 | 0.00 | `sensores_20261110_231503_cal_ph_tiras.csv` |
| Agua de la llave | **Comprobación independiente** | 7 | 1650 – 1693 | 7.13 – 7.28 | **+0.13 a +0.28** | `sensores_20261110_233020_comp_agua_llave.csv` |

#### 4.1.3 Verificación rápida opcional del cruce de umbral ácido ($\text{pH} < 6.5$)
Si al iniciar la próxima sesión quieres dejar un archivo `.log` corto donde se vea la recta final `pH = 0.003984 * mV + 1.6410` en código y el disparo en vinagre ($\text{pH} \approx 3.0 < 6.5$):
1. Ejecutar:
   ```bash
   cd /home/flauta/Documents/qawapmayu/herramientas && PRUEBA=cruce_umbral_ph /home/flauta/.platformio/penv/bin/pio device monitor -e sensores
   ```
2. Observar 5 filas en agua de la llave con `pH` ~`7.1–7.3` (cargado automáticamente desde `comun/calibracion.h`), `anomalias = 0`, `c_ph = 0`, `solicitud_captura = 0`.
3. Pasar la sonda al vaso con vinagre diluido y esperar 10 segundos: verás que `pH` baja de `6.5`, `anomalias` cambia a `1`, `c_ph` cuenta `1 -> 2 -> 3` y sale `>> [DISPARO] solicitud_captura = 1 (c_tds=0, c_ph=3, c_turb=0, anomalias=0x01)`.
4. Enjuagar la sonda con abundante agua limpia y cerrar con `Ctrl + C`.

---

### SENSOR 2: Temperatura (DS18B20 en `GPIO32`) — [VERIFICADO FUNCIONALMENTE, SIN CONTRASTE]

#### 4.2.1 Estado de verificación funcional y resultados (corrida 162901)
* **Condición de ensayo confirmada:** Sonda en agua de caño, en un vaso en reposo, con resistencia pull-up de $4.7\text{ k}\Omega$ conectada a pin por confirmar (mapa vigente en ese momento).
* **Detección en arranque:** El sistema reportó `DS18B20 encontrados: 1` al inicializar el bus 1-Wire.
* **Archivo de evidencia:** [`pruebas/sensores_20261111_162901_cal_temp_arranque.csv`](../pruebas/sensores_20261111_162901_cal_temp_arranque.csv) y su correspondiente [`.log`](../pruebas/sensores_20261111_162901_cal_temp_arranque.log).
* **Resultados cuantitativos observados:**

| Parámetro | Valor observado | Notas de verificación |
|---|---|---|
| Condición de líquido | Sonda en agua de caño, vaso en reposo | Pin por confirmar (mapa vigente en ese momento), pull-up $4.7\text{ k}\Omega$ |
| Muestras registradas | 62 | Muestreo continuo durante 61 s |
| Temperatura media | **24.24 °C** | Dispersión min–max: 24.19 °C a 24.31 °C |
| Desviación estándar ($\sigma$) | **0.025 °C** | Repetibilidad en régimen estacionario |
| Resolución observada | **0.0625 °C** | 24.19 → 24.25 → 24.31 en el CSV (redondeado a 2 decimales); pasos de 0.0625 °C |
| Canal de validez | **11** (`0x0B`) | Bit `VAL_TEMP` (0x08) activo en el 100 % de las filas |

* **Justificación metrológica:** Ante la indisponibilidad de un termómetro de referencia en banco de pruebas, no se realizó contraste contra patrón externo. La exactitud especificada por el fabricante de $\pm 0.5\,^{\circ}\text{C}$ ($-10$ a $+85\,^{\circ}\text{C}$, $3\sigma$) se encuentra verificada contra la hoja de datos de Analog Devices (rev. 6, 07/2019, sección *Thermometer Error* de las características eléctricas DC; referencia [5] del informe). Se hace constar que dicha especificación corresponde al circuito integrado DS18B20 y no a la sonda encapsulada comercial. La estabilidad registrada en la prueba mide la repetibilidad del sensor, no su exactitud metrológica, y el objetivo de error $\le 1.0\,^{\circ}\text{C}$ se apoya en dicha especificación de fábrica y no en un ensayo propio.
* **Compensación térmica en el sistema:** Según revisión del código en [`herramientas/src/sensores.cpp:80-83, 284, 302`](../herramientas/src/sensores.cpp#L80-L83) y [`nodo/src/main.cpp:128-131, 139-140, 160`](../nodo/src/main.cpp#L128-L131), la lectura de temperatura es consumida por la fórmula de `calcular_tds()` para compensar la conductividad a la referencia estándar de 25 °C. Si el sensor devuelve lectura inválida (`-127.00`), ambos programas sustituyen el valor por el defecto nominal de 25.0 °C.

#### 4.2.2 Diagnóstico y revisión física ante lectura `-127.00` (`DEVICE_DISCONNECTED_C`)
Si en futuras pruebas la columna `temp_C` vuelve a mostrar `-127.00` o el arranque indica `DS18B20 encontrados: 0`, se debe a que el bus 1-Wire en **`GPIO32`** quedó abierto o con su resistencia pull-up desconectada.

**Pasos de revisión física (con el USB del ESP32 desconectado):**
1. Seguir los 3 cables de la sonda impermeable DS18B20:
   * **Rojo (`VCC`):** debe ir firme al riel de **`3.3 V`** (`3V3` del ESP32).
   * **Negro (`GND`):** debe ir firme al riel de **`GND`** común.
   * **Amarillo (`DATA`):** debe ir conectado a la fila del pin **`GPIO32`** del ESP32.
2. **Verificar la resistencia pull-up de $4.7\text{ k}\Omega$:**
   * Debe haber una resistencia de **$4.7\text{ k}\Omega$** conectada **entre la fila de `GPIO32` (cable amarillo) y el riel de `3.3 V` (cable rojo)**.
   * *Tip con multímetro (sin USB):* Medir resistencia entre el pin `GPIO32` del ESP32 y el pin `3V3` del ESP32 $\rightarrow$ debe marcar **$\approx 4.7\text{ k}\Omega$**, y continuidad ($0\text{ }\Omega$) entre `GPIO32` y la unión del cable amarillo.
3. **Pulsar el botón físico `EN/RST` del ESP32:** La búsqueda `ds.begin()` solo se ejecuta en `setup()`. Si se conecta la sonda con la placa encendida, seguirá indicando 0 hasta pulsar `EN/RST`.

**Líneas que deben salir al quedar bien conectado:**
1. Al arrancar el ESP32 ([`herramientas/src/sensores.cpp:164`](../herramientas/src/sensores.cpp#L164)):
   ```text
   QawapMayu - sensores. DS18B20 encontrados: 1
   ```
   *(Si sigue diciendo `encontrados: 0`, mover/apretar las patillas de la resistencia de $4.7\text{ k}\Omega$ y el jumper de `GPIO33` y pulsar el botón físico `EN/RST` del ESP32 hasta que diga `1`).*
2. En las filas CSV cada segundo:
   * La columna 2 (`temp_C`) dejará de ser `-127.00` y mostrará un valor cercano a la temperatura ambiente (ej. `24.25`).
   * La columna 9 (`validez`) sumará **`+8`** (`VAL_TEMP = 0x08`). Por ejemplo, si antes `validez` era `3` (pH + TDS), ahora pasará a **`11`** (`3 + 8`), o **`15`** si los 4 sensores están activos.

#### 4.2.3 Contraste opcional con termómetro de referencia
Si en el futuro se cuenta con un termómetro de referencia calibrado o de resolución conocida, este es el procedimiento para verificar el error experimental:

1. **Comando exacto para abrir el monitor:**
```bash
cd /home/flauta/Documents/qawapmayu/herramientas && PRUEBA=cal_temp /home/flauta/.platformio/penv/bin/pio device monitor -e sensores
```
2. **Anotar datos del termómetro de referencia casero:** Tipo de termómetro y su resolución mínima (`[RESOLUCION_TERMOMETRO]`, ej. `0.1 °C` o `1 °C`).
3. **Preparar 3 vasos con agua a temperaturas seguras dentro de `(-10, 60) °C`:**
   * **Punto 1 (Fría):** Agua con cubos de hielo (~`2 a 8 °C`).
   * **Punto 2 (Ambiente):** Agua de la llave (~`20 a 25 °C`).
   * **Punto 3 (Tibia):** Agua tibia entre **`35 y 40 °C`** (mezclar agua caliente con agua fría).
4. **Procedimiento en cada vaso:**
   * Sumergir juntas la punta metálica del DS18B20 y el bulbo/punta del termómetro de referencia en el centro del líquido (sin tocar las paredes ni el fondo).
   * Esperar **1 a 2 minutos** hasta que ambas lecturas se estabilicen.
   * Tomar **5 lecturas espaciadas cada 5 segundos** anotando simultáneamente lo que marca el termómetro casero ($T_{\text{ref}}$) y la columna `temp_C` del CSV ($T_{\text{DS18B20}}$).
5. **Criterio de aprobado (Tabla 3 del informe):**
   * El error absoluto promedio en cada punto debe cumplir:
     $$|T_{\text{DS18B20}} - T_{\text{ref}}| \le 1.0\,^{\circ}\text{C}$$
   * La columna `validez` debe mantener el bit `VAL_TEMP` (`+8`) encendido en todas las muestras.

**Plantilla de tabla para completar durante la sesión de Temperatura:**

* **Resolución del termómetro de referencia:** `[RESOLUCION_TERMOMETRO]` = ______ °C
* **Archivo de evidencia generado:** `pruebas/sensores_<fecha_hora>_cal_temp.csv`

| Baño térmico | Muestra (cada 5 s) | `ms` del CSV | $T_{\text{ref}}$ termómetro (°C) | `temp_C` DS18B20 (°C) | Error $|T_{\text{DS}} - T_{\text{ref}}|$ (°C) | `validez` (bit 8 activo) | ¿Cumple $\le 1.0\,^{\circ}\text{C}$? |
|---|---|---|---|---|---|---|---|
| **1. Agua con hielo** | 1 | | | | | | |
| | 2 | | | | | | |
| | 3 | | | | | | |
| | 4 | | | | | | |
| | 5 | | | | | | |
| | **Promedio P1** | — | | | | | |
| **2. Agua de la llave** | 1 | | | | | | |
| | 2 | | | | | | |
| | 3 | | | | | | |
| | 4 | | | | | | |
| | 5 | | | | | | |
| | **Promedio P2** | — | | | | | |
| **3. Agua tibia (35–40 °C)** | 1 | | | | | | |
| | 2 | | | | | | |
| | 3 | | | | | | |
| | 4 | | | | | | |
| | 5 | | | | | | |
| | **Promedio P3** | — | | | | | |

---

### SENSOR 3: Turbidez TS-300B en `GPIO35` (Referencia `VT0` y Pico Aislado) — [PENDIENTE EN GPIO35]

### SENSOR 3: Turbidez TS-300B en `GPIO34` (Referencia `VT0` y Pico Aislado) — [PENDIENTE EN GPIO34]

> **Nota sobre VT0 en NVS:** La referencia `VT0` guardada actualmente en la memoria NVS `"cal"` se obtuvo con pines anteriores (`GPIO4` o `GPIO35`). Al operar ahora en `GPIO34` con divisor 10k/20k, **es indispensable presionar la tecla `t` con la sonda en agua clara limpia** para guardar el valor representativo del nuevo pin.

#### 4.3.1 Qué verificar primero en el cableado de `GPIO34`
El sensor óptico TS-300B se alimenta con `5 V` (`VIN`) y entrega hasta `~4.5 V` en agua clara, por lo que **requiere obligatoriamente el divisor resistivo $10\text{ k}\Omega$ (arriba) / $20\text{ k}\Omega$ (abajo a GND)** para escalar la señal por $\times \frac{2}{3}$ y proteger el ESP32 ($\le 3.3\text{ V}$).
* El punto medio del divisor va conectado a **`GPIO34`** (`ADC1_CH6`).
* **Requisito del código (`comun/anomalia.h:24-25`):** Para que el firmware acepte guardar la referencia de agua clara `VT0` con la tecla `t`, la lectura `turb_mV` en `GPIO34` **debe estar entre `2000 mV` y `3250 mV`** (en agua limpia suele dar entre `2300` y `3100 mV`).

#### 4.3.2 Comando exacto para abrir el monitor
```bash
cd /home/flauta/Documents/qawapmayu/herramientas && PRUEBA=turb_pico /home/flauta/.platformio/penv/bin/pio device monitor -e sensores
```

#### 4.3.3 Protocolo paso a paso (Fijar `VT0` + Prueba de Pico Aislado $< 3$ ciclos)
1. **Asegurar que la bomba de 12 V esté desconectada de la corriente.**
2. **Sumergir el cabezal óptico del TS-300B en un vaso con agua limpia y clara** (cuidando que no entren burbujas en la ranura central en forma de U y que el nivel de agua no moje el conector superior que no es sumergible).
3. Mirar la columna 7 del CSV (`turb_mV`): verificar que sea estable y **`>= 2000 mV`** (entre `2000` y `3250 mV`).
4. **Guardar `VT0` en NVS:** Escribir **`t` + Enter**. Debe aparecer:
   ```text
   >> Referencia VT0 (agua clara) guardada en NVS: <vt0_mV> mV (umbral IT > 0.200)
   ```
   A partir de ese instante, la columna 8 (`it`) mostrará `0.000` (o cercano a `0.000`), la columna 11 (`vt0_mV`) mostrará el valor guardado, y `validez` sumará **`+4`** (`VAL_TURB = 0x04`).
5. **Reiniciar contadores antes del ensayo:** Escribir **`r` + Enter**. Debe salir:
   ```text
   >> Contadores de anomalia y solicitud_captura reiniciados.
   ```
   Dejar correr ~10 segundos en agua clara (`it <= 0.200`, `anomalias = 0`, `c_turb = 0`, `solicitud_captura = 0`).
6. **Ejecutar el PICO AISLADO (perturbación transitoria de 1 o 2 segundos, $< 3$ ciclos):**
   * En `sensores`, el ciclo de evaluación es de **1 segundo** (`1000 ms`).
   * Introducir brevemente un objeto opaco limpio (ej. la punta de una cuchara o un agitador) dentro de la ranura en U del sensor TS-300B durante **exactamente 1 segundo (o máximo 2 segundos)** y **retirarlo de inmediato** antes de que se cumpla el 3.er segundo.
   * *(Cuidado: obstruir parcialmente el haz para que `turb_mV` baje de $0.80 \times V_{T0}$, por ejemplo a `800–1500 mV`, pero que no baje de `300 mV` para que `turb_mv_valido()` siga siendo `true`).*
7. **Qué debe observarse en el CSV para dar por APROBADO el pico aislado:**
   * Antes del pico: `it <= 0.200`, `anomalias = 0`, `c_turb = 0`, `solicitud_captura = 0`.
   * Durante el pico (1 o 2 filas): `it > 0.200`, `anomalias = 4` (o `4 + otros`), `c_turb = 1` (y opcionalmente `c_turb = 2`), pero **`solicitud_captura = 0`**.
   * En la fila inmediatamente posterior al retiro: `turb_mV` vuelve al valor de agua clara, `it <= 0.200`, **`c_turb` se reinicia automáticamente a `0`**, y **`solicitud_captura` permanece en `0`** en todo momento (nunca aparece `>> [DISPARO]`).
8. *(Opcional en la misma sesión o archivo separado `PRUEBA=turb_persistente`):* Si luego quieres dejar también una evidencia de anomalía persistente de turbidez en `GPIO34`, obstruir o enturbiar con maicena por $\ge 3$ segundos para ver `c_turb = 1 -> 2 -> 3` y `solicitud_captura = 1`, y luego limpiar y pulsar `r`.

#### 4.3.4 Plantilla de tabla para completar durante la sesión de Turbidez (Pico Aislado)

* **Referencia `VT0` guardada en NVS (`GPIO34`):** `vt0_mV` = ______ mV (Umbral de anomalía: $V_T < 0.80 \times V_{T0} =$ ______ mV $\iff \text{IT} > 0.200$)
* **Archivo de evidencia generado:** `pruebas/sensores_<fecha_hora>_turb_pico.csv`

| Ciclo / Muestra | `ms` del CSV | Condición física | `vt0_mV` (mV) | `turb_mV` (mV) | `it` | `anomalias` (bit 4) | `c_turb` | `solicitud_captura` | ¿Activó bomba / disparo? |
|---|---|---|---|---|---|---|---|---|---|
| $k=0$ (Base) | | Agua clara limpia (`t`, `r`) | | | | 0 | 0 | 0 | No |
| $k=1$ (Pico) | | Perturbación transitoria (1 s) | | | $> 0.200$ | 4 | 1 | 0 | No |
| $k=2$ (Pico / Retiro) | | Perturbación (2 s) o retiro | | | | | 2 (o 0) | 0 | No |
| $k=3$ (Recuperación) | | Agua clara tras retiro | | | $\le 0.200$ | 0 | **0** | **0** | **No (Aprobado)** |
| $k=4$ (Estable) | | Agua clara estable | | | $\le 0.200$ | 0 | 0 | 0 | No |

---

### SENSOR 4: TDS Keyestudio KS0429 en `GPIO35` (Línea Base `TDS0` y Solución Salina de Demo) — [PENDIENTE]

* **Estado:** Verificado funcionalmente, sin calibración absoluta; ensayo reproducible dentro de rango pendiente.
* **Evidencias del 2026-11-11 (pin por confirmar (mapa vigente en ese momento)):**
  - **Línea base en agua de caño (500 mL, solo KS0429 y DS18B20 sumergidos):** [`pruebas/sensores_20261111_204920_cal_tds_base.csv`](../pruebas/sensores_20261111_204920_cal_tds_base.csv), ~1080 muestras, media ~183 ppm, desv. ~28, TDS0 = 180 (tecla 0), 0 muestras sobre 280 ppm.
  - **Ensayo con sal en exceso (muy fuera de rango):** [`pruebas/sensores_20261111_223040_cal_tds_base.csv`](../pruebas/sensores_20261111_223040_cal_tds_base.csv), 375–681 ppm, `c_tds` llegó a 138, `anomalias = 3`.

#### 4.4.1 Fundamento en el código (`herramientas/src/sensores.cpp` y `comun/anomalia.h`)
* Lee `PIN_TDS = 35` (`GPIO35`). Si `temp_C` del DS18B20 es válida, compensa térmicamente a 25 °C:
  $$V_{\text{comp}} = \frac{V}{1 + 0.02(T - 25.0)}, \qquad \text{TDS}_{\text{ppm}} = 0.5 \left(133.42\,V_{\text{comp}}^3 - 255.86\,V_{\text{comp}}^2 + 857.39\,V_{\text{comp}}\right)$$
* **Rango del sensor:** El Keyestudio KS0429 cubre **únicamente de 0 a 1000 ppm** (salida analógica de 0 a 2.3 V; fuera de rango, lectura no fiable).
* **Cómo funciona `TDS0`:**
  * Mientras la sonda está en el aire (~`142 mV`, ~`58 ppm`), como es menor a `TDS_MIN_AGUA_PPM = 100.0f`, `tds0_ppm` permanece en `nan`.
  * **Auto-captura diferida (~60 s, mediana):** Para evitar congelar transitorios capacitivos de arranque (que causaban valores erráticos de 290 o 566 ppm), el detector no auto-fija `TDS0` durante los primeros 60 s (`TDS0_AUTO_TIEMPO_MIN_MS = 60000UL`). A partir de los 60 s, toma la **mediana** de las últimas 30 muestras válidas acumuladas en agua (`TDS0_AUTO_MUESTRAS = 30` en `sensores`, o 12 en `nodo`). (**Implementado en código, pendiente de verificar en hardware**).
  * **Fijado manual con tecla `0`:** Presionar `0` + Enter fija `TDS0` calculando la mediana de las muestras acumuladas en el búfer (si hay al menos 15 en `sensores` o 6 en `nodo`), o fallback a la última lectura si el búfer aún no tiene suficientes datos (**implementado en código, pendiente de verificar en hardware**).
* **Umbral de disparo:** Cuando $\text{tds\_ppm} > \text{TDS0} + 100\text{ ppm}$ (`UMBRAL_DELTA_TDS = 100.0f`) durante 3 ciclos consecutivos (`3 s` en `sensores`), se activa `anomalias = 2` (`ANO_TDS = 0x02`), `c_tds` sube `1 -> 2 -> 3` y `solicitud_captura` pasa a `1`.

#### 4.4.2 Comando exacto para abrir el monitor
```bash
cd /home/flauta/Documents/qawapmayu/herramientas && PRUEBA=cal_tds /home/flauta/.platformio/penv/bin/pio device monitor -e sensores
```

#### 4.4.3 Protocolo paso a paso (Solución concentrada de demo en ~500 mL)
> [!WARNING] **Límite de rango del KS0429 (0–1000 ppm):**
> Agregar sal seca directamente (incluso 1/4 de cucharadita) a un vaso de agua eleva la salinidad a miles de ppm de golpe, dejando el sensor fuera de rango, lectura no fiable. Por ello, la dosificación controlada para la demo se realiza mediante dilución de una **solución madre**:

1. **Preparar la solución madre concentrada:**
   * En un vasito o recipiente aparte, disolver **1/4 de cucharita rasa de sal** en **100 mL de agua**. Revolver hasta disolución completa.
2. **Preparar el recipiente de ensayo principal:**
   * Servir **~500 mL de agua de la llave limpia** en un vaso o jarra de boca ancha.
3. **Línea base `TDS0`:**
   * Sumergir la sonda TDS (y DS18B20).
   * Esperar ~60–70 s a que opere el auto-fijado diferido (o presionar **`0` + Enter** tras estabilizarse). Debe marcar `TDS0` en la base real (~160–180 ppm) y `c_tds = 0`.
   * Registrar 10 segundos de línea base estable en el CSV.
4. **Adición 1 (Dosis de 5 mL):**
   * Con una jeringa o cuchara medidora, verter **5 mL de la solución madre** dentro de los ~500 mL de agua de ensayo.
   * Agitar suavemente para homogeneizar. La lectura subirá en aproximadamente **+150 ppm** (*estimación:* +75 a +225 ppm, ±50%), superando el umbral de $\text{TDS0} + 100\text{ ppm}$ y provocando `c_tds = 1 -> 2 -> 3` y `solicitud_captura = 1`.
5. **Adición 2 (Segunda dosis de 5 mL, 10 mL acumulados):**
   * Agregar otros **5 mL de la solución madre**, mezclar y registrar el incremento escalonado (*estimación:* ~400–550 ppm).
6. **Adición 3 (Tercera dosis de 5 mL, 15 mL acumulados):**
   * Agregar otros **5 mL de la solución madre**, mezclar y registrar (*estimación:* ~550–700 ppm).
7. **Adición 4 (Cuarta dosis de 5 mL, 20 mL acumulados):**
   * **Máximo 4 adiciones; detener el ensayo al llegar a ~800 ppm**. Si alguna dosis previa ya acerca la lectura a ~800 ppm, parar el ensayo para no aproximarse al límite de 1000 ppm del sensor.
8. **Criterio de aprobado (Tabla 3 del informe):**
   * Respuesta monótona y reproducible dentro del rango lineal del sensor (0 a 1000 ppm).
   * Activación persistente de la anomalía al superar $\text{TDS0} + 100\text{ ppm}$ (`solicitud_captura = 1`).

#### 4.4.4 Plantilla de tabla para completar durante la sesión de TDS

* **Volumen de ensayo principal:** ~500 mL
* **Solución madre:** 1/4 cucharita rasa en 100 mL de agua
* **Archivo de evidencia generado:** `pruebas/sensores_<fecha_hora>_cal_tds.csv`

| Etapa / Muestra | Dosis acumulada | Tecla enviada | `temp_C` (°C) | `tds_mV` (mV) | `tds_ppm` (ppm) | `tds0_ppm` (ppm) | $\Delta\text{TDS} = \text{TDS} - \text{TDS0}$ (ppm) | `anomalias` (bit 2) | `c_tds` | `solicitud_captura` |
|---|---|---|---|---|---|---|---|---|---|---|
| Agua de la llave (Línea base) | 0 mL | `0` o auto | | | | | 0 | 0 | 0 | 0 |
| Agua + 5 mL sol. madre | 5 mL | — | | | | | | | | |
| Agua + 10 mL sol. madre | 10 mL | — | | | | | | | | |
| Agua + 15 mL sol. madre | 15 mL | — | | | | | | | | |
| Agua + 20 mL sol. madre | 20 mL | — | | | | | | | | |

---

## 5. Paso Final (Tras Completar los 4 Sensores): Reponer el Firmware `nodo`

Una vez terminadas las sesiones individuales en `herramientas/sensores`, el firmware `nodo` (`nodo/src/main.cpp`) cargará la calibración de **pH** (`ph_m`, `ph_b`, `ph_calibrado = true`) desde las constantes fijas de `comun/calibracion.h` y leerá la referencia de **Turbidez** (`vt0_mv`, `vt0_ok`) guardada en NVS `"cal"` (actualizada con `'t'` en `GPIO34`).

Para volver a cargar el programa definitivo del nodo (`nodo/src/main.cpp`) y verificar la integración:

1. **Subir el firmware `nodo` y abrir su monitor:**
   ```bash
   cd /home/flauta/Documents/qawapmayu/nodo && /home/flauta/.platformio/penv/bin/pio run -e nodo -t upload && PRUEBA=verificacion_final_nodo /home/flauta/.platformio/penv/bin/pio device monitor -e nodo
   ```
2. **Verificar la línea de arranque (`nodo/src/main.cpp:431-432`):**
   Debe imprimir:
   ```text
   boot_id=<N> evento_id=<M> ph_cal=1 vt0_cal=1 DS18B20=1
   ```
   *(Confirmando que pH está fijado por código, Turbidez está calibrada en NVS en GPIO34 y DS18B20 está detectado en GPIO32).*
3. **Presionar `e` + Enter** en el monitor del nodo (con los sensores en agua limpia):
   Debe mostrar `val=0x0F` (los 4 sensores válidos: `0x01 | 0x02 | 0x04 | 0x08 = 0x0F`), `ano=0x00` y `estado=ARMADO`.
