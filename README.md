# QawapMayu

Sistema modular de alerta temprana y muestreo automatizado para el monitoreo de aguas bajo influencia minera vía LoRa.
CS5055 Internet de las Cosas · UTEC · 2026-2

## Estructura

```
comun/          trama.h (formato del mensaje LoRa) y rak_at.h (comandos AT del RAK)
herramientas/   programas de prueba para el laboratorio (un entorno por programa)
nodo/           firmware del nodo QM01 (por ahora: esqueleto con datos falsos)
gateway/        firmware del gateway GW01 (LoRa -> MQTT -> ThingsBoard)
docs/           pines, calibraciones y bitácora de sesiones
pruebas/        evidencia: CSV, fotos y videos de cada ensayo
```

## Subir a GitHub (una sola persona, una sola vez)

1. Crear en GitHub un repositorio **vacío** llamado `qawapmayu` (sin README).
2. En la carpeta descomprimida:
   ```
   git init
   git add .
   git commit -m "Esqueleto inicial QawapMayu"
   git branch -M main
   git remote add origin https://github.com/USUARIO/qawapmayu.git
   git push -u origin main
   ```
3. Agregar a los demás como colaboradores (Settings → Collaborators). Ellos hacen `git clone`.

## Requisitos

- VS Code + extensión **PlatformIO IDE**.
- Abrir **cada subcarpeta** (`herramientas`, `nodo`, `gateway`) como proyecto PlatformIO por separado (File → Open Folder).
- La primera compilación descarga librerías y herramientas; háganla en casa, no en el laboratorio.

## Herramientas de laboratorio (`herramientas/`)

En VS Code elijan el entorno en la barra inferior (`env:...`) y usen Upload y Monitor. Por consola:

| Programa | Comando | Para qué |
|---|---|---|
| `sensores` | `pio run -e sensores -t upload -t monitor` | pH + TDS + temperatura en CSV; asistente de calibración de pH (`4`, `7`, `9`, `c`, `s`) |
| `puente_rak` | `pio run -e puente_rak -t upload -t monitor` | Escribir comandos AT al RAK a mano |
| `rele_arranque` | `pio run -e rele_arranque -t upload -t monitor` | Ver si el relé es activo en bajo y si hace clic al arrancar |
| `fsm_led` | `pio run -e fsm_led -t upload -t monitor` | Máquina de estados del muestreador con LED y NVS (`a`, `r`, `x`, `e`, `z`) |

En el monitor, escriban el comando y presionen **Enter**.

## Nodo y gateway

1. En `gateway/src/` copiar `config.example.h` como `config.h` y completar WiFi (hotspot del celular) y token de ThingsBoard. `config.h` **no se sube** a GitHub.
2. Subir `nodo` a un ESP32 y `gateway` al otro, cada uno con su RAK.
3. En el monitor del nodo, `a` + Enter activa una anomalía falsa de TDS para verla en ThingsBoard.

Configuración P2P común en `comun/rak_at.h` (`P2P_CONFIG`): **923.5 MHz (grupo 5)**, SF7, BW 125, CR 4/5, preámbulo 10, 14 dBm; la misma del LAB 4. Nunca energizar el RAK sin antena.

**ThingsBoard Free:** el límite de puntos de datos se gasta rápido (cada variable de cada trama cuenta). Enciendan el gateway solo durante las pruebas o suban `PUBLICAR_CADA` en `config.h`.

## Roles

| Persona | Responsable de |
|---|---|
| A | Sensores (pH, TDS, temperatura, turbidez) |
| B | Muestreador (relé, bomba, FSM, NVS, Q_cal) |
| C | Comunicaciones (RAK, gateway, MQTT, PDR) |
| D | ThingsBoard, montaje hidráulico, evidencia e informe |

## Reglas de trabajo

- Cada persona trabaja en sus archivos. A `main` solo sube código que **compila y fue probado**.
- Cualquier cambio en `comun/trama.h` se acuerda con todos y sube `TRAMA_VERSION`.
- Nadie llega a una sesión con código sin compilar.
- Toda prueba deja evidencia en `pruebas/` y una línea en `docs/bitacora.md`.

## Estado

Código de partida: la trama, el CRC y la conversión hex se verificaron en PC, pero el firmware **aún no se compiló ni probó en el hardware**. La primera compilación de cada proyecto puede requerir pequeños ajustes. Los formatos de respuesta del RAK pueden variar según la versión de RUI3: si algo no se reconoce, revisar el texto que imprime el monitor y ajustar `rak_at.h` o `procesar_linea()` del gateway.
