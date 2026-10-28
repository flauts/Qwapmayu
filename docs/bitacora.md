# Bitácora de sesiones

Plantilla por sesión: objetivo, qué quedó validado (con evidencia en `/pruebas`), problemas, tareas para la próxima.

---

## S1 – Miércoles 28 de octubre

**Objetivo:** calibrar pH (día de pH 1), validar TDS y temperatura, comunicación P2P entre RAKs, comportamiento del relé y FSM con LED.

### Estación 1 – pH y TDS (A + D) · herramienta `sensores`
- [ ] DS18B20 detectado y leyendo
- [ ] Po del pH medido con multímetro (< 3.1 V en los 3 buffers)
- [ ] Calibración 3 puntos guardada en NVS del ESP32 nodo
- [ ] Comprobación final en 6.86
- [ ] Prueba de interferencia TDS–pH
- [ ] TDS: destilada, caño y sal progresiva
- [ ] CSV guardados en `/pruebas` + fotos

### Estación 2 – Comunicaciones (C) · proyectos `nodo` y `gateway`
- [ ] Cada RAK conectado a su ESP32 (TX→16, RX→17, 3V3, GND) **con antena**
- [ ] `nodo` configura el RAK sin errores (P2P 923.5 MHz)
- [ ] `gateway` recibe tramas: monitor muestra `RX seq=... PDR=...`
- [ ] Anomalía falsa (`a` en el nodo) visible en el gateway
- [ ] Prueba de reinicio del nodo: el gateway detecta "Nuevo boot"
- [ ] (extra) `config.h` listo y datos falsos en ThingsBoard
- Si algo falla: volver al conversor USB-TTL / `puente_rak` como en el LAB 4

### Estación 3 – Muestreador (B) · `rele_arranque` y `fsm_led`
- [ ] Relé activo en: BAJO / ALTO
- [ ] ¿Clic al arrancar o reiniciar? SÍ / NO
- [ ] Jumper JD-VCC: SÍ / NO
- [ ] Pico aislado → 0 activaciones
- [ ] Anomalía persistente → 1 captura
- [ ] Reinicio tras captura → BLOQUEADO
- [ ] Reinicio durante bombeo → FALLO
- [ ] Rearme rechazado con anomalía / aceptado tras 3 ciclos normales

### Resultados
_(completar al cierre)_

### Compras pendientes
- [ ] Bomba peristáltica 12 V + manguera
- [ ] TS-300B
- [ ] Adaptador 12 V 1–2 A
- [ ] 1N4007, fusible, pulsador, frasco

### Tareas para S2
_(completar al cierre)_
