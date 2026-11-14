# Broker Mosquitto y Demo Local — QawapMayu

Lista de verificación rápida para ejecutar el sistema completo en una red local o hotspot de laptop/celular (100 % offline, sin requerir acceso a Internet).

## 0. Dependencias previas (una sola vez)

- Broker Mosquitto (`mosquitto` y `mosquitto-clients`):
  ```bash
  sudo apt install mosquitto mosquitto-clients
  ```
- Entorno Python para simulador y grabador MQTT (ya configurado en `herramientas/.venv` con `paho-mqtt>=2.0`; usa ese entorno por la política PEP 668 de Ubuntu/Debian). Si necesitas recrearlo:
  ```bash
  python3 -m venv herramientas/.venv
  herramientas/.venv/bin/pip install -r herramientas/requirements.txt
  ```
- El tablero en `tablero/` ya incluye las librerías locales en `tablero/vendor/` (`mqtt.min.js`, `leaflet.js`, `leaflet.css`, `images/` y `chart.umd.min.js`), por lo que no requiere Internet.

## 1. Verificar la IP de la laptop en el hotspot

Conecta la laptop (y el ESP32 gateway + celulares) al mismo hotspot o red Wi-Fi, y consulta la IPv4 de la interfaz inalámbrica:

```bash
ip -4 addr
```

Busca la IP de tu interfaz Wi-Fi (por ejemplo `192.168.43.10` o `10.42.0.1` en `wlan0` / `wlp...`).

## 2. Verificar `MQTT_HOST` en `gateway/src/config.h`

Asegúrate de que `gateway/src/config.h` tenga `WIFI_SSID`, `WIFI_PASS` y `MQTT_HOST` apuntando a esa IP de la laptop (puerto `MQTT_PORT 1883`), y que el gateway esté compilado/cargado con esa configuración.

## 3. Abrir puertos en el firewall UFW (si está activo)

Comprueba el estado de UFW:

```bash
sudo ufw status
```

Si aparece `Status: active`, habilita los puertos del broker MQTT (1883), WebSockets (9001) y servidor web del tablero (8000):

```bash
sudo ufw allow 1883/tcp
sudo ufw allow 9001/tcp
sudo ufw allow 8000/tcp
```

## 4. Iniciar los componentes (en terminales separadas)

*(Opcional: en lugar de escribir `herramientas/.venv/bin/python`, puedes activar el entorno en cada terminal con `source herramientas/.venv/bin/activate` y usar `python3`.)*

1. **Broker Mosquitto** (escucha en `0.0.0.0:1883` MQTT y `0.0.0.0:9001` WebSockets, con mensajes retenidos persistentes en `/tmp/qawapmayu-mosquitto/`):
   ```bash
   ./broker/iniciar.sh
   ```
   *(Si el servicio de sistema `mosquitto` ya está ocupando el puerto 1883, detenlo antes con `sudo systemctl stop mosquitto`.)*

2. **Grabador de evidencia MQTT** (guarda en `pruebas/mqtt_<fecha>_<PRUEBA>.csv`):
   ```bash
   PRUEBA=demo_mqtt herramientas/.venv/bin/python herramientas/registro_mqtt.py
   ```

3. **Simulador de estaciones adicionales (`qm02` y `qm03`)**:
   ```bash
   herramientas/.venv/bin/python herramientas/simulador/simulador.py
   ```
   Controles interactivos en la terminal del simulador:
   - `2` o `a`: dispara secuencia de anomalía en `qm02` (Bajada de Baños) -> `MUESTREANDO` -> `CAPTURA_ESTIMADA` -> `BLOQUEADO`.
   - `3`: dispara secuencia de anomalía en `qm03` (Pantanos de Villa).
   - `r`: rearma estaciones bloqueadas de vuelta a `ARMADO` tras lecturas normales.
   - `q` / `Ctrl+C`: publica `fuera_de_linea` y desconecta limpiamente.

4. **Servidor web del tablero**:
   ```bash
   python3 -m http.server -d tablero 8000
   ```

## 5. Abrir el tablero desde la laptop y celulares

- **En la laptop:** abre `http://localhost:8000`
- **En celulares conectados al mismo hotspot:** abre `http://<IP_LAPTOP>:8000` (el tablero intentará conectarse automáticamente por WebSockets a `ws://<IP_LAPTOP>:9001`).
