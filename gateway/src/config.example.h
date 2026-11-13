// Copiar este archivo como config.h y completar.
// config.h esta en .gitignore: NO subir claves a GitHub.
#pragma once

#define WIFI_SSID  "nombre_del_hotspot"
#define WIFI_PASS  "clave_del_hotspot"

// Broker MQTT local en la laptop del hotspot (ver ip -4 addr) o broker externo.
#define MQTT_HOST  "192.168.x.x"
#define MQTT_PORT  1883

// Publicar 1 de cada N tramas en estado normal.
// Las tramas con anomalia o estado != ARMADO se publican siempre.
#define PUBLICAR_CADA 1
