# Bitácora QawapMayu - Sesión S1 (31 de octubre de 2026)

Equipo en la sesión: Flauta y Mitsuo (sensores). Formato CSV del programa `sensores`:
`ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,validez`

## Resumen

| Sensor | Estado al cierre | Pendiente |
|---|---|---|
| DS18B20 (temperatura) | Funciona, lecturas estables de 22 a 31 °C | Comparar con un termómetro de referencia (meta: error <= 1 °C) |
| TDS Keyestudio KS0429 | Funciona. Aire = 142 mV (59 ppm), agua del caño ~700 mV | Punto bajo (agua embotellada o destilada). Devolver a GPIO34 |
| pH PH-4502C + sonda H-101 | Sin probar todavía (cableado planificado) | Calibrar con buffers 4.01 / 6.86 / 9.18 y guardar en NVS |

## 1. DS18B20

- Cableado: rojo a 3V3, negro a GND, amarillo (dato) a GPIO. Resistencia pull-up de 4.7 kΩ entre el dato y 3V3 (no pull-down). En la protoboard, la resistencia une la fila del dato con la fila del 3V3.
- Síntoma inicial: la columna `temp_C` salía fija en -127.00. Ese valor significa que el sensor no se detecta en el bus.
- Causa: el cable de dato estaba en GPIO33 y el código leía GPIO4.
- Decisión del equipo: cambiar el pin en el código a 33 en vez de mover el cable.
- Resultado: lectura correcta tras el cambio.

**Pendiente de coordinación:** la tabla de pines (`docs/pines.md`), el nodo final y los demás programas usan GPIO4 para el DS18B20. Hay que actualizar todo a 33, o volver a GPIO4 en el cableado y en el código.

## 2. TDS

- Este módulo no lleva resistencia. Cables: rojo, amarillo y negro (sin etiquetas, solo la leyenda "TDS meter V1.0"). Con el cableado supuesto: rojo a 3V3, negro a GND, amarillo a D34.
- Síntomas durante la depuración:
  - Con el módulo desconectado: 142 mV / 58-59 ppm. Es el valor de un pin sin señal y el piso del ADC.
  - Con el módulo conectado: ~3000 mV (casi el máximo del ADC) tanto en aire como en agua, sin responder al agua.
  - Con la sonda al aire, en una prueba intermedia, ~340 mV: el módulo estaba sin alimentación.
- Medición con multímetro: el cable rojo daba 0.35 V contra GND (se esperaba 3.3 V).
- Se resolvió después de las mediciones con el multímetro. **Cable no funcionando de senial**.
- En agua los valores saltaban entre 142 y 500-700 mV. La causa era la profundidad: los dos electrodos no quedaban cubiertos. Con la sonda quieta y bien sumergida, la lectura es estable.
- Resultados:
  - Aire: 142 mV, 59 ppm.
  - Agua del caño: ~700 mV.
  - Agua destilada o embotellada: no se pudo medir (no tenían). Se asumió que funciona; queda como punto pendiente.
- Durante las pruebas se cambió el pin del TDS a 35 en el código. El 35 es del pH.

**Pendiente:** devolver el TDS a GPIO34 (cable y código) y confirmar que en aire vuelve a 142 mV.

## 3. pH

- No hay buffers (4.01 / 6.86 / 9.18), así que hoy no se pudo calibrar. El café no sirve como referencia: su pH varía con la marca y la preparación.
- Prueba posible sin calibrar: respuesta cualitativa con vinagre diluido (pH baja), agua del caño y agua con bicarbonato (pH sube). Solo confirma que la lectura reacciona, no da valores exactos.
- Cableado planificado (placa PH-4502C):
  - V+ a VIN (5 V del USB), G a GND.
  - Po a una resistencia de 10k, luego fila de unión, y de ahí un cable a GPIO35.
  - En la fila de unión, una resistencia de 20k a GND.
  - Antes de conectar el cable al GPIO35, medir la fila de unión con el multímetro: debe ser menor a 3.3 V.
  - No tocar el potenciómetro azul (sensor prestado).
- Dato por confirmar: "H-101" es el nombre de la sonda o de la placa. Revisar que la placa diga PH-4502C y las etiquetas de sus pines.
- Consumo típico del módulo (cifra de fichas, no medida): 5 a 10 mA.

## 4. Fuente de alimentación

- Los profesores indicaron que se necesita una fuente externa para alimentar todo, y que el ESP32 por USB no será suficiente. Entendimos que se refieren a una fuente única para ESP32 y sensores, además de la bomba.
- Estimación orientativa (no medida, cifras típicas de fichas): ESP32 + RAK + relé + sensores = 250 a 350 mA. El USB 2.0 da unos 500 mA, así que hay poco margen cuando coinciden el relé y la transmisión LoRa.
- La bomba va con su adaptador de 12 V aparte y no entra en esa suma.
- Si hace falta fuente única: adaptador de 12 V más convertidor a 5 V. Estaba previsto en el informe como configuración de campo.
- Decisión: no cambiar el montaje por ahora. Medir el consumo real cuando llegue la bomba.

## 5. Reglas de seguridad acordadas

- Desconectar el USB antes de mover cables.
- Nunca meter 5 V ni 12 V a un GPIO (por eso el pH lleva divisor).
- Medir con el multímetro antes de conectar una señal nueva.
- Los GPIO solo manejan señales. La bobina del relé y la bomba no cuelgan de un GPIO.

## 6. Lecciones aprendidas

- `temp_C = -127` significa que el DS18B20 no se detecta (revisar pin, pull-up y cableado).
- 142 mV / 58-59 ppm en el TDS es el valor de pin sin señal o piso del ADC.
- La sonda TDS debe tener los dos electrodos completamente cubiertos y quieta. Si no, la lectura salta.
- Un pin ADC marcando ~3000 mV con el sensor seco indica un problema de cableado, no un sensor roto.

## 7. Pendientes

1. Devolver el TDS a GPIO34 (cable y código).
2. Unificar el pin del DS18B20 en todo el repo y en `docs/pines.md`.
3. Registrar la causa exacta del problema de alimentación del TDS.
4. Conseguir agua embotellada o destilada para el punto bajo del TDS.
5. Conseguir los buffers y calibrar el pH (teclas 4/7/9, c, s) guardando en NVS.
6. Prueba de interferencia TDS-pH con ambos sensores en el agua.
7. Comparar el DS18B20 con un termómetro de referencia.
8. Medir el consumo real del montaje y decidir sobre la fuente.
9. Actualizar el informe y el PPT con los cambios de hardware (RAK3272S, TS-300B, alimentación de laboratorio, pH con divisor).

# Bitácora: conexión y prueba de respuesta del sensor de pH + prueba de interferencia TDS-pH

**Proyecto:** QawapMayu (CS5055 Internet de las Cosas, UTEC 2026-2, Grupo 5)
**Fecha:** 1 de Noviembre de 2026
**Lugar:** casa, ESP32 + sensores (sin bomba, sin RAK)
**Programa:** `herramientas/sensores`, monitor serie en `/dev/ttyUSB0`
**CSV:** `ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,validez`

## 1. Objetivos de la sesión

1. Conectar el PH-4502C al GPIO35 de forma segura (divisor de tensión).
2. Verificar que el pH responde en sentido consistente (prueba de respuesta, sin calibrar).
3. Revisar si el TDS interfiere con la lectura de pH cuando comparten el agua.

## 2. Montaje

| Elemento | Conexión |
|---|---|
| TDS (KS0429) | V -> 3V3, G -> GND, A -> **GPIO34** (devuelto desde GPIO35 al inicio de la sesión) |
| PH-4502C | V+ -> VIN, G -> GND |
| Divisor del pH | Po -> 10 kΩ -> fila de unión -> GPIO35; 20 kΩ de la unión a GND |
| DS18B20 | desconectado durante la sesión (ya probado antes; pin GPIO33, pull-up 4.7 kΩ a 3V3) |

- Se desmontó el montaje anterior con el potenciómetro; el potenciómetro azul de la placa no se tocó.
- Antes de conectar la unión al GPIO35 se midió con el multímetro (DT266, rango DCV 1000, solo voltios enteros): lectura de 2 a 3 V. Es una verificación **gruesa**: descarta el error de armado, pero no da el valor exacto. Peor caso de diseño: 5 V x 2/3 = 3.33 V.
- Pendiente de confirmar: si "H-101" es el nombre de la sonda o de la placa.

## 3. Resultados: prueba de respuesta del pH (sin calibrar, sin compensar temperatura)

| Medio | ph_mV | Observación |
|---|---|---|
| Agua del caño (primera sesión) | ~1490 | deriva lenta de asentamiento (de 1625 a ~1490 en ~3 min) |
| Agua del caño (tras reinicio) | ~1438 | estable, ruido ±3 a 5 mV |
| Vinagre diluido (2 cucharaditas pequeñas en un vaso) | ~890 a los ~3 min | caída rápida de ~300 mV en ~4 s, luego cola lenta de ~1 mV/s que se fue frenando; no llegó a estabilizarse |
| Bicarbonato disuelto | ~1580 a 1589 | estable, ruido ±1 mV; con mejor mezcla volvió a ~1578 |

**Conclusión:** la sonda responde en sentido consistente. **Más ácido = menos mV; más básico = más mV** (en esta placa, con este cableado). El cambio hacia el ácido (~-550 mV) es mucho mayor que hacia el bicarbonato (~+150 mV), coherente con que el caño ya es casi neutro-básico.

**No usar estos mV para calcular pH:** sin buffers (4.01 / 6.86 / 9.18) no hay calibración. La columna `pH` sale `nan` porque la conversión aún no tiene calibración.

### Eventos que se descartaron como datos
- Saltos aislados de 1 muestra (p. ej. 1487 a 1569 mV con solo agua del caño; picos de 1760 mV): perturbación mecánica o eléctrica puntual (contacto, mano, cuchara, gato). No se repitieron con todo quieto.
- Sonda fuera del agua (~1408 a 1371 mV): no es una lectura de solución.
- Bloque de ~9 s en ~1825 mV con pH y TDS subiendo y bajando juntos (ms 347784 a 355784): sin causa conocida, probablemente externa (el gato pasó cerca). Descartado.

## 4. Resultados: prueba de interferencia TDS-pH

**Baseline** (pH en caño, TDS conectado pero en aire): ph_mV ~1322 mV (deriva < 0.3 mV/s tras ~3 min). Es distinto de los ~1440 mV de antes porque la sonda seguía relajándose tras el vinagre y el bicarbonato.

**TDS sumergido** (mismo vaso, pocos cm del bulbo; distancia exacta no medida):
- tds_mV pasa de 142 a ~800-840 mV (~295 a 310 ppm). Esto **confirma el cableado del TDS** (el valor en aire de 142 mV no lo confirmaba, porque es el mismo que sin el módulo conectado).
- ph_mV subió a ~1360, luego ~1400 y después se pegó en 1371. Es un escalón de +40 a +80 mV frente al baseline, pero con movimiento, sonda aún derivando y el gato cerca.

**Prueba reversible** (sacar solo los electrodos del TDS, módulo alimentado): ph_mV se quedó en 1371 mV, igual que con el TDS dentro. No volvió hacia ~1320.

**Conclusión:** no se observó interferencia sostenida del TDS sobre ph_mV a esa distancia. El escalón venía de otra causa (asentamiento de la sonda, movimiento al meter los electrodos).

**Texto sugerido para el informe:**
> Con los electrodos del TDS sumergidos a pocos centímetros del bulbo, no se observó interferencia sostenida sobre ph_mV: al retirarlos, ph_mV se mantuvo en el mismo nivel. Los picos coincidieron con movimiento mecánico.

**Limitaciones:** una sola prueba, sin buffers, distancia no medida, sonda aún derivando, entorno sin control (gato).

## 5. Hallazgos a revisar

- **Valor pegado en 1371 mV** en ph_mV: apareció con el TDS en aire, en agua y fuera otra vez, así que no depende del TDS. Parece cuantización o un código atascado del ADC/filtro. A ese nivel la resolución es baja. Revisar el promedio/mediana y la conversión en el código.
- **`validez = 3`** constante: no se verificó cómo se calcula en `herramientas/sensores`. Posible máscara de bits por canal; confirmar en el código.
- **Dirección del cambio:** en una conversación previa se dijo que "ácido da más mV", pero los datos muestran lo contrario. Vale lo medido.

## 6. Estado de pines

- TDS: **GPIO34** (cable y código, revertido de GPIO35).
- pH: **GPIO35**.
- DS18B20: **GPIO33** (el plan decía GPIO4). Unificar en todo el repo y en `docs/pines.md`.

## 7. Pendientes

1. Decidir si se hace la comparación del DS18B20 con un termómetro de referencia (objetivo ≤ 1 °C del informe) o se ajusta el informe.
2. Conseguir buffers 4.01 / 6.86 / 9.18 y calibrar el pH.
3. Punto bajo del TDS (agua embotellada o destilada).
4. Revisar el 1371 pegado y el cálculo de `validez` en el código.
5. Unificar GPIO33 en el repo y `docs/pines.md`.
6. Repetir la prueba de interferencia con pH calibrado, distancia medida y sin perturbaciones.
7. Actualizar informe y PPT (RAK3272S, TS-300B, alimentación de laboratorio).
8. Fuente externa: decidir cuando llegue la bomba y se mida el consumo real (estimación de 250 a 350 mA con cifras típicas de fichas, no medida).

## 8. Cuidado de la sonda

Mantener el bulbo húmedo (no dejarlo secar), no frotarlo, enjuagar con agua limpia tras el vinagre y guardar en agua o solución de almacenamiento.
## 2026-11-11 - Intercambio de pines

Se intercambiaron pH 32->33, DS18B20 33->32, TDS 34->35 y TS-300B 35->34. El pull-up de 4.7 k sigue al DATA del DS18B20 (ahora GPIO32); el divisor 10k/20k sigue al TS-300B (ahora GPIO34). Las entradas anteriores de esta bitacora y los logs de `pruebas/` usan los pines viejos. La calibracion en NVS no cambia.
