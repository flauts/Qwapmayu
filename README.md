# QawapMayu

Sistema modular de alerta temprana y muestreo automatizado para el monitoreo de aguas bajo influencia minera vía LoRa.
CS5055 Internet de las Cosas · UTEC · 2026-2

## Estructura

```
comun/          trama.h (formato del mensaje LoRa) y rak_at.h (comandos AT del RAK)
herramientas/   programas de prueba para el laboratorio (un entorno por programa)
nodo/           firmware del nodo QM01 (sensores reales, detector, FSM bomba y LoRa P2P)
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

**Guardado automático de evidencia:** cada vez que abren el monitor serial (desde el ícono de enchufe en VS Code o con `pio run -e ... -t monitor`), el filtro `evidencia` guarda automáticamente en `pruebas/`:
- `pruebas/<programa>_<AAAAMMDD_HHMMSS>.log` con toda la sesión serial (comandos, mensajes de calibración y lecturas).
- `pruebas/<programa>_<AAAAMMDD_HHMMSS>.csv` limpio con las filas `ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,validez` listas para abrir en Excel o Python (cuando el programa emite datos CSV, como `sensores`).

Para etiquetar una prueba desde la consola, definan `PRUEBA` antes del comando:
```bash
PRUEBA=calibracion_ph pio run -e sensores -t monitor
```
Esto genera `pruebas/sensores_<AAAAMMDD_HHMMSS>_calibracion_ph.csv` y `.log`.

## Nodo y gateway

1. En `gateway/src/` copiar `config.example.h` como `config.h` y completar WiFi (hotspot del celular) y token de ThingsBoard. `config.h` **no se sube** a GitHub.
2. Subir `nodo` a un ESP32 y `gateway` al otro, cada uno con su RAK.
3. El firmware de `nodo` lee sensores reales (pH, TDS, DS18B20 asíncrono), evalúa persistencia de anomalías, gestiona la FSM de la bomba en NVS (`muestreo`) y emite telemetría LoRa P2P cada 5 s sin deriva.
   - La bomba o relé se refleja en `PIN_LED` (GPIO2) para pruebas en mesa.
   - Durante `MUESTREANDO`, la CPU no muestrea sensores ni usa la radio, dedicándose exclusivamente a la temporización de corte de la bomba.
   - Comandos por consola serial (`115200` baudios):
     - `a`: activa/desactiva anomalía simulada de TDS.
     - `r`: solicita rearme manual (requiere 3 ciclos normales consecutivos).
     - `x`: simula corte de seguridad durante el bombeo (`FALLO`).
     - `n`: simula fallo de escritura NVS en la próxima captura (`FALLO`).
     - `0`: fija la línea base TDS0 al valor medido actual.
     - `e`: imprime estado detallado de sensores, detector y FSM.
     - `z`: borra la memoria NVS de muestreo para pruebas limpias.

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

- **Sensores y calibración (`herramientas/`):** Herramienta interactiva de calibración de pH y TDS lista con persistencia NVS y filtro de evidencia automática en CSV/LOG.
- **Nodo QM01 (`nodo/`):** Integrado con adquisición no bloqueante de sensores (DS18B20 asíncrono en GPIO33), detección de anomalía persistente (3 ciclos), FSM de seguridad de la bomba con enclavamiento en NVS (`ARMADO` -> `MUESTREANDO` -> `CAPTURA_ESTIMADA` -> `BLOQUEADO`), timeouts de RAK acotados y telemetría LoRa P2P. Compilación validada en PlatformIO.
- **Gateway GW01 (`gateway/`):** Receptor LoRa P2P continuo, verificación CRC-16, deduplicación de tramas, cálculo de PDR y cliente MQTT hacia ThingsBoard. Compilación validada en PlatformIO.
- **Pendiente inmediato:** Ensayos volumétricos de calibración de caudal ($Q_{\text{cal}}$) para ajustar `T_CAPTURA_MS`, pruebas de validación en mesa del nodo y verificación del enlace punto a punto Nodo -> Gateway -> ThingsBoard.
