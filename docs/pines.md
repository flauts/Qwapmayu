# Mapa de pines – Nodo QM01 (ESP32 DevKit V1)

Actualizado: radio EBYTE E32 reemplazado por RAK3272S y turbidez SEN0189 por TS-300B.

| Señal | GPIO | Alimentación del módulo | Notas |
|---|---|---|---|
| pH (PH-4502C, salida Po) | 35 (ADC1) | 5 V | **Medir Po con multímetro antes de conectar.** Si supera 3.1 V, ajustar offset o poner divisor 10k/20k |
| TDS (Keyestudio KS0429) | 34 (ADC1) | 3.3 V | Salida 0–2.3 V, conexión directa |
| Turbidez (TS-300B) | 32 (ADC1) | 5 V | Salida hasta ~4.5 V → **divisor obligatorio**: 10k arriba, 20k abajo (×2/3) |
| Temperatura (DS18B20) | 4 (1-Wire) | 3.3 V | Pull-up 4.7 kΩ entre DATA y 3.3 V |
| Relé (entrada IN) | 23 | 5 V (VIN) | Verificar si es activo en bajo (`rele_arranque`) |
| Pulsador de rearme | 25 | — | Entre GPIO25 y GND, pull-up interno |
| RAK3272S TX → ESP32 RX2 | 16 | 3.3 V | Conexión cruzada |
| RAK3272S RX ← ESP32 TX2 | 17 | | |
| RAK3272S RST (opcional) | 21 | | Para reiniciar el radio por software |
| Libres | 19, 22, 26, 27 | | Ya no se usan M0/M1/AUX |

## Alimentación (configuración de laboratorio)

- **Laptop USB → ESP32 del nodo**, que alimenta sensores, RAK y bobina del relé.
- **Laptop USB → ESP32 del gateway** (con su RAK a 3.3 V).
- **Adaptador 12 V → fusible → interruptor → contacto NO del relé → bomba**.
  Diodo 1N4007 en paralelo con la bomba: franja (cátodo) al +12 V.
- En campo: batería 12 V + buck LM2596 a 5 V (documentado como trabajo futuro).

## Reglas
- **Nunca energizar el RAK sin la antena puesta.**
- El RAK se alimenta del pin **3V3** del ESP32, nunca de 5 V. Con el ESP32 (lógica 3.3 V) no hace falta divisor en la línea RX del RAK; el divisor del LAB 4 era solo por el Arduino MEGA (5 V).
- Solo ADC1 (GPIO32–39) para sensores analógicos.
- GPIO34 y 35 son solo entrada (sin pull-up interno).
- Nunca más de 3.3 V en un pin del ESP32.
