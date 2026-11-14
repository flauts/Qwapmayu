# QawapMayu — contexto del proyecto para Claude Code

Proyecto final de CS5055 Internet de las Cosas (UTEC 2026-2, Grupo 5). Docente: Gabriel Andrés Arias Obregón.
Equipo en la portada del perfil P1: Fabryzzio Jossue Meza Torres, Mitsuo Murakami, Sebastián Nieto, Jose Tipula.
El usuario (Flauta) lleva el desarrollo completo: firmware, pruebas, gateway, ThingsBoard, informe y presentación.

Este archivo resume el trabajo hecho en claude.ai entre el 6 y el 12 de noviembre de 2026.
El detalle de cada prueba (logs, horas, cifras, commits) está en `docs/contexto/bitacora_web.md`.
**Léelo antes de escribir Metodología, Implementación, Resultados o Limitaciones.**

## Tarea actual
- Redactar en LaTeX el informe final a partir del perfil P1 ("Perfil de proyecto P1 – Semana 07", 23 sep 2026), actualizado a lo que realmente se construyó y probó. Después, la presentación final.
- Ubicación del proyecto LaTeX y del PDF del perfil P1: preguntar al usuario (pueden no estar en este repo).
- Code freeze: 13 nov 2026. No modificar firmware salvo pedido explícito del usuario.
- Demo en vivo en la universidad: pendiente, fecha por definir. El 13 nov solo hubo un ensayo integral en casa del usuario (corregido por el usuario).

## Cómo trabajar con el usuario
- Responde en español. Explica paso a paso y por partes; haz una sola pregunta a la vez.
- Para firmware: actúa como orquestador (reglas y arquitectura). Si no conoces algo del repo, revisa y reporta antes de cambiar nada.
- Para el informe en LaTeX puedes redactar directamente, respetando las reglas de evidencia.
- No hagas commit ni push sin aprobación. `gateway/src/config.h` tiene credenciales de Wi-Fi y ThingsBoard (ignorado por git): no lo muestres ni copies su contenido.

## Reglas de evidencia (importantes)
- Toda cifra del informe debe salir de un log en `pruebas/`, de `docs/` o de `docs/contexto/bitacora_web.md`. Cita el archivo de origen.
- Distingue **observado** (log o hardware) de **supuesto** (lectura de código, estimación). No escribas "validado" sin evidencia en hardware.
- Las metas del perfil P1 (PDR ≥ 95 %, 100 ± 10 mL, error ≤ 1 °C) son metas, no resultados. Reporta lo medido y di si se cumplió.
- Lo marcado "por confirmar" en la bitácora se pregunta al usuario o se deja marcado; no se completa por deducción.
- No inventes resultados de pruebas que no se hicieron (lista de pendientes al final).

## Repositorio (`~/Documents/qawapmayu`)
- `comun/`: código compartido. `trama.h` (trama binaria de 27 bytes, CRC-16/CCITT-FALSE), `anomalia.h` (detector y validez), `rak_at.h` (radio RAK por AT), `hardware.h` (pines), `calibracion.h` (recta de pH).
- `nodo/`: firmware final del nodo QM01. `gateway/`: firmware del gateway GW01.
- `herramientas/`: firmwares de prueba en mesa (`sensores`, `bomba_manual`, `fsm_led`, `rele_arranque`, `puente_rak`) y `monitor/filter_evidencia.py` (guarda `pruebas/*.log` y `*.csv`; etiqueta con la variable `PRUEBA`).
- `pruebas/`: evidencia (logs y CSV con fecha y hora en el nombre). `docs/`: `bitacora.md`, `pines.md`, `calibracion.md`, `protocolo_calibracion_sensores.md`.
- PlatformIO, plataforma fijada en `espressif32@8.0.0` (arduino-esp32 3.3.12).

## Sistema real frente al perfil P1
| Elemento | Perfil P1 | Realidad (12 nov 2026) |
|---|---|---|
| Radio | EBYTE E32 (M0, M1, AUX) | 2× RAK3272S por AT en UART (RX GPIO16, TX GPIO17), LoRa P2P 923.5 MHz, SF7, BW 125 |
| pH | PH-4502C, 3 buffers | DFRobot SEN0169, divisor 10k/20k, GPIO33; 2 puntos sin buffers; error declarado ±1 pH |
| TDS | KS0429 en GPIO34 | KS0429 en GPIO35 (directo, 0–2.3 V) |
| Turbidez | SEN0189 en GPIO32 | TS-300B (sonda TSW-30), divisor 10k/20k, GPIO34; índice relativo IT |
| Temperatura | DS18B20 en GPIO4 | DS18B20 en GPIO32, pull-up 4.7 kΩ a 3V3 |
| Actuador | Bomba peristáltica 12 V | Minibomba sumergible 3–5 V (prestada) vía 1 canal de un módulo de relé de 2 canales **activo en bajo** (GPIO23) ; sin diodo en la bomba: bobina alimentada desde el HW-131 (sin puente JD-VCC) con capacitor de 220 µF; el módulo trae diodo solo en la bobina (corregido por el usuario el 13 nov) |
| Manguera | 3 mm DI, 1.0 m | 6.5 mm DI, 70 cm; en el ensayo integral (13 nov) la bomba va fuera del agua, alimentada por gravedad desde una salida en la pared del recipiente con acople rápido |
| Energía | Batería 12 V 7 Ah + buck | Bomba desde módulo HW-131 con fuente 8 V 2 A; nodo por USB de la laptop |
| Rearme | Pulsador GPIO25 | Pulsador GPIO25 desconectado al 12 nov; se rearma con la tecla `r` por serie |
| Watchdog | Mencionado en pseudocódigo | Implementado en el nodo (TWDT 5000 ms); no en el gateway |
| Histéresis | "Se aplicará" | No implementada: antirrebote temporal (3 ciclos para disparar, 3 normales para rearmar) |
| Reinicio en bombeo | El perfil se contradice | Arranca en FALLO (probado) |
| Supervisión | ThingsBoard | ThingsBoard Cloud hasta el 12 nov; desde el 13 nov broker Mosquitto (o EMQX) y tablero web propio (`tablero/`, PR #1) |

## Parámetros del firmware (vigentes)
- Ciclo de adquisición Ta = 5 s en el nodo; mediana de 31 lecturas por canal analógico (`analogReadMilliVolts`, 12 bits).
- Disparo: pH < 6.5 o > 8.5; TDS > TDS0 + 100 ppm; IT = (VT0 − VT)/VT0 > 0.200. 3 ciclos válidos consecutivos levantan la solicitud de captura. Umbrales experimentales, no LMP ni ECA.
- TDS0: mediana automática de 12 lecturas tras 60 s de arranque (solo RAM). El detector ignora TDS < 100 ppm.
- VT0 = 2115 mV en NVS (capturado con la tecla `t` en agua limpia; se vuelve a capturar el día de la demo).
- pH = 0.003984·mV + 1.6410 (`comun/calibracion.h`). Validez: 180–3100 mV en el pin.
- T_CAPTURA_MS = 5000; T_MAX_BOMBA_MS = 10000. Rearme: 3 ciclos normales + pulsador o tecla `r`; no comprueba el frasco.
- Estados: BLOQUEADO, ARMADO, MUESTREANDO, CAPTURA_ESTIMADA, FALLO. Enclavamiento en NVS (`bombeando`, `bloqueado`).
- Orden de captura: guardar en NVS → trama MUESTREANDO → relé ON. Fallo de NVS → FALLO sin bombear.
- Watchdog del nodo: TWDT 5000 ms con reinicio, armado tras configurar el RAK, una alimentación por vuelta; `loop_max_ms` medido 180 ms.
- Gateway: cola circular de 16 tramas; NTP para la hora; publica 13 claves por MQTT; omite `ph`, `tds`, `it`, `temp` si su bit de `validez` es 0 (bits 0x01 pH, 0x02 TDS, 0x04 turbidez, 0x08 temperatura); recuperación de sordera del RAK (rearme tras 60 s sin tramas, `ESP.restart()` tras 3 intentos); keepalive MQTT 30 s.

## Estado frente a la matriz de ensayos del perfil P1 (resumen; detalle en la bitácora)
| Ensayo | Estado | Evidencia principal |
|---|---|---|
| pH | Hecho sin buffers (corto BNC = pH 7; vinagre con tira = pH 3); agua de caño 7.1–7.2 | `sensores_20261111_141425_comp_agua_llave.log` |
| TDS | Funcional con sal (base ~160–210 ppm; disparo con sal) | `sensores_20261111_202348_cal_tds_base_1.csv`, `sensores_20261111_223040_cal_tds_base.csv` |
| Turbidez | Disparo reproducible con maicena (r2, r3), magnitud no; ciclo completo en firmware final | `sensores_20261109_*_maicena_r2/r3.csv`, `sensores_20261112_003250_cal_tds.log` L672–687 (salida del nodo con nombre heredado) |
| Temperatura | Solo funcional (~23.8 °C); meta ≤ 1 °C no evaluada | `sensores_20261112_001134_cal_tds.csv` |
| Anomalía persistente | Cumplida (8 nov y 12 nov) | `nodo_20261107_225307.log`, `nodo_20261112_150625_wdt_control.log` |
| Pico aislado | Cumplido (simulado) | `serial_20261108_133113.log` L255–274 |
| Dato inválido | Cumplido (turbidez desconectada) | `serial_20261108_133113.log` L318–336 |
| Dosificación | 10 disparos de 5 s ≈ 100 mL ± 2.5 mL (resolución del frasco) | `bomba_manual_20261108_171604_serie_dosificacion_G1_70cm_d60_h2cm.log` |
| Enclavamiento | Cumplido (casos 5 y 6; watchdog B) | `serial_20261108_133113.log`, `nodo_20261112_145419_wdt_B_bomba.log` |
| Desconexión | Parcial: bomba completó con radio en FALLO_RADIO; corte de Internet sin bomba | `serial_20261108_133113.log` L528–533, `gateway_20261110_163055.log` |
| Enlace LoRa | 147/147 a 1 m en interior, latencia ~106 ms | `nodo_20261110_005911_p7_1m_nodo.log`, `gateway_20261110_005746_p7_1m_gw.log` |
| Protección eléctrica | 6 bombeos sin reinicio (7 nov con diodo; 13 nov con JD-VCC separado + 220 µF, sin diodo) | `nodo_20261107_225307.log`, `nodo_20261113_182101.log`, `nodo_20261113_200907.log` |

## Limitaciones a declarar (resumen)
- Los sensores no identifican ni cuantifican metales; la muestra no es válida por sí sola para análisis regulatorio.
- pH ±1 pH, 2 puntos sin buffers, sin compensación térmica. TDS sin calibración absoluta y sin piso de validez (sonda desconectada = 58 ppm "válido"). Turbidez relativa, no NTU; el sedimento asentado no la activa; la posición del sensor cambia IT. Temperatura sin termómetro de referencia; el DS18B20 a veces no responde hasta reiniciar el nodo (13 nov).
- Referencias TDS0 y VT0 fijadas en la puesta en marcha con agua que se asume limpia.
- Histéresis no implementada. El rearme no comprueba el frasco; tras un reinicio en bombeo el volumen es desconocido.
- Bomba sumergible: la muestra toca la bomba; volumen por temporización y dependiente de la geometría; sifón si la boquilla queda bajo el nivel de la fuente.
- Gateway sin watchdog; sordera del RAK de causa desconocida (hasta ~60 s de tramas perdidas); con el nodo apagado el gateway se reinicia cada ~4 min; cola de 16 tramas (~80 s sin red).
- PDR medido en una sola posición interior a 1 m. Validación en condiciones controladas (sal, maicena, vinagre), no con efluente real.

## Pendientes (al 12 nov 2026, noche)
- ~~Ensayo integral~~ hecho el 13 nov (ver bitácora): 3 sensores (pH devuelto), turbidez con maicena, bomba con agua (100 mL, medido por el equipo), LoRa, MQTT y tablero propio, rearme.
- Confirmar que el gateway quedó con firmware sin `-DPRUEBA_SORDERA`.
- Commit de los 4 archivos `pruebas/sensores_20261112_*_ph_min_180.*`. Push tras auditar secretos en el historial.
- ~~Pulsador GPIO25~~: decidido el 13 nov, se elimina del hardware; rearme por comando serie `r` (el firmware sigue leyendo GPIO25 sin efecto).
- Nombre y ubicación del video de la prueba B del watchdog (no está en la laptop).
- Informe final y presentación con componentes reales, presupuesto real (por levantar con el usuario) y fecha de portada corregida.
