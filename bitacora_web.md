# Bitácora de evidencias QawapMayu (trabajo en claude.ai, 6–12 nov 2026)

Fuente: conversaciones del usuario con Claude en claude.ai. Las cifras se calcularon sobre los logs que el usuario pegó o subió, salvo donde dice "según el agente" (reporte de otra herramienta, no verificado) o "observado por el usuario" (visto u oído en el hardware, sin log). Los archivos están en `pruebas/` salvo que se indique otra ruta.

Convenciones: **[log]** cifra tomada del log · **[usuario]** observación del usuario · **[agente]** reporte no verificado · **[cálculo]** derivado en el chat · **por confirmar** = dato abierto.

## 6 nov — Turbidez (pin GPIO32, primer montaje)
- TS-300B con divisor 10k/20k: agua clara 3129 mV; agua con tierra 1421–1500 mV; IT ≈ 0.546 [log]. Cantidad de tierra no medida. Commit `99b039c`.

## 7 nov — Bomba y primer ciclo del nodo
- Caudal con `herramientas` `bomba_manual`, manguera 30 cm: ~100 mL en 3.75–4.0 s [usuario]. El relé es activo en bajo.
- Con la boca de la manguera sumergida en el frasco, al apagar la bomba se forma un sifón que devuelve agua a la fuente [usuario].
- Sin diodo flyback el puerto USB del ESP32 se desconectaba al conmutar el relé; con el diodo dejó de pasar [usuario], sin log.
- Manguera 70 cm con 30 cm de subida: 6 s → 120 mL, 8 s → 160 mL (~20 mL/s) [usuario]. El caudal depende de la geometría.
- `nodo_20261107_225307.log` (código `b6f0c46`, T_CAPTURA_MS 5000): VT0 2334 y luego 2344 mV; ev=1 y ev=2 con ciclo completo (3 ciclos anómalos → MUESTREANDO 5003 ms → CAPTURA_ESTIMADA → BLOQUEADO) y rearme con botón tras 3 ciclos normales; sin reinicios del ESP32. En ev=2 la bomba se frenó con tierra gruesa y el relé igual completó 5003 ms [log].

## 8 nov — Seguridad de la FSM, dosificación y primer enlace RAK
- `serial_20261108_111841.log`: tras apagar, boot 2 recuperó BLOQUEADO y ev=2 desde NVS; ev=3 y ev=4 con relé 5003 ms [log].
- Turbidez en 750 mL: 2 cucharaditas de tierra IT 0.005 → 0.109; 5 cucharaditas pico 0.279. Sacar la sonda del agua da 1–2 s de lectura falsa, absorbida por el filtro de 3 ciclos [log/usuario].
- **7 casos de seguridad** (código `b6f0c46`, logs commit `759bfd9`), todos en `serial_20261108_133113.log` [log]:
  1. Fallo de NVS simulado (tecla `n`): `ARMADO -> FALLO (no se pudo guardar en NVS; no se activa la bomba)`, L71–85; bomba no arrancó [usuario].
  2. Pico aislado simulado (`a` un ciclo): sigue ARMADO, L255–274.
  3. Turbidez desconectada: validez 0x06 → 0x02 y recupera 0x06, sin captura, L318–336.
  4. Corte `x` a los 406 ms de bombeo: `MUESTREANDO -> FALLO (corte de seguridad)`, L386–399; la bomba paró al instante [usuario].
  5. EN durante el bombeo: arranca en FALLO por reinicio durante el bombeo, L451–487.
  6. EN tras una captura: arranca en BLOQUEADO por NVS, L523–569.
  7. Rearme con `r` rechazado con anomalía (0/3) y aceptado tras 3 ciclos normales, L591–625.
  - En ev=15 la trama MUESTREANDO salió con FALLO_RADIO y el relé igual completó 5003 ms (L528–533): la captura no depende del radio.
- **Geometría G1** (referencia de la serie): manguera 70 cm, 6.5 mm DI, 60 cm horizontales, boquilla 2 cm sobre el nivel de la fuente y 10 cm sobre la base del frasco, manguera vacía al inicio. Con la boquilla bajo el nivel de la fuente se formó un sifón que vació la fuente al frasco; la serie se reinició [usuario]. En geometrías con subida, el agua de la manguera vuelve a la fuente al apagar [usuario].
- **Serie de dosificación G1**: `bomba_manual_20261108_171604_serie_dosificacion_G1_70cm_d60_h2cm.log`, líneas 20–38, ensayos 1–10, todos `t_pedido_ms=5000`, `t_real_ms=5000`, `motivo=normal` [log]. Volumen leído en un frasco con marcas cada 5 mL (dos pasadas de marcado coincidieron a 2 mm): 100 mL ± 2.5 mL en cada disparo, desviación no distinguible con ese instrumento [usuario]. Resumen en `serie_dosificacion_G1_resultados.xlsx`. Commit `ca82660`. Logs de tanteo previos: `..._142150_...` (6 ensayos) y `..._140550.log` (1 disparo de 2000 ms).
- **Enlace RAK manual** (módulos a 1 m [usuario]; logs `puente_rak_20261108_*`, commit `8673122`): AT → `RUI_4.2.1_RAK3172-E`; p1 primer paquete recibido (RSSI −41, SNR 13); p3 (−39, 12); p4 trama real de 27 bytes (−48, 13) con CRC 0x05CA válido [cálculo]; p5 el firmware del gateway validó la trama, ignoró el duplicado (`dup=1`) y rechazó una trama alterada (`crc_err=1`) [log `gateway_20261108_232333_gw_p5a_boot.log`, L43 y L50].
- Tras p3 el RAK A dejó de responder sin causa conocida; EN lo recuperó [usuario].

## 9 nov — Nodo transmitiendo y turbidez con maicena
- Turbidez movida a GPIO4 (commit `40281c9`). Bomba desconectada; diodo retirado del relé.
- **p6** (`nodo_20261109_113653_p6_nodo_tx.log`, `gateway_20261109_111821_p6_gw_rx.log`, commit `7ff2e60`): el nodo envió seq 1–138, todas "enviado", 0 FALLO_RADIO, CRC válido [log]. El gateway estuvo **sordo ~24 min** (49 líneas de estado con 0 recibidas) hasta pulsar EN; luego recibió seq 76–138 contiguas (RSSI −41 a −34, SNR 12–13) y vio MUESTREANDO (seq 98) → CAPTURA_ESTIMADA (seq 99, 9995 ms después) → BLOQUEADO (seq 100) [log].
- **Turbidez con maicena** (sensor apoyado en el fondo, VT0 2344 mV, ciclo de 1 s en `sensores`; commit `7faa89e`):
  - r1: no comparable (sin línea base; maicena ya asentada). Asentada IT ~0.10; al agitar dispara (IT hasta 0.72). Hallazgo: el sedimento asentado no activa el sensor óptico [log/usuario].
  - Posición: en agua limpia el IT varió 0.013–0.058 según la posición del sensor [log].
  - r2 (`sensores_20261109_122710_turb_gpio4_maicena_r2.csv`): línea base IT 0.019 (328 filas); dispara en la 3.ª fila sobre 0.2; meseta IT 0.491 [log]. Agitación ~15 s a ojo [usuario].
  - r3 (`sensores_20261109_194826_turb_gpio4_maicena_r3.csv`): línea base IT 0.073; ΔIT del pico ≈ 0.51 (r2 ≈ 0.48); aclarado más rápido; perturbación extra hacia 187–192 s [log/usuario].
  - Conclusión: el disparo se reproduce, la magnitud no. Maicena no representa un efluente real. Pin anterior (GPIO4), no el final.

## 10 nov — Enlace LoRa, ThingsBoard y corte de Internet
- **p7 humo** (`nodo_20261110_004712_p7_humo_nodo.log`, `gateway_20261110_004608_p7_humo_gw.log`): 30/30 tramas, latencia 97–106 ms [cálculo].
- **p7 a 1 m** (`nodo_20261110_005911_p7_1m_nodo.log`, `gateway_20261110_005746_p7_1m_gw.log`; commit de logs `2f13004` [agente]): ventana común seq 143–289, **147 enviadas y 147 recibidas, PDR 100 %** (cota inferior ≈ 98 % al 95 % de confianza, suponiendo pérdidas independientes [cálculo]); latencia RX−TX 104–107 ms, mediana 106 ms (incluye el comando AT, el tiempo en el aire y el búfer USB; error de decenas de ms) [cálculo]; RSSI −37 a −34 dBm, SNR 12–13 dB [log]. Una sola posición interior; orientación y obstáculos no registrados.
- **ThingsBoard Cloud**: dispositivo QM01 recibiendo telemetría desde las 01:43 (cadena completa nodo → LoRa → gateway → MQTT → ThingsBoard) [usuario, captura]. Dashboard con tarjetas de estado, anomalías, evento y última trama; gráficos de IT, pH/temperatura, TDS y RSSI/SNR; tabla de histórico [usuario].
- **Corte de Internet** [agente, no verificado]: hotspot apagado ~60 s, el gateway encoló (cola 1 → 9), reconectó y vació la cola. Se añadió `WiFi.reconnect()` cada 10 s (commit `46d3e23`). Logs `gateway_20261110_163055.log` y `nodo_20261110_162501.log`. Sin bomba.

## 11 nov — pH, temperatura y TDS
- **pH** (DFRobot SEN0169 alimentada desde el riel de 5 V del HW-131, divisor 10k/20k): sin buffers. Punto A: BNC en cortocircuito = pH 7 (la documentación de DFRobot lo da como equivalente a pH 7, con error de hasta 0.3) → 1345 mV. Punto B: vinagre diluido, tira = pH 3 → 341 mV. Recta pH = 0.003984·mV + 1.6410 (≈ 251 mV/pH) [log/usuario].
  - Verificación: agua hervida en reposo meseta ~1713 mV = pH 8.46 con tira entre 7 y 8 (`sensores_20261111_132707_comp_agua_llave.csv`); agua de caño ~1400 mV = pH 7.2 con tira 7 (`sensores_20261111_141425_comp_agua_llave.log`) [log]. Asentamiento de 3 a 15 min. Error declarado ±1 pH; pendiente real no acotada sin buffers; sin compensación térmica.
  - Piso del ADC: sin señal los canales leen 142 mV (da pH 2.21 y contaba como anomalía) → se subió `PH_MIN_VALIDO_MV` a 180 mV (≈ pH 2.36) el 12 nov.
- **Temperatura**: DS18B20 conectado con pull-up 4.7 kΩ; verificado solo funcionalmente, sin termómetro de referencia [usuario].
- **TDS** (KS0429, agua de caño, 500 mL):
  - Línea base `sensores_20261111_202348_cal_tds_base_1.csv`: 650 filas, 24.22 °C, media 161 ppm, desv. 22, rango 105–236 [log]. `sensores_20261111_204920_cal_tds_base*.csv`: ~183 ppm, desv. ~28 [log].
  - Sal: solución madre diluida casi no movió el TDS (+0 a +10 ppm); una cuchara cargada de sal seca en 500 mL subió a 375–681 ppm y el detector disparó (`sensores_20261111_223040_cal_tds_base.csv`, sin DS18B20) [log]. Salmuera concentrada: 500–580 ppm (fuera del rango fiable de 0–1000 ppm de la ficha) [log].
  - TDS0 automático de una sola lectura dio 198, 290, 279, 114 y 566 ppm con base real ~180 → se cambió a mediana [log].

## 12 nov — Firmware final del nodo, watchdog y gateway
- Firmware: pH en `comun/calibracion.h`; TDS0 por mediana tras 60 s; `PH_MIN_VALIDO_MV` 180; pines finales (pH 33, TDS 35, turbidez 34, DS18B20 32).
- `sensores_20261112_001134_cal_tds.csv` y `..._001857_cal_tds.csv`: DS18B20 23.75–23.88 °C; TDS0 automático 210 ppm a los 60.55 s; pH 7.10 (1371 mV) en agua de caño [log].
- `nodo_20261112_002331_nodo_firmware_nuevo.log`: TDS0 auto 192 ppm [log]. La sesión continúa en `sensores_20261112_003250_cal_tds.log` (nombre heredado de la etiqueta `PRUEBA` anterior; es salida del nodo): L6 rearme BLOQUEADO → ARMADO; L315 VT0 2115 mV guardado con `t`; L672–687 ciclo con maicena con validez 0x0F (4 sensores): IT 0.133 → 0.357 → 0.757 (seq 223–225), ARMADO → MUESTREANDO (ev=18) → CAPTURA_ESTIMADA ("bomba activa 5003 ms") → BLOQUEADO; sin anomalía simulada [log; corregido el 12 nov]. Bomba desconectada en esa captura (confirmado por el usuario el 12 nov); las capturas con bomba conectada son las del 7 nov.
- **Watchdog del nodo** (commit de código `c3fd126`, logs `6c07101`):
  - Prueba 0 `nodo_20261112_144839_wdt_0_arranque.log`: `Motivo de reinicio: POWERON`, `WDT armado: 5000 ms`, tramas cada 5 s.
  - Prueba A `nodo_20261112_145117_wdt_A_ocioso.log`: cuelgue provocado (tecla `w`) a las 14:51:39.543; aviso `task_wdt` (loopTask, CPU 1) a las 14:51:44.544 (5.0 s); reinicio con `TASK_WDT (6)`; vuelve ARMADO [log].
  - Prueba B `nodo_20261112_145419_wdt_B_bomba.log`: cuelgue justo tras encender el relé; reinicio ~4.8 s después; `ARMADO -> FALLO (reinicio detectado durante el bombeo)` con ev conservado [log]. El relé estuvo encendido ~5 s y se apagó con el reinicio [usuario]. Repetición con video: `nodo_20261112_145909_wdt_B_bomba_video.log` (FALLO a las 14:59:41.425); video fuera del repo, nombre y lugar por confirmar.
  - Control sin el flag de prueba `nodo_20261112_150625_wdt_control.log` (~87 min): 1045 tramas sin saltos, 0 reinicios, captura completa y rearme normales, `loop_max_ms` 169–180 ms (3.6 % del timeout) [log]. `nodo_20261112_163636_wdt_control_2.log`: arranque con motivo y `WDT armado`; teclas `w` y `b` sin efecto [usuario].
  - Hallazgos: en esta placa el botón EN se reporta como POWERON; tras un reinicio durante el bombeo el volumen es desconocido.
- **Gateway** (commit de código `5a14dc9`, logs `19b4337`):
  - `gateway_20261112_165559_gw_sordera_1.log`: sordera provocada (tecla `s`, `AT+PRECV=0`); rearme a los 60 s exactos de silencio; RX rearmado en 1.57 s; se perdieron seq 20–31; seq 32–121 sin saltos. Wi-Fi apagado a propósito por la cuota de ThingsBoard [log/usuario]. RSSI pasó de −35/−40 a ~−48 tras el rearme (causa desconocida).
  - `gateway_20261112_170626_gw_sordera_2.log`: nodo apagado; intentos a 60, 120 y 180 s; `ESP.restart()` a los 240 s (17:12:54); tras el reset de software `AT+NWM=0` da `AT_BUSY_ERROR` porque el RAK sigue en recepción, el resto de la configuración da OK; el nodo vuelve a llegar [log]. El log empieza con ruido del arranque del chip.
  - `gateway_20261112_171838_gw_centinelas.log` [agente + usuario]: Wi-Fi y MQTT OK; validez 15 con las 4 sondas; al desconectar la turbidez validez 11 y `it` deja de publicarse; la tarjeta conserva el último valor (el dashboard tiene tarjeta Validez); alarma "Anomalía persistente" con el pico de turbidez. Pausa de 60 s entre 17:22:43 y 17:23:43 recuperada por el rearme: el `seq` del nodo indica que no reinició, así que probablemente fue una sordera espontánea [cálculo; por confirmar con el usuario].
  - Sorderas sin provocar: 8 nov (RAK A), 9 nov (~24 min) y probablemente 12 nov. Causa no determinada.
  - `tds_mv_valido` no tiene piso: con la sonda de TDS desconectada se publica 58 ppm como válido [agente].

## Commits relevantes
`99b039c` turbidez GPIO32 · `b6f0c46` nodo con FSM (código de los casos de seguridad) · `759bfd9` logs de seguridad · `ca82660` serie de dosificación G1 · `8673122` logs RAK 8 nov · `40281c9` turbidez a GPIO4 · `7ff2e60` logs p6 · `7faa89e` logs turbidez maicena · `46d3e23` reconexión Wi-Fi del gateway · `2f13004` logs p7 · `8b34cec`/`8fadaeb` pines y calibración de pH · `c3fd126` watchdog del nodo · `6c07101` logs del watchdog · `5a14dc9` gateway: sordera y centinelas · `19b4337` logs del gateway. Varios commits del 12 nov siguen sin push.

## Datos auxiliares
- Volumen interno de la manguera de 70 cm y 6.5 mm DI ≈ 23 mL [cálculo: π·0.65²/4·70 cm³].
- Cuota gratuita de ThingsBoard anotada por el usuario el 10 nov: 1 millón de puntos de datos al mes; cada trama publica hasta 13 claves (verificar en la cuenta).
