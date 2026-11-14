#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="$ROOT_DIR/herramientas/.venv/bin/python"
DEFAULT_MOSQUITTO_CONF="$ROOT_DIR/broker/mosquitto.conf"
TABLERO_INDEX="$ROOT_DIR/tablero/index.html"
REGISTRO_SCRIPT="$ROOT_DIR/herramientas/registro_mqtt.py"
SIMULADOR_SCRIPT="$ROOT_DIR/herramientas/simulador/simulador.py"

PRUEBA="${PRUEBA:-}"
SIN_SIMULADOR=0
SIN_REGISTRO=0
INTERVALO="2.0"
DEMO_ANOMALIA=""
NO_INTERACTIVO=0
BROKER_HOST="${BROKER_HOST:-127.0.0.1}"
MODO_PUBLICO=0
MQTT_PORT="1883"
WS_PORT="9001"
HTTP_PORT="8000"

PIDS=()
MOSQUITTO_PID=""
HTTP_PID=""
REGISTRO_PID=""
SIM_PID=""
LOG_DIR=""
TEMP_MOSQUITTO_CONF=""
CLEANUP_DONE=0

usage() {
    cat <<'EOF'
Uso: ./iniciar_todo.sh [opciones]

Inicia todo el stack local de QawapMayu (excepto el monitor serial del ESP32):
  1. Broker Mosquitto (MQTT + WebSockets)
  2. Servidor HTTP para el tablero web (tablero/)
  3. Grabador CSV de mensajes MQTT (herramientas/registro_mqtt.py)
  4. Simulador de estaciones qm02 y qm03 (herramientas/simulador/simulador.py)

Opciones:
  -p, --prueba <TAG>       Etiqueta de prueba para el archivo CSV (o usa env PRUEBA)
      --sin-simulador      No inicia simulador.py y espera Ctrl+C (útil solo con hardware qm01)
      --sin-registro       No inicia registro_mqtt.py
      --intervalo <SEG>    Intervalo del simulador en segundos (por defecto: 2.0)
      --demo-anomalia <SEG>
                           Dispara automáticamente una anomalía en qm02 tras <SEG> segundos
      --no-interactivo     Ejecuta simulador.py con --non-interactive
      --publico            Usa el broker público broker.emqx.io:1883 (omite Mosquitto local)
      --broker-host <HOST> Host del broker MQTT para simulador y grabador (por defecto: 127.0.0.1)
      --mqtt-port <PUERTO> Puerto TCP para MQTT (por defecto: 1883)
      --ws-port <PUERTO>   Puerto TCP para WebSockets (por defecto: 9001)
      --http-port <PUERTO> Puerto TCP para el servidor web del tablero (por defecto: 8000)
  -h, --help               Muestra esta ayuda y sale

Variables de entorno:
  PRUEBA                   Etiqueta por defecto si no se pasa --prueba
EOF
}

die() {
    echo "Error: $*" >&2
    exit 1
}

require_arg_value() {
    local opt="$1"
    local argc="$2"
    if [[ "$argc" -lt 2 ]]; then
        echo "Error: la opción $opt requiere un valor." >&2
        exit 2
    fi
}

validate_port() {
    local name="$1"
    local val="$2"
    if [[ ! "$val" =~ ^[1-9][0-9]*$ ]] || (( val < 1 || val > 65535 )); then
        echo "Error: puerto inválido para $name ('$val'). Debe ser un entero entre 1 y 65535." >&2
        exit 2
    fi
}

validate_number() {
    local name="$1"
    local val="$2"
    local positive_only="$3"
    if [[ ! "$val" =~ ^([0-9]+([.][0-9]+)?|[.][0-9]+)$ ]]; then
        echo "Error: valor numérico inválido para $name ('$val')." >&2
        exit 2
    fi
    if [[ "$positive_only" -eq 1 ]] && [[ ! "$val" =~ [1-9] ]]; then
        echo "Error: $name debe ser mayor a 0." >&2
        exit 2
    fi
}

is_local_broker() {
    [[ "$BROKER_HOST" == "127.0.0.1" || "$BROKER_HOST" == "localhost" || "$BROKER_HOST" == "::1" ]]
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -p|--prueba)
                require_arg_value "$1" "$#"
                PRUEBA="$2"
                shift 2
                ;;
            --prueba=*)
                PRUEBA="${1#*=}"
                shift
                ;;
            --sin-simulador)
                SIN_SIMULADOR=1
                shift
                ;;
            --sin-registro)
                SIN_REGISTRO=1
                shift
                ;;
            --intervalo)
                require_arg_value "$1" "$#"
                INTERVALO="$2"
                shift 2
                ;;
            --intervalo=*)
                INTERVALO="${1#*=}"
                shift
                ;;
            --demo-anomalia)
                require_arg_value "$1" "$#"
                DEMO_ANOMALIA="$2"
                shift 2
                ;;
            --demo-anomalia=*)
                DEMO_ANOMALIA="${1#*=}"
                shift
                ;;
            --no-interactivo)
                NO_INTERACTIVO=1
                shift
                ;;
            --publico)
                MODO_PUBLICO=1
                BROKER_HOST="broker.emqx.io"
                shift
                ;;
            --broker-host)
                require_arg_value "$1" "$#"
                BROKER_HOST="$2"
                shift 2
                ;;
            --broker-host=*)
                BROKER_HOST="${1#*=}"
                shift
                ;;
            --mqtt-port)
                require_arg_value "$1" "$#"
                MQTT_PORT="$2"
                shift 2
                ;;
            --mqtt-port=*)
                MQTT_PORT="${1#*=}"
                shift
                ;;
            --ws-port)
                require_arg_value "$1" "$#"
                WS_PORT="$2"
                shift 2
                ;;
            --ws-port=*)
                WS_PORT="${1#*=}"
                shift
                ;;
            --http-port)
                require_arg_value "$1" "$#"
                HTTP_PORT="$2"
                shift 2
                ;;
            --http-port=*)
                HTTP_PORT="${1#*=}"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo "Error: opción desconocida '$1'. Usa --help para ver las opciones." >&2
                exit 2
                ;;
        esac
    done

    if [[ -z "$BROKER_HOST" ]]; then
        echo "Error: --broker-host no puede estar vacío." >&2
        exit 2
    fi
    validate_port "--mqtt-port" "$MQTT_PORT"
    validate_port "--ws-port" "$WS_PORT"
    validate_port "--http-port" "$HTTP_PORT"
    validate_number "--intervalo" "$INTERVALO" 1
    if [[ -n "$DEMO_ANOMALIA" ]]; then
        validate_number "--demo-anomalia" "$DEMO_ANOMALIA" 0
    fi

    if is_local_broker; then
        if [[ "$MQTT_PORT" == "$WS_PORT" || "$MQTT_PORT" == "$HTTP_PORT" || "$WS_PORT" == "$HTTP_PORT" ]]; then
            echo "Error: --mqtt-port ($MQTT_PORT), --ws-port ($WS_PORT) y --http-port ($HTTP_PORT) deben ser distintos." >&2
            exit 2
        fi
    fi
}

check_dependencies() {
    if is_local_broker && ! command -v mosquitto >/dev/null 2>&1; then
        die "No se encontró el binario 'mosquitto' en PATH. Instálalo con: sudo apt install mosquitto mosquitto-clients"
    fi
    if ! command -v python3 >/dev/null 2>&1; then
        die "No se encontró el binario 'python3' en PATH."
    fi
    if [[ ! -x "$VENV_PY" ]]; then
        die "No se encontró el entorno virtual esperado en '$VENV_PY'. Créalo con: python3 -m venv herramientas/.venv && herramientas/.venv/bin/pip install -r herramientas/requirements.txt"
    fi
    if [[ "$SIN_REGISTRO" -eq 0 || "$SIN_SIMULADOR" -eq 0 ]]; then
        if ! "$VENV_PY" -c "import paho.mqtt.client" >/dev/null 2>&1; then
            die "Falta 'paho-mqtt' en '$VENV_PY'. Instálalo con: herramientas/.venv/bin/pip install -r herramientas/requirements.txt"
        fi
    fi
    if is_local_broker && [[ ! -f "$DEFAULT_MOSQUITTO_CONF" ]]; then
        die "No se encontró la configuración del broker en '$DEFAULT_MOSQUITTO_CONF'."
    fi
    if [[ ! -f "$TABLERO_INDEX" ]]; then
        die "No se encontró el tablero web en '$TABLERO_INDEX'."
    fi
    if [[ "$SIN_REGISTRO" -eq 0 && ! -f "$REGISTRO_SCRIPT" ]]; then
        die "No se encontró el grabador MQTT en '$REGISTRO_SCRIPT'."
    fi
    if [[ "$SIN_SIMULADOR" -eq 0 && ! -f "$SIMULADOR_SCRIPT" ]]; then
        die "No se encontró el simulador en '$SIMULADOR_SCRIPT'."
    fi
}

# Devuelve:
#   0 -> puerto libre
#   1 -> puerto ocupado (connect activo o EADDRINUSE con SO_REUSEADDR; ignora TIME_WAIT)
#   2 -> otro error al hacer bind (ej. EACCES por puerto < 1024)
probe_port() {
    local port="$1"
    python3 - "$port" <<'PY'
import errno
import socket
import sys

port = int(sys.argv[1])

for fam, addr in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
    sock = socket.socket(fam, socket.SOCK_STREAM)
    sock.settimeout(0.25)
    try:
        if sock.connect_ex((addr, port)) == 0:
            sys.exit(1)
    except OSError:
        pass
    finally:
        sock.close()

srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    srv.bind(("0.0.0.0", port))
except OSError as exc:
    if exc.errno in (errno.EADDRINUSE, getattr(errno, "WSAEADDRINUSE", 10048)):
        sys.exit(1)
    print(f"Error al probar el puerto {port}: {exc}", file=sys.stderr)
    sys.exit(2)
finally:
    srv.close()

sys.exit(0)
PY
}

show_mqtt_conflict_details() {
    local port="$1"
    local label="$2"
    echo "Error: el puerto $label ($port) sigue ocupado." >&2
    echo "Procesos/sockets detectados:" >&2
    pgrep -a mosquitto >&2 || ss -tlnp 2>/dev/null >&2 || true

    local mosq_pids
    mosq_pids="$(pgrep -x mosquitto 2>/dev/null | tr '\n' ' ' | sed 's/ *$//' || true)"
    if [[ -n "$mosq_pids" ]]; then
        echo "Hay una instancia previa de mosquitto (PID: $mosq_pids) ocupando el puerto." >&2
        echo "Detenla con: pkill -x mosquitto   (o: sudo kill $mosq_pids)" >&2
    else
        local port_pids
        port_pids="$(ss -tlnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u | tr '\n' ' ' | sed 's/ *$//' || true)"
        if [[ -n "$port_pids" ]]; then
            echo "El puerto $port está retenido por el PID: $port_pids (detenlo con: kill $port_pids o sudo kill $port_pids)." >&2
        else
            echo "Libera el puerto $port (por ejemplo con 'pkill -x mosquitto' o 'sudo kill <PID>') e inténtalo de nuevo." >&2
        fi
    fi
}

handle_mqtt_port_conflict() {
    local port="$1"
    local label="$2"
    local rc=0

    probe_port "$port" || rc=$?
    if [[ "$rc" -eq 0 ]]; then
        return 0
    fi
    if [[ "$rc" -eq 2 ]]; then
        die "No se pudo abrir el puerto $label ($port). Si es un puerto privilegiado (< 1024), usa uno >= 1024."
    fi

    if [[ "$port" == "1883" || "$port" == "9001" ]] && command -v systemctl >/dev/null 2>&1; then
        if systemctl is-active --quiet mosquitto; then
            echo "Aviso: el servicio de sistema 'mosquitto' está activo y ocupa el puerto $label ($port) sin la configuración WebSockets del proyecto." >&2
            if [[ -t 0 && "$NO_INTERACTIVO" -eq 0 ]]; then
                local resp=""
                read -r -p "¿Deseas detenerlo ahora con 'sudo systemctl stop mosquitto'? [s/N]: " resp || true
                if [[ "${resp,,}" =~ ^(s|si|sí|y|yes)$ ]]; then
                    if ! sudo systemctl stop mosquitto; then
                        die "No se pudo detener el servicio 'mosquitto'."
                    fi
                    local retry
                    for ((retry = 0; retry < 20; retry++)); do
                        rc=0
                        probe_port "$port" || rc=$?
                        if [[ "$rc" -eq 0 ]]; then
                            return 0
                        fi
                        sleep 0.1
                    done
                else
                    die "Detén el servicio del sistema manualmente ('sudo systemctl stop mosquitto') y vuelve a intentar."
                fi
            else
                die "Modo no interactivo: ejecuta 'sudo systemctl stop mosquitto' para liberar el puerto $port y vuelve a intentar."
            fi
        fi
    fi

    rc=0
    probe_port "$port" || rc=$?
    if [[ "$rc" -eq 0 ]]; then
        return 0
    fi

    show_mqtt_conflict_details "$port" "$label"
    exit 1
}

check_all_ports() {
    if is_local_broker; then
        handle_mqtt_port_conflict "$MQTT_PORT" "MQTT"
        handle_mqtt_port_conflict "$WS_PORT" "WebSockets"
    fi

    local rc=0
    probe_port "$HTTP_PORT" || rc=$?
    if [[ "$rc" -eq 2 ]]; then
        die "No se pudo abrir el puerto HTTP ($HTTP_PORT). Si es un puerto privilegiado (< 1024), usa uno >= 1024."
    fi
    if [[ "$rc" -ne 0 ]]; then
        echo "Error: el puerto HTTP $HTTP_PORT ya está en uso." >&2
        ss -tlnp "sport = :$HTTP_PORT" 2>/dev/null >&2 || ss -tlnp 2>/dev/null >&2 || true
        die "Detén el proceso que ocupa el puerto $HTTP_PORT o especifica otro con --http-port <PUERTO>."
    fi
}

stop_pid() {
    local pid="$1"
    local sig="$2"
    if [[ -z "$pid" ]]; then
        return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
        wait "$pid" 2>/dev/null || true
        return 0
    fi
    kill -"$sig" "$pid" 2>/dev/null || true
    local i
    for ((i = 0; i < 30; i++)); do
        if ! kill -0 "$pid" 2>/dev/null; then
            wait "$pid" 2>/dev/null || true
            return 0
        fi
        sleep 0.1
    done
    kill -KILL "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
}

cleanup() {
    local exit_code=$?
    if [[ "$CLEANUP_DONE" -eq 1 ]]; then
        return 0
    fi
    CLEANUP_DONE=1
    trap - EXIT INT TERM
    set +e

    if [[ ${#PIDS[@]} -gt 0 || -n "$TEMP_MOSQUITTO_CONF" ]]; then
        echo ""
        echo "--- [iniciar_todo] Deteniendo servicios... ---"
    fi

    # 1. Simulador (si corrió en segundo plano en modo no interactivo)
    if [[ -n "$SIM_PID" ]]; then
        stop_pid "$SIM_PID" INT
    fi

    # 2. Grabador CSV primero con SIGINT para que desconecte y vacíe el CSV con flush
    if [[ -n "$REGISTRO_PID" ]]; then
        stop_pid "$REGISTRO_PID" INT
        if [[ -n "$LOG_DIR" && -f "$LOG_DIR/registro.log" ]]; then
            local closed_line
            closed_line="$(grep '\[registro_mqtt\] Cerrado' "$LOG_DIR/registro.log" | tail -n 1 || true)"
            if [[ -n "$closed_line" ]]; then
                echo "$closed_line"
            fi
        fi
    fi

    # 3. Servidor HTTP y broker Mosquitto
    if [[ -n "$HTTP_PID" ]]; then
        stop_pid "$HTTP_PID" TERM
    fi
    if [[ -n "$MOSQUITTO_PID" ]]; then
        stop_pid "$MOSQUITTO_PID" TERM
    fi

    # 4. Cualquier otro PID registrado
    if [[ ${#PIDS[@]} -gt 0 ]]; then
        local pid
        for pid in "${PIDS[@]}"; do
            if [[ "$pid" != "$SIM_PID" && "$pid" != "$REGISTRO_PID" && "$pid" != "$HTTP_PID" && "$pid" != "$MOSQUITTO_PID" ]]; then
                stop_pid "$pid" TERM
            fi
        done
    fi

    if [[ -n "$TEMP_MOSQUITTO_CONF" && -f "$TEMP_MOSQUITTO_CONF" ]]; then
        rm -f "$TEMP_MOSQUITTO_CONF"
    fi

    if [[ ${#PIDS[@]} -gt 0 ]]; then
        echo "--- [iniciar_todo] Servicios detenidos. Logs en: $LOG_DIR ---"
    fi

    return "$exit_code"
}

wait_mosquitto_ready() {
    local i
    for ((i = 0; i < 50; i++)); do
        if ! kill -0 "$MOSQUITTO_PID" 2>/dev/null; then
            echo "Error: Mosquitto terminó inesperadamente al iniciar." >&2
            tail -n 30 "$LOG_DIR/mosquitto.log" >&2 || true
            exit 1
        fi
        if python3 - "$MQTT_PORT" "$WS_PORT" <<'PY' 2>/dev/null
import socket
import sys

for raw_port in sys.argv[1:]:
    with socket.create_connection(("127.0.0.1", int(raw_port)), timeout=0.2):
        pass
PY
        then
            return 0
        fi
        sleep 0.1
    done

    echo "Error: tiempo de espera agotado esperando a que Mosquitto escuche en MQTT ($MQTT_PORT) y WebSockets ($WS_PORT)." >&2
    tail -n 30 "$LOG_DIR/mosquitto.log" >&2 || true
    exit 1
}

wait_http_ready() {
    local i
    for ((i = 0; i < 50; i++)); do
        if ! kill -0 "$HTTP_PID" 2>/dev/null; then
            echo "Error: el servidor HTTP del tablero terminó inesperadamente al iniciar." >&2
            tail -n 30 "$LOG_DIR/http.log" >&2 || true
            exit 1
        fi
        if python3 - "$HTTP_PORT" <<'PY' 2>/dev/null
import socket
import sys

with socket.create_connection(("127.0.0.1", int(sys.argv[1])), timeout=0.2):
    pass
PY
        then
            return 0
        fi
        sleep 0.1
    done

    echo "Error: tiempo de espera agotado esperando al servidor HTTP en el puerto $HTTP_PORT." >&2
    tail -n 30 "$LOG_DIR/http.log" >&2 || true
    exit 1
}

wait_registro_ready() {
    local i
    for ((i = 0; i < 100; i++)); do
        if ! kill -0 "$REGISTRO_PID" 2>/dev/null; then
            echo "Error: registro_mqtt.py terminó inesperadamente al iniciar." >&2
            tail -n 30 "$LOG_DIR/registro.log" >&2 || true
            exit 1
        fi
        if grep -q "Suscrito" "$LOG_DIR/registro.log" 2>/dev/null; then
            return 0
        fi
        sleep 0.1
    done

    echo "Error: tiempo de espera agotado esperando confirmación de suscripción en registro_mqtt.py." >&2
    tail -n 30 "$LOG_DIR/registro.log" >&2 || true
    exit 1
}

detect_lan_ips() {
    if ! command -v ip >/dev/null 2>&1; then
        return 0
    fi
    ip -4 -o addr show scope global 2>/dev/null | awk '
        {
            iface = $2
            sub(/@.*/, "", iface)
            if (iface ~ /^(docker|br-|veth|virbr)/) next
            ip = $4
            sub(/\/.*/, "", ip)
            if (ip == "") next
            if (iface ~ /^wl/) {
                wl[++nw] = ip " " iface
            } else {
                other[++no] = ip " " iface
            }
        }
        END {
            for (i = 1; i <= nw; i++) print wl[i]
            for (i = 1; i <= no; i++) print other[i]
        }
    ' || true
}

start_mosquitto() {
    local conf_to_use=""
    if [[ "$MQTT_PORT" == "1883" && "$WS_PORT" == "9001" ]]; then
        mkdir -p /tmp/qawapmayu-mosquitto
        conf_to_use="$DEFAULT_MOSQUITTO_CONF"
    else
        TEMP_MOSQUITTO_CONF="$(mktemp /tmp/qawapmayu-mosquitto.XXXXXX.conf)"
        cat >"$TEMP_MOSQUITTO_CONF" <<EOF
persistence false
allow_anonymous true

listener $MQTT_PORT 0.0.0.0
protocol mqtt

listener $WS_PORT 0.0.0.0
protocol websockets
EOF
        conf_to_use="$TEMP_MOSQUITTO_CONF"
    fi

    mosquitto -c "$conf_to_use" -v </dev/null >"$LOG_DIR/mosquitto.log" 2>&1 &
    MOSQUITTO_PID=$!
    PIDS+=("$MOSQUITTO_PID")
    wait_mosquitto_ready
}

start_http_server() {
    python3 -m http.server -d "$ROOT_DIR/tablero" --bind 0.0.0.0 "$HTTP_PORT" </dev/null >"$LOG_DIR/http.log" 2>&1 &
    HTTP_PID=$!
    PIDS+=("$HTTP_PID")
    wait_http_ready
}

start_registro_mqtt() {
    local reg_args=(-u "$REGISTRO_SCRIPT" --host "$BROKER_HOST" --port "$MQTT_PORT")
    if [[ -n "$PRUEBA" ]]; then
        reg_args+=(--prueba "$PRUEBA")
    fi

    "$VENV_PY" "${reg_args[@]}" </dev/null >"$LOG_DIR/registro.log" 2>&1 &
    REGISTRO_PID=$!
    PIDS+=("$REGISTRO_PID")
    wait_registro_ready
}

print_banner() {
    local csv_info=""
    if [[ "$SIN_REGISTRO" -eq 1 ]]; then
        csv_info="omitido (--sin-registro)"
    else
        local detected_csv
        detected_csv="$(sed -n 's/^--- \[registro_mqtt\] Suscrito .* -> \(.*\) ---$/\1/p' "$LOG_DIR/registro.log" | head -n 1 || true)"
        if [[ -n "$detected_csv" ]]; then
            csv_info="activo -> $detected_csv"
        else
            csv_info="activo -> $ROOT_DIR/pruebas/"
        fi
    fi

    local remote_ws_url=""
    if ! is_local_broker; then
        if [[ "$BROKER_HOST" == "broker.emqx.io" ]]; then
            remote_ws_url="wss://broker.emqx.io:8084/mqtt"
        else
            remote_ws_url="ws://$BROKER_HOST:$WS_PORT"
        fi
    fi

    echo "========================================================================"
    echo "  QawapMayu — Stack local activo"
    echo "========================================================================"
    if is_local_broker; then
        echo "  Broker MQTT    : activo en 0.0.0.0:$MQTT_PORT"
        echo "  WebSockets     : activo en 0.0.0.0:$WS_PORT"
    else
        echo "  Broker MQTT    : remoto en $BROKER_HOST:$MQTT_PORT"
        echo "  WebSockets     : $remote_ws_url"
    fi
    echo "  Grabador CSV   : $csv_info"
    echo "  Servidor Web   : activo en 0.0.0.0:$HTTP_PORT"
    echo ""
    if is_local_broker; then
        echo "  Tablero local  : http://localhost:$HTTP_PORT"
    else
        echo "  Tablero local  : http://localhost:$HTTP_PORT/?broker=$remote_ws_url"
    fi

    local lan_lines
    lan_lines="$(detect_lan_ips)"
    if [[ -n "$lan_lines" ]]; then
        local ip_addr iface
        while read -r ip_addr iface; do
            [[ -z "$ip_addr" ]] && continue
            if is_local_broker; then
                echo "  Tablero LAN/HS : http://$ip_addr:$HTTP_PORT ($iface)"
            else
                echo "  Tablero LAN/HS : http://$ip_addr:$HTTP_PORT/?broker=$remote_ws_url ($iface)"
            fi
        done <<<"$lan_lines"
    else
        echo "  Tablero LAN/HS : (sin interfaz Wi-Fi/LAN activa detectada)"
    fi

    if is_local_broker && [[ "$WS_PORT" != "9001" ]]; then
        echo "  Nota WS        : WebSockets en puerto $WS_PORT (ajusta ws://<IP>:$WS_PORT en el tablero)"
    fi
    echo "  Logs           : $LOG_DIR"
    echo ""
    echo "  Recordatorio   : el monitor serial se ejecuta aparte si deseas ver el log del ESP32."
    echo "========================================================================"
}

main() {
    parse_args "$@"
    check_dependencies
    check_all_ports

    LOG_DIR="$(mktemp -d /tmp/qawapmayu-logs.XXXXXX)"
    chmod 700 "$LOG_DIR"

    trap 'cleanup' EXIT
    trap 'cleanup; exit 0' INT TERM

    if is_local_broker; then
        start_mosquitto
    fi
    start_http_server
    if [[ "$SIN_REGISTRO" -eq 0 ]]; then
        start_registro_mqtt
    fi

    print_banner

    if [[ "$SIN_SIMULADOR" -eq 1 ]]; then
        echo "Simulador omitido (--sin-simulador). Esperando señal (Ctrl+C para detener todo)..."
        wait -n "${PIDS[@]}" || true
        if [[ "$CLEANUP_DONE" -eq 0 ]]; then
            echo "Error: un servicio en segundo plano finalizó inesperadamente. Revisa los logs en $LOG_DIR" >&2
            exit 1
        fi
        return 0
    fi

    local sim_args=("$SIMULADOR_SCRIPT" --host "$BROKER_HOST" --port "$MQTT_PORT" --interval "$INTERVALO")
    if [[ -n "$DEMO_ANOMALIA" ]]; then
        sim_args+=(--demo-anomaly-after "$DEMO_ANOMALIA")
    fi

    local use_non_interactive=0
    if [[ "$NO_INTERACTIVO" -eq 1 || ! -t 0 ]]; then
        use_non_interactive=1
        sim_args+=(--non-interactive)
    fi

    if [[ "$use_non_interactive" -eq 1 ]]; then
        echo "Iniciando simulador en modo no interactivo (Ctrl+C o SIGTERM para detener)..."
        "$VENV_PY" "${sim_args[@]}" </dev/null &
        SIM_PID=$!
        PIDS+=("$SIM_PID")
        wait "$SIM_PID"
    else
        "$VENV_PY" "${sim_args[@]}"
    fi
}

main "$@"
