# Contexto maestro para el Informe P2 (QawapMayu)

Este documento consolida toda la auditoría técnica del código (`HEAD = 46d3e23`), la evidencia experimental en `pruebas/`, el mapeo línea por línea del fuente LaTeX original (`informes/p1/main.tex`) y la rúbrica oficial de evaluación P2.

---

## 1. Rúbrica Oficial P2 (Parseada de imagen oficial)

Puntaje total: **20 puntos**.

| Criterio | Peso | Nivel Sobresaliente (Meta máxima) | Nivel Logrado | Nivel En Proceso | Nivel Inicial (0 pts) |
|---|---|---|---|---|---|
| **2.2 Implementar soluciones computacionales para satisfacer un conjunto determinado de requerimientos.** | **3 pts** | **(3 a >2 pts)** Interpreta la solución diseñada y propone estrategias para su implementación, escogiendo justificadamente la estrategia más adecuada. Implementa la solución de diseño a través de un código limpio y modular aplicando estándares y buenas prácticas. Usa de manera eficiente las herramientas de desarrollo de software (IDE, control de versiones, estructuras, librerías, etc.). | **(2 a >1 pts)** Interpreta la solución diseñada y propone estrategias para su implementación. Implementa la solución de diseño a través de un código limpio y modular. Usa las herramientas de desarrollo de software adecuadas para el diseño (IDE, control de versiones, estructuras, librerías, etc.). | **(1 a >0 pts)** Presenta dificultades para proponer estrategias de implementación y desarrollar código limpio y modular. Usa algunas herramientas de desarrollo de software para el diseño y presenta dificultades en su aplicación. | No logra proponer estrategias de implementación debido a deficiencias en el desarrollo de los códigos y la modularidad. El uso de herramientas de software es limitado o inadecuado. |
| **5.1 Puede desempeñarse como líder o miembro activo de un equipo de trabajo aportando con iniciativa para alcanzar las metas propuestas.** | **3 pts** | **(3 a >2 pts)** Participa y colabora activamente de manera constante, eficaz y con alto compromiso. Lidera con iniciativa, propone mejoras y conduce al equipo hacia el logro de los objetivos. Cumple metas y asume responsabilidad por los resultados del equipo. | **(2 a >1 pts)** Participa y colabora de manera activa y responsable en el trabajo del equipo. Contribuye al logro de los objetivos del grupo y puede asumir algunas iniciativas. Cumple las metas que se le asignaron y asume responsabilidad por sus resultados. | **(1 a >0 pts)** Participa irregularmente en el trabajo del equipo y espera siempre las indicaciones por parte de los demás. Cumple algunas de las metas o funciones asignadas, por lo que no contribuye de forma comprometida a los objetivos del grupo. | No participa activamente en el trabajo del equipo y depende constantemente de las indicaciones de los demás. No cumple las metas o funciones asignadas, lo que afecta los objetivos del grupo. |
| **5.2 Colaborar activamente con otros, priorizando los objetivos comunes sobre el éxito individual.** | **2 pts** | **(2 a >1 pts)** Valora las ideas de otros y las integra de manera constructiva para enriquecer el análisis y la toma de decisiones. Maneja desacuerdos con respeto, promueve un clima positivo, y facilita acuerdos. Promueve la integridad, inclusión y armonía del grupo priorizando los objetivos comunes del equipo de trabajo. | **(1 a >0.5 pts)** Valora y considera las ideas de otros durante el trabajo en equipo, pero no necesariamente las integra en el trabajo. Maneja desacuerdos de manera respetuosa y contribuye a mantener un clima adecuado en el grupo. Promueve relaciones de respeto e inclusión orientadas al logro de los objetivos comunes del equipo. | **(0.5 a >0 pts)** Escucha las ideas de otro pero no las considera en el trabajo. Se le complica manejar desacuerdos, lo que genera limitaciones en la comunicación y la colaboración grupal. Mantiene las relaciones cordiales en el equipo aunque no se preocupa de integrarse. | No considera las ideas de otro en el trabajo en equipo. Tiene dificultades para manejar desacuerdos. Su integración al equipo es limitada. |
| **Presentación: Calidad del PPT y Presentación de Resultados.** | **3 pts** | **(3 a >2 pts)** Diapositivas de muy buena calidad y ordenadas. Los resultados se presentan con total claridad, gráficos pertinentes y son coherentes con el informe. | **(2 a >1 pts)** Contiene la información necesaria con algunos gráficos. Buena presentación de resultados, pero con pequeña inconsistencia o falta de detalle. | **(1 a >0 pts)** Calidad básica; las diapositivas son en su mayoría texto. Los resultados se mencionan, pero los gráficos son limitados o falta claridad. | Baja calidad de diapositivas, errores ortográficos. No se presentan resultados o no son coherentes con el proyecto implementado. |
| **Presentación: Fluidez y dominio del tema.** | **2 pts** | **(2 a >1.5 pts)** Muestra claridad, ritmo constante y dominio total del contenido técnico, sin depender de la lectura. | **(1.5 a >1 pts)** Buena fluidez y dominio del contenido, con pausas menores o dependencia mínima de las notas. | **(1 a >0 pts)** Se entiende el contenido, pero hay inconsistencias en el ritmo, presentación titubeante o lectura moderada/constante de notas. | No hay fluidez, ritmo inadecuado, improvisación y falta evidente de manejo del contenido. |
| **Video Publicitario: Calidad y Creatividad.** | **2 pts** | **(2 a >1.5 pts)** Video de alta calidad, muy creativo y convincente. Muestra el prototipo real y a los integrantes. Humor efectivo y narrativa original. | **(1.5 a >1 pts)** Buen estilo publicitario y creatividad. Se muestra el prototipo real, aunque algún integrante participe menos o la narrativa sea más simple. | **(1 a >0 pts)** Video básico o limitado. Muestra el prototipo pero falta creatividad, la narrativa es confusa, o hay ausencias de integrantes. | No cumple con el formato, sin creatividad, o es 100% generado por IA. |
| **Informe: Estructura, Estado del Arte y Metodología.** | **3 pts** | **(3 a >2 pts)** Cumple toda la estructura. Análisis profundo del estado del arte respondiendo las 4 preguntas. Incluye diagrama metodológico bien sustentado. | **(2 a >1 pts)** Faltan 1-2 secciones. Buen análisis del estado del arte (3/4 preguntas). Metodología con diagrama pero explicación algo superficial. | **(1 a >0 pts)** Faltan 3-4 secciones. Análisis superficial (antiguo/incompleto). Diagrama metodológico presente pero con conexión débil al estado del arte. | Estructura muy deficiente o incorrecta. No presenta Estado del Arte válido ni Metodología (o es generado por IA sin sentido). |
| **Informe: Resultados, Conclusiones y Referencias.** | **2 pts** | **(2 a >1.5 pts)** Resultados con figuras/tablas originales, buen análisis de mercado, conclusiones sólidas y referencias uniformes (IEEE). | **(1.5 a >1 pts)** Se cumplen la mayoría de requisitos, aunque falta detalle en el análisis o la uniformidad de referencias (IEEE) es dudosa. | **(1 a >0 pts)** Resultados muy básicos, conclusiones débiles o faltan elementos clave (ej. análisis de mercado); formato de referencias incorrecto. | No presenta resultados técnicos, conclusiones o referencias de manera absoluta. |

---

## 2. Diagnóstico de Brechas: Lo que falta hacer según la Rúbrica P2

### 2.1 Brechas en el Informe LaTeX (`informes/p1/main.tex`)

1. **Portada y encabezados desactualizados (`L46-61`, `L157`, `L185-193`)**:
   - Dice `Perfil de proyecto P1 -- Semana 07`, fecha `23 de septiembre de 2026`, y lleva un descargo diciendo que los valores no constituyen resultados experimentales. Debe actualizarse a **Informe P2** con fecha de noviembre de 2026 y reflejar que presenta la implementación real y resultados experimentales.
2. **Falta sección o subsección de "Evolución de Ingeniería y Cambios respecto al Perfil P1"**:
   - Debe explicarse explícitamente por qué se migró de EBYTE E32 (433 MHz, pines M0/M1/AUX) a **RAK3272S / RAK3172** (923.5 MHz, comandos AT RUI3), el sensor de turbidez analógico **TS-300B en GPIO35 (ADC1_CH7)** con divisor 10k/20k, pH en **GPIO32 (ADC1_CH4)**, de DS18B20 en GPIO4 a **GPIO33**, y de batería 12 V a alimentación de laboratorio (USB + fuente 12 V DC con interruptor físico).
3. **Estado del Arte: las "4 preguntas" de la rúbrica (`L308-398`)**:
   - Actualmente tiene la Tabla 1 (8 artículos) y 4 ejes temáticos (`4.2.1` a `4.2.4`). Para asegurar los 3 puntos de "respondiendo las 4 preguntas", conviene explicitar o verificar que las 4 subsecciones respondan claramente las 4 preguntas guía del curso (contexto/tecnologías empleadas, brechas/limitaciones de los trabajos previos, aportes transferibles al proyecto, y diferenciación/justificación de la propuesta).
4. **Diagramas TikZ y Metodología con hardware antiguo (`L399-1203`)**:
   - **Figura 1 (`L409-510`)**: dice `EBYTE E32 nodo` y `E32 + ESP32` (`L477`, `L485`). Cambiar a `RAK3272S nodo` y `RAK3272S + ESP32`.
   - **Tabla 2 (`L522-589`)**: actualizar con los componentes y pines reales (ver Sección 4.1 abajo).
   - **Figura 2 (`L602-783`)**: dice `E32 nodo (UART) / M0, M1, AUX` (`L724`) y `E32 + ESP32 GW01` (`L733`). Cambiar a `RAK3272S (UART2 AT)`.
   - **Pseudocódigo (`L1081-1159`)**:
     - `L1090-1091`: dice que `reinicio_durante_bombeo()` lleva a `BLOQUEADO`, contradiciendo `L1077` (`FALLO`). En `nodo/src/main.cpp:421-424` lleva a `EST_FALLO` (guardando `bloqueado=true` en NVS).
     - `L1129-1138`: en el código real (`nodo/src/main.cpp:230-238`), la trama `EST_MUESTREANDO` se envía por LoRa **antes** de encender el relé (`rele(true)`), y no existen `frasco_disponible()`, `frasco_reemplazado()` ni `atender_watchdog_hardware()`.
   - **Sección 5.10 (`L1197-1202`)**: eliminar mención a M0 (GPIO21), M1 (GPIO22) y AUX (GPIO19) del EBYTE E32 y documentar la secuencia AT RUI3 (`AT+NWM=0`, `AT+P2P=923500000:7:125:0:10:14`, `AT+PSEND`, `AT+PRECV=65534`) y la trama binaria empaquetada de 27 bytes con CRC-16/CCITT-FALSE.
5. **Falta por completo `\section{Resultados y Validación Experimental}` (Exigido en Rúbrica: 2 pts)**:
   - El `main.tex` actual NO tiene sección de Resultados. Hay que crearla incluyendo:
     - **Tabla 3 actualizada** con los resultados reales de los ensayos en `pruebas/` (ver Sección 4.3 abajo).
     - **Figuras/gráficos originales en TikZ/pgfplots o imágenes generadas de `pruebas/`**:
       1. Curva o tabla cuantitativa de respuesta del sensor de turbidez TS-300B en GPIO4 frente a agua clara (~2340 mV, IT ≈ 0) y adiciones de maicena r1-r3 (~1500-1900 mV, IT > 0.200) usando `pruebas/sensores_20261109_120400_turb_gpio4_agua_clara.csv` y `pruebas/sensores_20261109_194826_turb_gpio4_maicena_r3.csv`.
       2. Respuesta cualitativa del sensor DFRobot SEN0169 en ensayos previos al 2026-11-10, en GPIO35, sin calibrar (agua de caño ~1438 mV, vinagre ~890 mV, bicarbonato ~1580 mV) y prueba de no interferencia con TDS sumergido (`docs/bitacora.md`).
       3. Línea de tiempo real de un evento de captura y enclavamiento NVS (`ARMADO` → `MUESTREANDO` 5003 ms → `CAPTURA_ESTIMADA` → `BLOQUEADO`, persistencia tras reset y rearme con pulsador en GPIO25 tras 3 ciclos normales) citando `pruebas/nodo_20261107_225307.log`, `pruebas/nodo_20261109_113653_p6_nodo_tx.log` y `pruebas/nodo_20261110_162501.log`.
       4. Desempeño del enlace LoRa P2P a 1 m (162 tramas recibidas, PDR = 100.0%, RSSI = -36 dBm, SNR = 12-13 dB en `pruebas/gateway_20261110_005746_p7_1m_gw.log`) y prueba de resiliencia ante corte de Internet de 60 s con cola circular en RAM (`cola=3`, `cola=9` → reconexión y vaciado `cola=0` en `pruebas/gateway_20261110_163055.log`).
6. **Falta subsección de "Análisis de Mercado y Viabilidad Económica" (Exigido explícitamente en Rúbrica: "buen análisis de mercado")**:
   - La rúbrica penaliza con "En Proceso" si falta el análisis de mercado (`faltan elementos clave (ej. análisis de mercado)`).
   - Debe agregarse una subsección comparando el costo del prototipo QawapMayu (~S/ 450 - S/ 580) frente a muestreadores automáticos comerciales (ej. Teledyne ISCO 6712 / Hach AS950, que cuestan > USD 3,000 - 5,000 sin telemetría LoRa integrada) y sondas multiparamétricas comerciales (YSI ProDSS / Hanna HI98194), identificando el nicho de mercado (comunidades agrícolas, juntas de usuarios de agua, municipalidades distritales y laboratorios universitarios en cuencas andinas como pre-cribado de bajo costo).
7. **Falta `\section{Conclusiones}` (Exigido en Rúbrica)**:
   - El `main.tex` termina en `Objetivos y Alcances`. Debe redactarse una sección de Conclusiones sólidas vinculada uno a uno con los 6 objetivos específicos y los resultados medidos.
8. **Criterio 2.2 de la Rúbrica (Implementación computacional, modularidad, estándares y herramientas: 3 pts)**:
   - Conviene añadir en Metodología o Implementación una subsección breve sobre **Arquitectura de Firmware y Buenas Prácticas de Ingeniería de Software**, destacando:
     - Modularidad mediante cabeceras compartidas en `comun/` (`trama.h`, `anomalia.h`, `rak_at.h`, `hardware.h`) entre el nodo, el gateway y los 5 entornos de herramientas de diagnóstico (`herramientas/platformio.ini`).
     - Uso de PlatformIO, control de versiones Git con commits atómicos por prueba y filtro automatizado en Python (`herramientas/monitor/filter_evidencia.py`) que genera bitácoras `.log` y `.csv` trazables en `pruebas/`.
9. **Referencias IEEE uniformes (`L1506-1670`)**:
   - Reemplazar o complementar `\bibitem{ebyteE32}` (`L1527`) con la ficha técnica/manual AT de **RAKwireless RAK3172 / RAK3272S (RUI3)** y `\bibitem{turb}` (`L1551`) con el sensor óptico **TS-300B**, manteniendo formato IEEE uniforme.

### 2.2 Brechas experimentales y de entregables fuera del LaTeX

1. **Medición de volumen físico bombeado (`Q_cal` en mL)**:
   - En `pruebas/bomba_manual_*.log` están registrados los tiempos exactos de bombeo (3750 ms y 5000 ms), pero en `docs/calibracion.md` no se anotaron los mililitros recolectados en cada intento. Si el equipo tiene el dato anotado en cuaderno o puede medir cuánta agua sale en 5 s, se completa la tabla; si no, se reporta honestamente como temporización validada con volumen pendiente de pesaje.
2. **Presentación PPT (5 pts en total: 3 pts calidad/gráficos + 2 pts fluidez)**:
   - Debe ser 100% coherente con el nuevo informe (sin mencionar E32, SEN0189 ni GPIO32) e incluir gráficos reales de las pruebas (ver guía por diapositiva en Sección 4.4).
3. **Video Publicitario (2 pts)**:
   - Debe mostrar el **prototipo real funcionando** y a **todos los integrantes**, con narrativa creativa y humor efectivo (no generado por IA).

---

## 3. Guía Técnica del Código Actual (Auditoría con `OBSERVADO` y `SUPUESTO`)

### 3.1 Rearme desde `BLOQUEADO` (`GPIO25` y condiciones reales)
- **OBSERVADO** (`nodo/src/main.cpp:273-301`, `comun/anomalia.h:143-149`): Las funciones `condiciones_normales()` y `frasco_reemplazado()` del pseudocódigo P1 **no existen en el firmware**.
- **OBSERVADO** (`nodo/src/main.cpp:43, 304-319, 385`): El pulsador está en `PIN_REARME = 25` con `INPUT_PULLUP` y antirrebote de 50 ms. Al pulsarse a GND (o enviar `'r'` por serie, `L329-331`), activa `solicitud_rearme = true`.
- **OBSERVADO** (`nodo/src/main.cpp:273-301`): `atender_rearme()` exige:
  1. Que el estado no sea `ARMADO`, `MUESTREANDO` ni `CAPTURA_ESTIMADA` (acepta rearme desde `BLOQUEADO` y desde `FALLO`).
  2. Que `det.c_normales >= CICLOS_NORMALES_REARME` (3 ciclos consecutivos de 5 s = 15 s sin anomalías y con **al menos un canal válido y evaluado**: TDS válido con `tds0_fijado`, pH válido con `ph_ok=true`, o turbidez válida entre 300 y 3250 mV con `vt0_calibrado=true`).
  3. Que `nvs_muestreo.putBool("bloqueado", false)` y `putBool("bombeando", false)` tengan éxito.
  4. Al cumplirse, reinicia contadores, apaga `anomalia_sim` y cambia a `EST_ARMADO` imprimiendo `[ms] BLOQUEADO -> ARMADO (rearme manual confirmado)` (observado en `pruebas/nodo_20261110_162501.log:407-408`; rechazo `0/3 ciclos normales` observado en `pruebas/nodo_20261110_145350.log:88-90`).

### 3.2 Qué ve el Gateway y qué llega a ThingsBoard
- **OBSERVADO** (`gateway/src/main.cpp:49-98`): Recibe `+EVT:RXP2P:<RSSI>:<SNR>:<hex>`, decodifica `Trama` (27 bytes), verifica `TRAMA_VERSION == 1` y `crc16_ccitt`, descarta duplicados (`t.seq <= seq_ultima`), calcula PDR e imprime `RX seq=.. estado=.. tds=.. rssi=.. snr=.. PDR=..%`.
- **OBSERVADO** (`gateway/src/main.cpp:79-97`): Encola siempre si `t.anomalias != 0` o `t.estado != EST_ARMADO` (y en `ARMADO` normal cada `PUBLICAR_CADA = 1`). Publica en el tópico MQTT `v1/devices/me/telemetry` las 13 claves:
  `ph, tds, it, temp, validez, anomalias, estado, evento, seq, boot, rssi, snr, pdr` (envueltas en `{"ts":<epoch_ms>,"values":{...}}` si NTP está sincronizado).
- **OBSERVADO** (`comun/anomalia.h:163-166`): Los canales inválidos usan `INT16_MIN` (`-32768`), por lo que cuando `ph_cal=0` y `DS18B20=0` llegan a ThingsBoard como `ph: -327.68` y `temp: -327.68`.
- **OBSERVADO** (`nodo/src/main.cpp:233-237, 453-455, 473-478`):
  - En `MUESTREANDO`: se envía **1 sola trama** justo antes de activar el relé; durante los 5 s de bombeo no se muestrean sensores ni se usa el radio.
  - En `CAPTURA_ESTIMADA`: al apagar la bomba tras 5 s, en el siguiente ciclo envía **1 sola trama** con `estado="CAPTURA_ESTIMADA"` y pasa inmediatamente a `BLOQUEADO`.
  - En `BLOQUEADO`: envía 1 trama cada 5 s con `estado="BLOQUEADO"` y el último `evento_id`.

### 3.3 Seguridad del Relé (`GPIO23` activo en bajo) y Borrado de NVS (`'z'`)
- **OBSERVADO** (`comun/hardware.h:10`, `nodo/src/main.cpp:88-92, 380-385`): `PIN_RELE = 23`, `RELE_ACTIVO_BAJO = true` (`LOW` enciende la bomba, `HIGH` la apaga). `PIN_LED = 2` es activo en alto. `setup()` ejecuta `rele(false)` antes y después de `pinMode(PIN_RELE, OUTPUT)`.
- **OBSERVADO** (`nodo/src/main.cpp:368-372, 399-416`): El nodo usa 3 espacios de nombres NVS separados:
  - `"muestreo"`: claves `bloqueado`, `bombeando`, `evento`. La tecla `'z'` ejecuta `nvs_muestreo.clear()`, borrando **únicamente** `"muestreo"`.
  - `"cal"`: claves `ph_ok`, `ph_m`, `ph_b`, `vt0_ok`, `vt0_mv`. **No se pierde al pulsar `'z'`** (solo se borra con la tecla `'b'` del programa `herramientas/src/sensores.cpp:161-162`).
  - `"nodo"`: clave `boot` (`boot_id`). **No se pierde al pulsar `'z'`**.

---

## 4. Tablas y Textos Listos para Insertar en el Informe P2

### 4.1 Tabla 2 de Hardware (Reemplazo para `main.tex` L522-589)

| Subsistema | Componente y referencia real | Función, interfaz y condición de integración | Clasificación |
|---|---|---|---|
| **Procesamiento** | 2 × ESP32 DevKit V1 (ESP32-WROOM-32) | Nodo QM01: adquisición cada 5 s, mediana de 31 muestras, detector de anomalías, FSM con persistencia NVS y control de relé. Gateway GW01: recepción LoRa P2P, validación CRC-16, cola circular de 16 mensajes y publicación MQTT a ThingsBoard. | OBSERVADO (`nodo/src/main.cpp:4, 48-51`, `gateway/src/main.cpp:22-35`) |
| **Temperatura** | DS18B20 impermeable | Bus 1-Wire en **GPIO32** (medido en pruebas del 2026-11-11 con pin por confirmar (mapa vigente en ese momento)) con pull-up de 4.7 kΩ a 3.3 V. Conversión asíncrona no bloqueante; descarta desconexión (-127 °C) y lecturas fuera de (-10, 60) °C. Verificado funcionalmente, sin contraste. Compensa térmicamente el cálculo de TDS (o usa 25 °C por defecto si no está presente). | OBSERVADO (`nodo/src/main.cpp:40, 134-160`) |
| **pH** | DFRobot SEN0169 con electrodo BNC | Entrada analógica en **GPIO33** (ADC1_CH5; medido en pruebas del 2026-11-11 con pin por confirmar (mapa vigente en ese momento)). Acondicionada con divisor resistivo 10 kΩ / 20 kΩ (×2/3) para limitar la tensión a < 3.3 V. Rango válido de 20 a 3100 mV; calibración definida en código mediante constantes fijas en `comun/calibracion.h` (`PH_M = 0.003984f`, `PH_B = 1.6410f`) (implementado en código, pendiente de verificar en hardware; no depende de NVS). | OBSERVADO (`nodo/src/main.cpp:38, 150`, `comun/anomalia.h:20-21`, `comun/calibracion.h`, `docs/pines.md:7`) |
| **TDS** | Keyestudio KS0429 TDS Meter V1.0 | Entrada analógica directa en **GPIO35** (ADC1_CH7; medido en pruebas del 2026-11-11 con pin por confirmar (mapa vigente en ese momento)), alimentado a 3.3 V (salida 0–2.3 V, rango 0–1000 ppm). Techo de validez en 2500 mV. Línea base `TDS0` con espera de 60 s y mediana de muestras (o tecla `'0'`; implementado en código, pendiente de verificar en hardware). Estado: verificado funcionalmente, sin calibración absoluta; ensayo reproducible dentro de rango pendiente. | OBSERVADO (`nodo/src/main.cpp:39`, `comun/anomalia.h:15, 22, 102-105`) |
| **Turbidez** | TS-300B (sensor óptico analógico) | Entrada analógica en **GPIO34** (ADC1_CH6; medido históricamente en GPIO4 y GPIO35) con divisor obligatorio 10 kΩ / 20 kΩ desde salida de 5 V. El uso de ADC1 es nativo y totalmente independiente de Wi-Fi y BLE. Validez entre 300 y 3250 mV; referencia de agua clara `VT0` persistida en NVS (`"cal"`). Nota: debido a que `VT0` en NVS se midió con otro pin, hay que repetirlo con `'t'` en agua clara en GPIO34. | OBSERVADO (`comun/hardware.h:14`, `comun/anomalia.h:23-25`, `docs/pines.md:9, 29`) |
| **Enlace de radio** | 2 × RAKwireless RAK3272S / RAK3172 (RUI3) | Transceptores LoRa P2P por comandos AT sobre UART2 (`Serial2` a 115200 bps, RX2 en **GPIO16**, TX2 en **GPIO17**). Configurados en **923.5 MHz** (Grupo 5), SF7, BW 125 kHz, CR 4/5, preámbulo 10, 14 dBm (`AT+P2P=923500000:7:125:0:10:14`). No requiere pines M0, M1 ni AUX. | OBSERVADO (`nodo/src/main.cpp:44-45, 388`, `comun/rak_at.h:11-19, 65-80`) |
| **Actuador y conmutación** | Relé optoacoplado de 1 canal y bomba peristáltica 12 V DC | Relé en **GPIO23** con lógica **activa en bajo** (`LOW` enciende, `HIGH` apaga) y contacto NO en la línea de 12 V. LED testigo en **GPIO2**. Diodo flyback 1N4007 en paralelo inverso con la bomba. Tiempo de captura configurado en 5000 ms (corte máximo en 10000 ms). | OBSERVADO (`comun/hardware.h:10`, `nodo/src/main.cpp:41-42, 54-55, 88-92`, `docs/pines.md:23`) |
| **Seguridad y rearme** | Pulsador de rearme e interruptor manual de 12 V | Pulsador NA entre **GPIO25** y GND con `INPUT_PULLUP` interno y antirrebote de 50 ms. Interruptor físico de corte en serie con la rama de 12 V de la bomba. | OBSERVADO (`nodo/src/main.cpp:43, 304-319, 385`) / SUPUESTO (`docs/pines.md:22`) |
| **Alimentación** | USB dual (laboratorio) y fuente switching 12 V DC | En laboratorio, laptop USB alimenta ESP32, sensores y RAK (3.3 V / 5 V), mientras una fuente externa de 12 V DC alimenta la bomba. Batería 12 V 7 Ah + buck LM2596 proyectada como etapa de despliegue en campo. | SUPUESTO (`docs/pines.md:18-24`, `docs/bitacora.md:57-61`) |

### 4.2 Tabla 4 de Presupuesto Actualizada (Reemplazo para `main.tex` L1279-1399)

- **Filas del informe P1 que ya NO aplican (obsoletas o diferidas a campo)**:
  - Fila 2: Módulo EBYTE E32 LoRa (reemplazado por RAK3272S).
  - Fila 3: Antenas compatibles con EBYTE E32 433 MHz (reemplazadas por antenas sub-GHz 915/923 MHz para RAK).
  - Fila 4: Sensor de turbidez SEN0189 (reemplazado por TS-300B, S/ 85.00 - S/ 90.00).
  - Fila 7: Soluciones buffer pH 4.01 / 6.86 / 9.18 (pendientes; no utilizadas en las sesiones registradas).
  - Filas 12 y 13: Batería sellada 12 V 7 Ah (S/ 54.00) y convertidor buck LM2596 (S/ 8.50) (diferidos a trabajo futuro en campo; en laboratorio se usó alimentación USB y adaptador de pared de 12 V DC).
- **Filas reales a incluir**:
  - 2 × Módulo LoRa RAKwireless RAK3272S / RAK3172 con antena 915/923 MHz.
  - 1 × Sensor de turbidez analógico TS-300B (S/ 85.00 - S/ 90.00).
  - 1 × Fuente / adaptador switching 12 V DC para la bomba peristáltica e interruptor físico de corte.
  - Divisores resistivos de 10 kΩ y 20 kΩ tanto para TS-300B (GPIO34) como para DFRobot SEN0169 (GPIO33), resistor pull-up de 4.7 kΩ (GPIO32) y diodo 1N4007.

### 4.3 Tabla 3 de Ensayos y Resultados Reales (Solo evidencia en `pruebas/`)

| Ensayo | Procedimiento realizado | Resultado observado y archivo de evidencia | Estado | Clasificación |
|---|---|---|---|---|
| **1. pH** | Prueba de respuesta ácida/básica en vaso con agua de caño, vinagre diluido y bicarbonato con divisor 10k/20k en ensayos previos al 2026-11-10, en GPIO35, sin calibrar; calibración 2 puntos del 2026-11-11 (BNC en corto 1345 mV, vinagre 341 mV; pin por confirmar (mapa vigente en ese momento)). | Caída consistente de ~1438 mV (agua de caño) a ~890 mV (vinagre) y subida a ~1580-1589 mV (bicarbonato). Recta vigente en código (`comun/calibracion.h`): `pH = 0.003984 * mV + 1.6410` (implementado en código, pendiente de verificar en hardware). (`docs/bitacora.md:118-128`, `pruebas/sensores_20261111_141425_comp_agua_llave.csv`) | **Calibrado aproximado (±1 pH)** | OBSERVADO |
| **2. TDS y no interferencia** | Medición en aire y agua de caño (pin por confirmar (mapa vigente en ese momento)); inmersión conjunta con sonda de pH. | Línea base en agua de caño, 500 mL, solo KS0429 y DS18B20 sumergidos: `pruebas/sensores_20261111_204920_cal_tds_base.csv`, ~1080 muestras, media ~183 ppm, desv. ~28, TDS0 = 180 (tecla 0), 0 muestras sobre 280. Ensayo con sal en exceso muy fuera de rango: `pruebas/sensores_20261111_223040_cal_tds_base.csv`, 375-681 ppm, c_tds llegó a 138, anomalias=3. Auto-fijado diferido a 60 s y tecla 0 con mediana implementados en código, pendientes de verificar en hardware. | **Verificado funcionalmente, sin calibración absoluta; ensayo reproducible dentro de rango pendiente** | OBSERVADO |
| **3. Turbidez (TS-300B)** | Referencia en agua clara (`VT0`) y adición progresiva de maicena en 3 réplicas (r1, r2, r3) en GPIO4. | Agua clara estable en ~2333-2347 mV (`IT ≈ 0`). Con maicena cae bajo ~1870 mV superando el umbral `IT > 0.200` y activando `ANO_TURB` (`0x04`). Nota: VT0 en NVS debe actualizarse con tecla 't' en GPIO34. (`pruebas/sensores_20261109_120400_turb_gpio4_agua_clara.csv`, `pruebas/sensores_20261109_194826_turb_gpio4_maicena_r3.csv`) | **Realizado** | OBSERVADO |
| **4. Temperatura (DS18B20)** | Lectura 1-Wire asíncrona (medido en pruebas del 2026-11-11 con pin por confirmar (mapa vigente en ese momento); reasignado a GPIO32). | Corrida 162901 con 62 muestras continuas en agua de caño, media 24.24 °C, desv. 0.025 °C, validez 11 constante (`pruebas/sensores_20261111_162901_cal_temp_arranque.csv`). Verificado funcionalmente, sin contraste. | **Verificado funcionalmente, sin contraste** | OBSERVADO |
| **5. Anomalía persistente** | Mantenimiento de turbidez anómala (`ano=0x04`) por ≥ 3 ciclos consecutivos de 5 s con el nodo en `ARMADO`. | Exactamente al 3.er ciclo transiciona `ARMADO -> MUESTREANDO (anomalia persistente)`, transmite 1 trama, activa la bomba 5003 ms, pasa a `CAPTURA_ESTIMADA` y luego a `BLOQUEADO`. (`pruebas/nodo_20261107_225307.log:1088-1095`, `pruebas/nodo_20261109_113653_p6_nodo_tx.log:605-620`) | **Realizado** | OBSERVADO |
| **6. Pico aislado (< 3 ciclos)** | Verificación del reinicio de contador ante perturbación menor a 3 ciclos. | Implementado en `comun/anomalia.h:113, 125, 137`. En `pruebas/nodo_20261107_225307.log:1120` se observan variaciones entre ciclos sin disparo adicional. | **Parcial** | OBSERVADO |
| **7. Dato inválido** | Operación del nodo con canales desconectados o sin calibrar (pH y DS18B20 ausentes, o turbidez desconectada). | El nodo marca bits en 0 dentro de `validez` (`val=0x02` solo TDS o `val=0x06` TDS+turbidez), envía centinela `-32768` y sigue evaluando los canales sanos sin falsos disparos. (`pruebas/nodo_20261110_145043.log:4-28`) | **Realizado** | OBSERVADO |
| **8. Dosificación de bomba** | Series repetidas de bombeo con manguera de 70 cm (`h=30 cm` y `h=2 cm`, `d=60`) usando `bomba_manual`. | Temporización exacta verificada (`t_pedido_ms=3750, t_real_ms=3750` y `t_pedido_ms=5000, t_real_ms=5000, motivo=normal` en 10+ repeticiones). Los volúmenes en mL no constan en `pruebas/` ni en `docs/calibracion.md:59-72`. (`pruebas/bomba_manual_20261107_204728_serie_10_bomba_70cm_h30cm.log`, `pruebas/bomba_manual_20261108_171604_serie_dosificacion_G1_70cm_d60_h2cm.log`) | **Parcial (tiempo medido; volumen en mL no registrado)** | OBSERVADO |
| **9. Enclavamiento NVS y rearme** | Reinicio físico del ESP32 tras captura, intento de rearme con anomalía presente y rearme tras ≥ 3 ciclos normales con pulsador GPIO25. | 1) Tras reset arranca en `[489] ARMADO -> BLOQUEADO (bloqueo previo en NVS)` (`pruebas/nodo_20261110_162501.log:21`). 2) Con anomalía activa rechaza rearme: `Rearme RECHAZADO: 0/3 ciclos normales` (`pruebas/nodo_20261110_145350.log:88-90`). 3) Con agua normal confirma `[320976] BLOQUEADO -> ARMADO (rearme manual confirmado)` (`pruebas/nodo_20261110_162501.log:407-408`). | **Realizado** | OBSERVADO |
| **10. Desconexión y cola MQTT** | Corte de Internet/Wi-Fi durante ~60 s en el gateway mientras el nodo sigue transmitiendo por LoRa cada 5 s. | El gateway continúa recibiendo tramas LoRa, almacena hasta `cola=9` (y `cola=16` en prueba p7), reconecta Wi-Fi y ThingsBoard automáticamente y vacía la cola a `cola=0` sin perder tramas. (`pruebas/gateway_20261110_163055.log:20-60`) | **Realizado** | OBSERVADO |
| **11. Enlace LoRa P2P** | Transmisión continua nodo → gateway a 1 m en 923.5 MHz (SF7, BW 125 kHz) y prueba integrada con captura (p6). | 162 tramas recibidas en `p7_1m` con `PDR=100.0%`, `crc_err=0`, `dup=0`, RSSI `-35` a `-38` dBm y SNR `12` a `13` dB. En `p6` el gateway recibe en vivo las transiciones `MUESTREANDO` (`seq=98`) y `CAPTURA_ESTIMADA` (`seq=99`). (`pruebas/gateway_20261110_005746_p7_1m_gw.log`, `pruebas/gateway_20261109_111821_p6_gw_rx.log:150-153`) | **Realizado (a 1 m en banco)** | OBSERVADO |
| **12. Protección eléctrica** | Conmutación del relé y bomba en ciclos de captura monitoreando `boot_id` del ESP32. | El nodo completó los ciclos de bombeo de 5003 ms y reportó `CAPTURA_ESTIMADA` manteniendo el mismo `boot_id` sin reinicios por transitorios inductivos. (`pruebas/nodo_20261107_225307.log:1088-1096`, `pruebas/nodo_20261109_113653_p6_nodo_tx.log:605-620`) | **Realizado** | OBSERVADO |

---

## 5. Super Prompt para Iniciar el Nuevo Chat

Copia y pega el siguiente bloque en el nuevo chat:

```markdown
Necesito redactar el nuevo informe final P2 en LaTeX para nuestro proyecto **QawapMayu**. 

IMPORTANTE: El informe original P1 (`informes/p1/main.tex`) DEBE PRESERVARSE INTACTO como registro histórico de la propuesta inicial. El objetivo de este chat es crear un NUEVO documento LaTeX independiente en `informes/p2/main.tex`, que corresponde a la entrega P2: continuación, evolución de ingeniería, resultados experimentales reales y conclusiones.

Antes de comenzar, lee obligatoriamente estos archivos del repositorio:
1. `docs/contexto_informe_p2.md` (contiene la rúbrica oficial P2 parseada de 20 puntos, el diagnóstico de brechas, la auditoría completa del código vs. el PDF original con citas `OBSERVADO`/`SUPUESTO`, las tablas de hardware y ensayos reales, y el resumen de todos los logs de `pruebas/`).
2. `informes/p1/main.tex` (como documento base de referencia para heredar la estructura, marco teórico, bibliografía y estilos TikZ).
3. `docs/bitacora.md`, `docs/pines.md` y `docs/calibracion.md`.

### Estructura y reglas estrictas para el nuevo informe P2:
1. **Creación de nuevo archivo**: No modifiques nada dentro de `informes/p1/`. Crea el nuevo informe en `informes/p2/main.tex` manteniendo el diseño visual profesional (paleta navy/teal/pale, paquetes y comandos de formato).
2. **Cero invención de datos**: Usa únicamente resultados experimentales que consten en `pruebas/` y `docs/bitacora.md` tal como están catalogados en `docs/contexto_informe_p2.md`. Donde una prueba quedó parcial (ej. pH cualitativo sin buffers, DS18B20 sin contraste con termómetro patrón, dosificación con tiempos exactos medidos pero sin pesaje en mL en los logs, enlace LoRa medido a 1 m en banco), repórtalo con total transparencia técnica y rigor ingenieril.
3. **Sección explícita de "Evolución de Ingeniería: Cambios y Justificación respecto al Perfil P1"**:
   - Radio EBYTE E32 (433 MHz, M0/M1/AUX) -> RAKwireless RAK3272S/RAK3172 (923.5 MHz, comandos AT RUI3 por UART2 en GPIO16/17).
   - Sensor de turbidez SEN0189 -> TS-300B en GPIO35 (ADC1_CH7, ADC nativo libre de conflictos de Wi-Fi/BLE) con divisor 10k/20k; pH en GPIO32.
   - DS18B20 de GPIO4 -> GPIO33 (1-Wire asíncrono).
   - Alimentación en banco de laboratorio (USB + fuente 12 V DC con interruptor físico y relé activo en bajo en GPIO23) frente a batería 12 V + buck LM2596 como etapa de campo.
4. **Componentes y Metodología actualizados en el P2**:
   - Tabla 2 de hardware real, Tabla de presupuesto actualizada (marcando lo obsoleto y lo adquirido) y diagramas TikZ (Figuras 1 y 2) con el hardware real.
   - Pseudocódigo y reglas de la FSM alineados al firmware real (`nodo/src/main.cpp` y `gateway/src/main.cpp`).
   - El Estado del Arte debe dejar explícitas las 4 preguntas de la rúbrica y la Metodología debe destacar la arquitectura modular de software (`comun/`, PlatformIO, Git, filtro Python `evidencia` en `herramientas/monitor/filter_evidencia.py`) para cubrir el criterio 2.2 de la rúbrica (3 pts).
5. **Secciones nuevas obligatorias según la Rúbrica P2**:
   - **Resultados y Validación Experimental**: figuras/gráficos en TikZ/pgfplots y tablas detalladas generadas a partir de los datos reales de `pruebas/` (curva de turbidez con maicena r1-r3, reactividad de pH e interferencia TDS, traza temporal de captura y enclavamiento NVS, PDR LoRa P2P de 100% en 162 tramas y resiliencia del gateway ante corte de Internet de 60 s con cola circular).
   - **Análisis de Mercado y Viabilidad Económica**: requisito explícito en la rúbrica P2, comparando el prototipo frente a muestreadores automáticos comerciales (ej. ISCO/Hach) y definiendo el nicho y público objetivo.
   - **Conclusiones sólidas**: articuladas directamente con los objetivos específicos y los resultados medidos.
   - **Limitaciones y Trabajo Futuro** y **Referencias en formato IEEE uniforme** (incluyendo RAK3272S/RUI3 y TS-300B).
6. Compilar `informe_p2.tex` a PDF con `pdflatex` y verificar que no tenga errores.
```
