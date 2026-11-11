# Guía Maestra y Estado de Calibración de Sensores – QawapMayu (Nodo QM01)

**Última actualización:** 2026-11-11  
**Propósito:** Documento base autocontenido para ejecutar cada calibración y prueba de validación de sensores en sesiones/chats individuales antes del *code freeze* (13 de noviembre). Contiene el estado real de avance, el mapa de pines vigente, las protecciones de memoria NVS, los comandos exactos de consola y el protocolo paso a paso trazado al código fuente.

---

## 1. Resumen Ejecutivo de Estado y Avance por Sensor

| # | Sensor | Pin ESP32 | Estado actual | Resumen de resultados / Qué falta hacer |
|---|---|---|---|---|
| **1** | **pH (PH-4502C)** | `GPIO32` (ADC1_CH4, con divisor 10k/20k) | **CALIBRADO Y COMPROBADO** | **Completado (2026-11-10):** Calibrado con tiras reactivas 0–14 (`[RESOLUCION_TIRA] = 1`, incertidumbre $\pm 0.5$ pH).<br>• **Punto 1 (Vinagre diluido):** Tira = `3.00`, Sonda = `414.0 mV` (`sensores_20261110_221530_cal_ph_tiras.csv`).<br>• **Punto 2 (Agua con bicarbonato):** Tira = `9.00` (buffer químico ~8.3), Sonda = `2208.0 mV` (`sensores_20261110_231503_cal_ph_tiras.csv`).<br>• **Recta en NVS (`"cal"`):** $\text{pH} = 0.003344 \cdot \text{mV} + 1.6154$ (Sensibilidad: $299.0\text{ mV/pH}$).<br>• **Comprobación independiente (Agua de llave):** Tira = `7.00`, Sonda = `1650–1693 mV` $\rightarrow$ **pH `7.13–7.28`** ($\text{Error} = +0.13\text{ a }+0.28\text{ pH} \le 0.5\text{ pH}$, aprobado en `sensores_20261110_233020_comp_agua_llave.csv`).<br>• *Opcional:* Registrar 15 s en vinagre con la recta final para evidenciar el cruce ácido $\text{pH} < 6.5$ (`ANO_PH = 1`, `c_ph = 3`, `solicitud_captura = 1`). El umbral $> 8.5$ se documenta como *"no probado por seguridad de laboratorio"*. |
| **2** | **Temperatura (DS18B20)** | `GPIO33` (1-Wire, pull-up $4.7\text{ k}\Omega$ a 3.3V) | **PENDIENTE** *(Prioridad #1)* | **Estado actual:** En todos los logs de `pruebas/` sale `DS18B20 encontrados: 0` y `temp_C = -127.00` (`VAL_TEMP = 0`).<br>• En la Sesión S1 (`docs/bitacora.md:10-20`) funcionó entre 22 y 31 °C, pero hoy el cable de datos (`GPIO33`), alimentación o la resistencia pull-up de $4.7\text{ k}\Omega$ a `3.3 V` está suelta en la protoboard.<br>• **Qué hacer:** Corregir contacto físico en `GPIO33` hasta ver `DS18B20 encontrados: 1`, y medir **3 temperaturas seguras** (agua con hielo, agua de llave, agua tibia 35–40 °C) tomando **5 lecturas por punto** contra termómetro casero (criterio: $|T_{\text{DS18B20}} - T_{\text{ref}}| \le 1.0\,^{\circ}\text{C}$).<br>• *Importante:* Hacerlo antes de TDS porque `calcular_tds()` usa `temp_C` para compensar a 25 °C. |
| **3** | **Turbidez (TS-300B)** | `GPIO35` (ADC1_CH7, con divisor 10k/20k) | **PENDIENTE EN GPIO35** *(Prioridad #2)* | **Estado actual:** Existían pruebas en `GPIO4` (`VT0 = 2344 mV` en NVS y corridas con maicena `r1–r3` del 2026-11-09). Sin embargo, el 2026-11-10 se migró `PIN_TURB` en código a **`GPIO35`** para eliminar ADC2.<br>• En los logs del 2026-11-10 (`sensores_20261110_233020_comp_agua_llave.csv`), `turb_mV` en `GPIO35` leyó `~1690–1800 mV` (`it = nan`), por debajo del piso `TURB_MIN_AGUA_CLARA_MV = 2000 mV`.<br>• **Qué hacer:** (1) Verificar en protoboard que la salida del divisor 10k/20k del TS-300B esté firme en **`GPIO35`** y en agua limpia marque `2000–3250 mV`; (2) presionar **`t`** para guardar el nuevo `VT0` en NVS; (3) ejecutar la prueba de **pico aislado** ($< 3$ ciclos $\rightarrow$ `c_turb` llega a `1` o `2` y vuelve a `0` con **`solicitud_captura = 0`**). |
| **4** | **TDS (Keyestudio KS0429)** | `GPIO34` (ADC1_CH6, directo 0–2.3V) | **PENDIENTE ENSAYO CON SAL** *(Prioridad #3)* | **Estado actual:** En logs de `sensores_20261110_*.csv` la sonda estuvo en el aire (`142 mV`, `58 ppm`, `tds0_ppm = nan`). En logs antiguos (`serial_20261108_111841.log:984`) solo se auto-fijó `TDS0 = 100 ppm` al sumergir.<br>• **Qué hacer:** Sumergir en un **volumen fijo** de agua de la llave, esperar estabilidad (~250–310 ppm), presionar **`0`** para fijar `TDS0` en RAM, y añadir progresivamente **1, 2 y 3 cucharadas rasas de sal con la MISMA cuchara**, verificando incremento reproducible y disparo (`anomalias = 2`, `c_tds = 3`, `solicitud_captura = 1`) al superar $\text{TDS0} + 100\text{ ppm}$. |

---

## 2. Reglas Críticas de Hardware, Pines y Protección de NVS

### 2.1 Mapa de pines vigente en código (`herramientas/src/sensores.cpp`, `nodo/src/main.cpp`, `comun/hardware.h`)

| Canal / Función | Macro en código | Pin ESP32 | Convertidor / Bus | Rango válido en código (`comun/anomalia.h`) |
|---|---|---|---|---|
| **pH (PH-4502C)** | `PIN_PH` | **`GPIO32`** | `ADC1_CH4` | `20 mV <= ph_mV <= 3100 mV` (`PH_MIN_VALIDO_MV`, `PH_MAX_VALIDO_MV`) |
| **Temperatura (DS18B20)** | `PIN_TEMP` | **`GPIO33`** | `1-Wire` (pull-up $4.7\text{ k}\Omega$ a `3V3`) | `-10.0 °C < temp_C < 60.0 °C` y `!= -127.00 °C` |
| **TDS (KS0429)** | `PIN_TDS` | **`GPIO34`** | `ADC1_CH6` (solo entrada) | `tds_mV <= 2500 mV` (`TDS_MAX_VALIDO_MV`) |
| **Turbidez (TS-300B)** | `PIN_TURB` | **`GPIO35`** | `ADC1_CH7` (solo entrada, divisor 10k/20k) | Conectado: `>= 300 mV`. Agua clara (`VT0`): `2000 mV <= turb_mV <= 3250 mV` |
| **LED simulador bomba** | `PIN_LED_SIM` / `PIN_LED` | **`GPIO2`** | Salida digital | `HIGH` cuando `solicitud_captura == 1` |
| **Relé de bomba (Nodo)** | `PIN_RELE` | **`GPIO23`** | Salida digital (`RELE_ACTIVO_BAJO = true`) | **Bomba de 12 V DESCONECTADA durante pruebas en `sensores`** |

### 2.2 ¡CUIDADO! Teclas que borran o sobrescriben la memoria NVS

El ESP32 del nodo guarda la calibración permanente en la partición NVS bajo el namespace **`"cal"`**:
* Claves de pH: `"ph_m"` (`float`), `"ph_b"` (`float`), `"ph_ok"` (`bool`).
* Claves de Turbidez: `"vt0_mv"` (`float`), `"vt0_ok"` (`bool`).
* *(Nota: `TDS0` no se guarda en NVS; vive únicamente en RAM en `det.tds0` y se fija en cada arranque o con la tecla `0`).*

**Reglas para NO perder la calibración de pH ya guardada:**
1. **PROHIBIDO enviar la tecla `b` en `sensores`:** En `herramientas/src/sensores.cpp:224-230`, el comando `b` ejecuta `nvs.clear()` sobre todo el namespace `"cal"`, borrando tanto el pH como la turbidez. Si alguna vez se borra por accidente, restaurar inmediatamente el pH enviando:
   ```text
   ph 3 414
   ph 9 2208
   c
   s
   ```
   *(o directamente `setph 0.003344 1.6154`)*.
2. **Precaución con la tecla `t`:** En `sensores` (`sensores.cpp:231-245`) y en `nodo` (`main.cpp:348-364`), `t` sobrescribe `"vt0_mv"` en NVS `"cal"` si la lectura en `GPIO35` está entre `2000` y `3250 mV`. Presionar `t` **únicamente cuando el sensor TS-300B esté sumergido en agua clara limpia**.
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
| `ph <val>` | Captura la mediana de 201 muestras del ADC en `GPIO32` para el pH de referencia `<val>` (ej. `ph 3`, `ph 9`). Además, `filter_evidencia.py` respalda el punto automáticamente en `pruebas/calibracion.log`. |
| `ph <val> <mV>` | Inyecta manualmente en RAM un punto $(\text{pH}, \text{mV})$ medido previamente sin necesidad de sumergir la sonda de nuevo (ej. `ph 3 414`). |
| `c` | Calcula por mínimos cuadrados ordinarios (OLS) la recta $\text{pH} = \text{ph\_m} \cdot \text{mV} + \text{ph\_b}$ con los puntos cargados ($n \ge 2$) e imprime la sensibilidad y el error residual de cada punto. |
| `s` | Guarda `ph_m`, `ph_b` y `ph_ok = true` en el namespace NVS `"cal"`. |
| `setph <m> <b>` | Escribe directamente `ph_m = <m>`, `ph_b = <b>` y `ph_ok = true` en NVS `"cal"` en un solo paso (ej. `setph 0.003344 1.6154`). |
| `0` | Fija la referencia `det.tds0` (en RAM) al valor actual de `tds_ppm`, reinicia `c_tds = 0` y apaga el bit `ANO_TDS`. |
| `t` | Mide la mediana de 201 muestras en `GPIO35` y, si está en `[2000, 3250] mV`, guarda `vt0_mv` y `vt0_ok = true` en NVS `"cal"`. |
| `r` | Reinicia a `0` todos los contadores de persistencia (`c_ph`, `c_tds`, `c_turb`, `c_normales`), limpia `solicitud_captura = 0` y apaga el LED en `GPIO2`. |
| `p` | Pausa o reanuda la impresión de líneas CSV cada segundo (útil para escribir comandos con calma). |
| `h` | Imprime la lista de comandos, el estado actual de calibración (`pH`, `TDS0`, `VT0`) y vuelve a imprimir la cabecera CSV. |
| `b` | **¡PELIGRO!** Borra todo el namespace NVS `"cal"` (`ph` y `vt0`). **No usar.** |

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

### SENSOR 1: pH (PH-4502C en `GPIO32`) — [COMPLETADO]

#### 4.1.1 Qué se hizo y parámetros finales en NVS
* **Condiciones metodológicas:** Sin buffers certificados disponibles, se calibró con tiras reactivas de 4 almohadillas de escala entera 0–14 (`[RESOLUCION_TIRA] = 1 unidad de pH`, incertidumbre visual $\pm 0.5\text{ pH}$, tiempo de lectura de tira = $40\text{ s}$).
* **Puntos de calibración (soluciones extremas):**
  1. **Vinagre blanco diluido (Ácido):** Tira = `3.00`, mediana estabilizada en `GPIO32` = **`414 mV`**.
  2. **Agua con bicarbonato de sodio (Base suave):** Tira leída en escala entera = `9.00` (el pH químico teórico de una solución saturada de $\text{NaHCO}_3$ es ~8.3–8.6), mediana estabilizada = **`2208 mV`**.
* **Ecuación lineal guardada en NVS (`"cal"`):**
  $$\text{pH} = 0.003344 \cdot \text{mV} + 1.6154 \qquad (\text{Sensibilidad} = 299.0\text{ mV/pH})$$
  *(Nota técnica: Si se evalúa con el valor químico teórico de 8.30 para el bicarbonato, la recta es $\text{pH} = 0.002954 \cdot \text{mV} + 1.7769$, dando $\text{pH} = 6.77–6.84$ en agua de llave. Ambas rectas cumplen holgadamente el criterio $\le 0.5\text{ pH}$).*
* **Comprobación independiente (Agua de la llave — NO usada en la regresión):**
  * Tira reactiva en agua de la llave = **`7.00`**.
  * Voltaje estabilizado en agua de la llave (`sensores_20261110_233020_comp_agua_llave.csv`) = **`1650 – 1693 mV`**.
  * Lectura de la sonda con la recta $0.003344 \cdot \text{mV} + 1.6154$ = **`7.13 – 7.28`**.
  * **Error independiente:** $|\text{pH}_{\text{sonda}} - \text{pH}_{\text{tira}}| = +0.13\text{ a }+0.28\text{ pH} \le 0.50\text{ pH}$ (**APROBADO**).

#### 4.1.2 Tabla de resultados cerrada (para el informe)

| Solución | Rol | pH tira (escala entera) | `ph_mV` estable (mV) | pH sonda | Error ($\text{pH}_{\text{sonda}} - \text{pH}_{\text{tira}}$) | Evidencia en `pruebas/` |
|---|---|---|---|---|---|---|
| Vinagre blanco diluido | Punto 1 (Calibración) | 3 | 414 | 3.00 | 0.00 | `sensores_20261110_221530_cal_ph_tiras.csv` |
| Agua con bicarbonato | Punto 2 (Calibración) | 9 *(buffer ~8.3)* | 2208 | 9.00 | 0.00 | `sensores_20261110_231503_cal_ph_tiras.csv` |
| Agua de la llave | **Comprobación independiente** | 7 | 1650 – 1693 | 7.13 – 7.28 | **+0.13 a +0.28** | `sensores_20261110_233020_comp_agua_llave.csv` |

#### 4.1.3 Verificación rápida opcional del cruce de umbral ácido ($\text{pH} < 6.5$)
Si al iniciar la próxima sesión quieres dejar un archivo `.log` corto donde se vea la recta final `pH = 0.003344 * mV + 1.6154` guardada en NVS y el disparo en vinagre ($\text{pH} \approx 3.0 < 6.5$):
1. Ejecutar:
   ```bash
   cd /home/flauta/Documents/qawapmayu/herramientas && PRUEBA=cruce_umbral_ph /home/flauta/.platformio/penv/bin/pio device monitor -e sensores
   ```
2. Con la sonda en agua de la llave, enviar:
   ```text
   ph 3 414
   ph 9 2208
   c
   s
   r
   ```
3. Verificar 5 filas en agua de la llave con `pH` ~`7.1–7.3`, `anomalias = 0`, `c_ph = 0`, `solicitud_captura = 0`.
4. Pasar la sonda al vaso con vinagre diluido y esperar 10 segundos: verás que `pH` baja de `6.5`, `anomalias` cambia a `1`, `c_ph` cuenta `1 -> 2 -> 3` y sale `>> [DISPARO] solicitud_captura = 1 (c_tds=0, c_ph=3, c_turb=0, anomalias=0x01)`.
5. Enjuagar la sonda con abundante agua limpia y cerrar con `Ctrl + C`.

---

### SENSOR 2: Temperatura (DS18B20 en `GPIO33`) — [PENDIENTE - HACER PRIMERO]

#### 4.2.1 Por qué sale `-127.00` hoy y cómo solucionarlo en la protoboard
En todos los archivos actuales de `pruebas/`, `ds.getDeviceCount()` devuelve `0` y `ds.getTempCByIndex(0)` devuelve `-127.00` (`DEVICE_DISCONNECTED_C`). Esto ocurre cuando el bus 1-Wire en **`GPIO33`** está abierto o sin su resistencia pull-up.

**Pasos de revisión física (con el USB del ESP32 desconectado):**
1. Seguir los 3 cables de la sonda impermeable DS18B20:
   * **Rojo (`VCC`):** debe ir firme al riel de **`3.3 V`** (`3V3` del ESP32).
   * **Negro (`GND`):** debe ir firme al riel de **`GND`** común.
   * **Amarillo (`DATA`):** debe ir conectado a la fila del pin **`GPIO33`** del ESP32.
2. **Verificar la resistencia pull-up de $4.7\text{ k}\Omega$:**
   * Debe haber una resistencia de **$4.7\text{ k}\Omega$** (amarillo-violeta-rojo o amarillo-violeta-negro-marrón) conectada **entre la fila de `GPIO33` (cable amarillo) y el riel de `3.3 V` (cable rojo)**.
   * *Tip con multímetro (sin USB):* Medir resistencia entre el pin `GPIO33` del ESP32 y el pin `3V3` del ESP32 $\rightarrow$ debe marcar **$\approx 4.7\text{ k}\Omega$**, y continuidad ($0\text{ }\Omega$) entre `GPIO33` y la unión del cable amarillo.

#### 4.2.2 Comando exacto para abrir el monitor
```bash
cd /home/flauta/Documents/qawapmayu/herramientas && PRUEBA=cal_temp /home/flauta/.platformio/penv/bin/pio device monitor -e sensores
```

#### 4.2.3 Líneas que deben salir al quedar bien conectado
1. Al arrancar el ESP32 (`herramientas/src/sensores.cpp:164`):
   ```text
   QawapMayu - sensores. DS18B20 encontrados: 1
   ```
   *(Si sigue diciendo `encontrados: 0`, mover/apretar las patillas de la resistencia de $4.7\text{ k}\Omega$ y el jumper de `GPIO33` y pulsar el botón físico `EN/RST` del ESP32 hasta que diga `1`).*
2. En las filas CSV cada segundo:
   * La columna 2 (`temp_C`) dejará de ser `-127.00` y mostrará la temperatura ambiente (ej. `23.50`).
   * La columna 9 (`validez`) sumará **`+8`** (`VAL_TEMP = 0x08`). Por ejemplo, si antes `validez` era `3` (pH + TDS), ahora pasará a **`11`** (`3 + 8`), o **`15`** si los 4 sensores están activos.

#### 4.2.4 Protocolo de comparación en 3 temperaturas seguras (5 lecturas por punto)
1. **Anotar datos del termómetro de referencia casero:** Tipo de termómetro y su resolución mínima (`[RESOLUCION_TERMOMETRO]`, ej. `0.1 °C` o `1 °C`).
2. **Preparar 3 vasos con agua a temperaturas seguras dentro de `(-10, 60) °C`:**
   * **Punto 1 (Fría):** Agua con cubos de hielo (~`2 a 8 °C`).
   * **Punto 2 (Ambiente):** Agua de la llave (~`20 a 25 °C`).
   * **Punto 3 (Tibia):** Agua tibia entre **`35 y 40 °C`** (mezclar agua caliente con agua fría).
3. **Procedimiento en cada vaso:**
   * Sumergir juntas la punta metálica del DS18B20 y el bulbo/punta del termómetro de referencia en el centro del líquido (sin tocar las paredes ni el fondo).
   * Esperar **1 a 2 minutos** hasta que ambas lecturas se estabilicen.
   * Tomar **5 lecturas espaciadas cada 5 segundos** anotando simultáneamente lo que marca el termómetro casero ($T_{\text{ref}}$) y la columna `temp_C` del CSV ($T_{\text{DS18B20}}$).
4. **Criterio de aprobado (Tabla 3 del informe):**
   * El error absoluto promedio en cada punto debe cumplir:
     $$|T_{\text{DS18B20}} - T_{\text{ref}}| \le 1.0\,^{\circ}\text{C}$$
   * La columna `validez` debe mantener el bit `VAL_TEMP` (`+8`) encendido en todas las muestras.

#### 4.2.5 Plantilla de tabla para completar durante la sesión de Temperatura

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

#### 4.3.1 Qué verificar primero en el cableado de `GPIO35`
El sensor óptico TS-300B se alimenta con `5 V` (`VIN`) y entrega hasta `~4.5 V` en agua clara, por lo que **requiere obligatoriamente el divisor resistivo $10\text{ k}\Omega$ (arriba) / $20\text{ k}\Omega$ (abajo a GND)** para escalar la señal por $\times \frac{2}{3}$ y proteger el ESP32 ($\le 3.3\text{ V}$).
* **Nota importante del cambio de pin:** Antes el cable del punto medio del divisor iba a `GPIO4`. Tras la actualización del 2026-11-10 (`comun/hardware.h:14`), el código lee **`PIN_TURB = 35` (`GPIO35`)**.
* En los logs del 2026-11-10, `turb_mV` en `GPIO35` marcó `~1690–1800 mV` porque el sensor estaba fuera del agua clara, con gotas/suciedad en las paredes ópticas o el cable seguía en `GPIO4`.
* **Requisito del código (`comun/anomalia.h:24-25`):** Para que el firmware acepte guardar la referencia de agua clara `VT0` con la tecla `t`, la lectura `turb_mV` en `GPIO35` **debe estar entre `2000 mV` y `3250 mV`** (en agua limpia suele dar entre `2300` y `3100 mV`).

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
8. *(Opcional en la misma sesión o archivo separado `PRUEBA=turb_persistente`):* Si luego quieres dejar también una evidencia de anomalía persistente de turbidez en `GPIO35`, obstruir o enturbiar con maicena por $\ge 3$ segundos para ver `c_turb = 1 -> 2 -> 3` y `solicitud_captura = 1`, y luego limpiar y pulsar `r`.

#### 4.3.4 Plantilla de tabla para completar durante la sesión de Turbidez (Pico Aislado)

* **Referencia `VT0` guardada en NVS (`GPIO35`):** `vt0_mV` = ______ mV (Umbral de anomalía: $V_T < 0.80 \times V_{T0} =$ ______ mV $\iff \text{IT} > 0.200$)
* **Archivo de evidencia generado:** `pruebas/sensores_<fecha_hora>_turb_pico.csv`

| Ciclo / Muestra | `ms` del CSV | Condición física | `vt0_mV` (mV) | `turb_mV` (mV) | `it` | `anomalias` (bit 4) | `c_turb` | `solicitud_captura` | ¿Activó bomba / disparo? |
|---|---|---|---|---|---|---|---|---|---|
| $k=0$ (Base) | | Agua clara limpia (`t`, `r`) | | | | 0 | 0 | 0 | No |
| $k=1$ (Pico) | | Perturbación transitoria (1 s) | | | $> 0.200$ | 4 | 1 | 0 | No |
| $k=2$ (Pico / Retiro) | | Perturbación (2 s) o retiro | | | | | 2 (o 0) | 0 | No |
| $k=3$ (Recuperación) | | Agua clara tras retiro | | | $\le 0.200$ | 0 | **0** | **0** | **No (Aprobado)** |
| $k=4$ (Estable) | | Agua clara estable | | | $\le 0.200$ | 0 | 0 | 0 | No |

---

### SENSOR 4: TDS Keyestudio KS0429 en `GPIO34` (Línea Base `TDS0` y Adición de Sal) — [PENDIENTE]

#### 4.4.1 Fundamento en el código (`herramientas/src/sensores.cpp` y `comun/anomalia.h`)
* Lee `PIN_TDS = 34` (`GPIO34`). Si `temp_C` del DS18B20 es válida, compensa térmicamente a 25 °C:
  $$V_{\text{comp}} = \frac{V}{1 + 0.02(T - 25.0)}, \qquad \text{TDS}_{\text{ppm}} = 0.5 \left(133.42\,V_{\text{comp}}^3 - 255.86\,V_{\text{comp}}^2 + 857.39\,V_{\text{comp}}\right)$$
* **Cómo funciona `TDS0`:**
  * Mientras la sonda está en el aire (~`142 mV`, ~`58 ppm`), como es menor a `TDS_MIN_AGUA_PPM = 100.0f`, `tds0_ppm` permanece en `nan`.
  * Apenas la sonda entra al agua y supera `100 ppm`, se auto-fija en el primer valor que cruce `100 ppm`. **Por eso es indispensable esperar 30–60 s a que se estabilice en el agua de la llave y presionar `0` + Enter** para fijar `TDS0` en el valor real estacionario del agua limpia (~`200–310 ppm`).
* **Umbral de disparo:** Cuando $\text{tds\_ppm} > \text{TDS0} + 100\text{ ppm}$ (`UMBRAL_DELTA_TDS = 100.0f`) durante 3 ciclos consecutivos (`3 s` en `sensores`), se activa `anomalias = 2` (`ANO_TDS = 0x02`), `c_tds` sube `1 -> 2 -> 3` y `solicitud_captura` pasa a `1`.

#### 4.4.2 Comando exacto para abrir el monitor
```bash
cd /home/flauta/Documents/qawapmayu/herramientas && PRUEBA=cal_tds /home/flauta/.platformio/penv/bin/pio device monitor -e sensores
```

#### 4.4.3 Protocolo paso a paso (Volumen fijo y adiciones con la MISMA cuchara)
1. **Medir un volumen fijo de agua de la llave** en un vaso limpio (ej. `200 mL` o `250 mL` medidos con vaso medidor/taza) y anotar el volumen `[VOLUMEN_AGUA_ML]`.
2. **Sumergir la sonda TDS** (y la sonda DS18B20 si ya está lista) asegurando que las dos puntas metálicas queden completamente sumergidas y sin burbujas, a más de 2 cm de las paredes del vaso.
3. Esperar **30 a 60 segundos** hasta que las columnas `tds_mV` y `tds_ppm` estén completamente quietas.
4. **Fijar `TDS0` manualmente:** Escribir **`0` + Enter** en el monitor. Debe imprimirse:
   ```text
   >> TDS0 fijado manualmente en <tds0> ppm (umbral disparo > <tds0+100> ppm).
   ```
   *(Si algún otro sensor hubiera disparado antes, enviar también **`r` + Enter** para dejar `solicitud_captura = 0`).*
5. Dejar registrar **10 segundos** de línea base estable (`c_tds = 0`, `solicitud_captura = 0`) y anotar los valores en la primera fila de la tabla.
6. **Adición 1 (1 cucharada rasa):** Con una **misma cucharita pequeña**, agregar 1 medida rasa de sal común (NaCl), revolver suavemente hasta disolver por completo, dejar el agua quieta 20–30 segundos y anotar `tds_mV`, `tds_ppm`, $\Delta\text{TDS} = \text{tds\_ppm} - \text{TDS0}$, `anomalias`, `c_tds` y `solicitud_captura`.
   * *Nota:* Si ya en la 1.ª cucharada se superó $\text{TDS0} + 100\text{ ppm}$ y se disparó `solicitud_captura = 1`, anotar el disparo; puedes presionar `r` + Enter antes de la siguiente cucharada si quieres volver a ver el conteo `1 -> 2 -> 3` (¡no presiones `0` para no sobrescribir `TDS0`!).
7. **Adición 2 (2 cucharadas acumuladas):** Añadir una 2.ª cucharada rasa con la **misma cuchara**, disolver, esperar estabilidad y registrar en la tabla.
8. **Adición 3 (3 cucharadas acumuladas):** Añadir una 3.ª cucharada rasa con la **misma cuchara**, disolver, esperar estabilidad y registrar en la tabla.
9. **Criterio de aprobado (Tabla 3 del informe):**
   * Aumento estrictamente monótono y reproducible de `tds_ppm` con cada cucharada añadida.
   * Detección automática al superar $\text{TDS0} + 100\text{ ppm}$: aparición de `>> [DISPARO] solicitud_captura = 1 (c_tds=3, ..., anomalias=0x02)`.

#### 4.4.4 Plantilla de tabla para completar durante la sesión de TDS

* **Volumen fijo de agua de la llave:** `[VOLUMEN_AGUA_ML]` = ______ mL
* **Descripción de la cuchara empleada:** ___________________________
* **Archivo de evidencia generado:** `pruebas/sensores_<fecha_hora>_cal_tds.csv`

| Etapa / Muestra | Cucharadas acumuladas | Tecla enviada | `temp_C` (°C) | `tds_mV` (mV) | `tds_ppm` (ppm) | `tds0_ppm` (ppm) | $\Delta\text{TDS} = \text{TDS} - \text{TDS0}$ (ppm) | `anomalias` (bit 2) | `c_tds` | `solicitud_captura` |
|---|---|---|---|---|---|---|---|---|---|---|
| Agua de la llave (Línea base) | 0 | `0` | | | | | 0 | 0 | 0 | 0 |
| Agua + 1 cucharada de sal | 1 | — | | | | | | | | |
| Agua + 2 cucharadas de sal | 2 | — | | | | | | | | |
| Agua + 3 cucharadas de sal | 3 | — | | | | | | | | |

---

## 5. Paso Final (Tras Completar los 4 Sensores): Reponer el Firmware `nodo`

Una vez terminadas las sesiones individuales en `herramientas/sensores`, la calibración de **pH** (`ph_m`, `ph_b`, `ph_ok`) y de **Turbidez** (`vt0_mv`, `vt0_ok`) ya estará guardada en la memoria NVS `"cal"` del ESP32.

Para volver a cargar el programa definitivo del nodo (`nodo/src/main.cpp`) y verificar que lee la NVS correctamente:

1. **Subir el firmware `nodo` y abrir su monitor:**
   ```bash
   cd /home/flauta/Documents/qawapmayu/nodo && /home/flauta/.platformio/penv/bin/pio run -e nodo -t upload && PRUEBA=verificacion_final_nodo /home/flauta/.platformio/penv/bin/pio device monitor -e nodo
   ```
2. **Verificar la línea de arranque (`nodo/src/main.cpp:431-432`):**
   Debe imprimir:
   ```text
   boot_id=<N> evento_id=<M> ph_cal=1 vt0_cal=1 DS18B20=1
   ```
   *(Confirmando que tanto pH como Turbidez están calibrados en NVS y que el DS18B20 está detectado).*
3. **Presionar `e` + Enter** en el monitor del nodo (con los sensores en agua limpia):
   Debe mostrar `val=0x0F` (los 4 sensores válidos: `0x01 | 0x02 | 0x04 | 0x08 = 0x0F`), `ano=0x00` y `estado=ARMADO`.
