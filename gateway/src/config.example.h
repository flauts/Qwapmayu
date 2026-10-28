// Copiar este archivo como config.h y completar.
// config.h esta en .gitignore: NO subir claves a GitHub.
#pragma once

#define WIFI_SSID  "nombre_del_hotspot"
#define WIFI_PASS  "clave_del_hotspot"

// ThingsBoard Cloud: el host exacto aparece en el dispositivo ->
// "Check connectivity" -> MQTT. Para la region de Norteamerica suele ser:
#define TB_HOST    "mqtt.thingsboard.cloud"
#define TB_PORT    1883
#define TB_TOKEN   "ACCESS_TOKEN_DEL_DISPOSITIVO"

// Publicar 1 de cada N tramas en estado normal (ahorra puntos de datos
// del plan Free). Las tramas con anomalia o estado != ARMADO se publican siempre.
#define PUBLICAR_CADA 1
