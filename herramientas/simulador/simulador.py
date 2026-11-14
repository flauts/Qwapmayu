#!/usr/bin/env python3
"""
Simulador de estaciones adicionales (qm02 y qm03) para QawapMayu sobre MQTT.

Publica por MQTT usando el mismo esquema de tópicos y JSON que el gateway GW01:
  - qawapmayu/v1/barranco/bajada-banos/qm02/...
  - qawapmayu/v1/chorrillos/pantanos-villa/qm03/...
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
import json
import os
import random
import select
import signal
import sys
import threading
import time
from typing import Any


def _import_mqtt() -> Any:
    try:
        import paho.mqtt.client as mqtt  # type: ignore[import-not-found]
    except ImportError:
        print(
            "Error: falta el paquete 'paho-mqtt' (>=2.0) en este intérprete.\n"
            "Ejecuta con: herramientas/.venv/bin/python herramientas/simulador/simulador.py\n"
            "O instálalo en el venv con: herramientas/.venv/bin/pip install -r herramientas/requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return mqtt


def _reason_ok(reason_code: Any) -> bool:
    if hasattr(reason_code, "is_failure"):
        return not bool(reason_code.is_failure)
    return reason_code == 0


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass(frozen=True)
class StationSpec:
    zona: str
    sitio: str
    nodo: str
    nombre: str
    lat: float
    lon: float
    ph_base: float
    tds_base: float
    it_base: float
    temp_base: float
    rssi_range: tuple[int, int]
    snr_range: tuple[int, int]
    anom_mode: str  # "tds_turb" | "ph_tds"

    @property
    def prefix(self) -> str:
        return f"qawapmayu/v1/{self.zona}/{self.sitio}/{self.nodo}"

    @property
    def meta_payload(self) -> dict[str, Any]:
        return {
            "nombre": self.nombre,
            "zona": self.zona,
            "lat": self.lat,
            "lon": self.lon,
            "simulado": True,
        }


STATIONS: tuple[StationSpec, ...] = (
    StationSpec(
        zona="barranco",
        sitio="bajada-banos",
        nodo="qm02",
        nombre="Bajada de Baños",
        lat=-12.1497,
        lon=-77.0225,
        ph_base=7.30,
        tds_base=210.0,
        it_base=0.040,
        temp_base=22.50,
        rssi_range=(-66, -56),
        snr_range=(8, 11),
        anom_mode="tds_turb",
    ),
    StationSpec(
        zona="chorrillos",
        sitio="pantanos-villa",
        nodo="qm03",
        nombre="Pantanos de Villa",
        lat=-12.2097,
        lon=-76.9894,
        ph_base=7.60,
        tds_base=420.0,
        it_base=0.080,
        temp_base=24.00,
        rssi_range=(-76, -65),
        snr_range=(6, 10),
        anom_mode="ph_tds",
    ),
)

ANO_PH = 0x01
ANO_TDS = 0x02
ANO_TURB = 0x04
VAL_ALL = 15
CICLOS_PERSISTENCIA = 3
CICLOS_NORMALES_REARME = 3


class SimulatedStation:
    """Gestiona un cliente MQTT independiente y la FSM de una estación simulada."""

    def __init__(self, spec: StationSpec, mqtt_mod: Any, rng: random.Random) -> None:
        self.spec = spec
        self._mqtt = mqtt_mod
        self._rng = rng
        self._lock = threading.Lock()

        self.connected = False
        self.connected_event = threading.Event()

        self.estado = "ARMADO"
        self.anomalias = 0
        self.evento = 0
        self.seq = 0
        self.boot = 1

        self._pending_anomaly = False
        self._anomaly_cycles_left = 0
        self._enter_sampling_next = False
        self._after_sampling_next = False
        self._block_next = False
        self._normal_cycles_blocked = 0
        self._rearm_requested = False

        self._last_estado_sig: tuple[str, int] | None = None
        self._last_evento_published = 0

        self.client = mqtt_mod.Client(
            callback_api_version=mqtt_mod.CallbackAPIVersion.VERSION2,
            client_id=f"qawapmayu-sim-{spec.nodo}-{os.getpid():x}",
        )
        self.client.will_set(
            self.topic("conexion"),
            payload="fuera_de_linea",
            qos=1,
            retain=True,
        )
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect

    def topic(self, channel: str) -> str:
        return f"{self.spec.prefix}/{channel}"

    def _on_connect(
        self,
        client: Any,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any,
    ) -> None:
        if not _reason_ok(reason_code):
            print(
                f"[{self.spec.nodo}] Conexión rechazada por el broker: {reason_code}",
                file=sys.stderr,
                flush=True,
            )
            return

        self.connected = True
        client.publish(self.topic("conexion"), payload="en_linea", qos=1, retain=True)
        client.publish(
            self.topic("meta"),
            payload=json.dumps(self.spec.meta_payload, ensure_ascii=False),
            qos=1,
            retain=True,
        )
        with self._lock:
            if self._last_estado_sig is not None:
                ts_ms = int(time.time() * 1000)
                client.publish(
                    self.topic("estado"),
                    payload=json.dumps(
                        {
                            "estado": self.estado,
                            "anomalias": self.anomalias,
                            "ts": ts_ms,
                        },
                        ensure_ascii=False,
                    ),
                    qos=1,
                    retain=True,
                )
        self.connected_event.set()
        print(
            f"[{self.spec.nodo}] Conectado ({self.spec.prefix}/...)",
            flush=True,
        )

    def _on_disconnect(
        self,
        client: Any,
        userdata: Any,
        disconnect_flags: Any,
        reason_code: Any,
        properties: Any,
    ) -> None:
        self.connected = False

    def connect(self, host: str, port: int) -> None:
        self.client.connect(host, port, keepalive=30)
        self.client.loop_start()

    def trigger_anomaly(self) -> str:
        with self._lock:
            if self.estado != "ARMADO":
                return (
                    f"[{self.spec.nodo}] Anomalía ignorada: estado actual {self.estado} "
                    "(usa 'r' para rearmar si está BLOQUEADO)"
                )
            if self._pending_anomaly or self._anomaly_cycles_left > 0:
                return f"[{self.spec.nodo}] Secuencia de anomalía ya en curso"
            self._pending_anomaly = True
            return (
                f"[{self.spec.nodo}] Anomalía activada: "
                "3 ciclos anómalos -> MUESTREANDO -> CAPTURA_ESTIMADA -> BLOQUEADO"
            )

    def request_rearm(self) -> str:
        with self._lock:
            if self.estado == "ARMADO":
                return f"[{self.spec.nodo}] Ya está ARMADO"
            if self.estado in ("MUESTREANDO", "CAPTURA_ESTIMADA"):
                return f"[{self.spec.nodo}] Rearme diferido: captura en curso ({self.estado})"
            self._rearm_requested = True
            if self._normal_cycles_blocked >= CICLOS_NORMALES_REARME:
                return (
                    f"[{self.spec.nodo}] Rearme confirmado "
                    f"({self._normal_cycles_blocked}/{CICLOS_NORMALES_REARME} ciclos normales) -> "
                    "pasará a ARMADO en el siguiente ciclo"
                )
            return (
                f"[{self.spec.nodo}] Rearme solicitado "
                f"({self._normal_cycles_blocked}/{CICLOS_NORMALES_REARME} ciclos normales)"
            )

    def _sample_normal(self) -> tuple[float, int, float, float, int]:
        ph = round(_clamp(self._rng.gauss(self.spec.ph_base, 0.04), 6.75, 8.25), 2)
        tds_raw = self._rng.gauss(self.spec.tds_base, 7.0)
        tds = int(round(_clamp(tds_raw, self.spec.tds_base - 40.0, self.spec.tds_base + 40.0)))
        it = round(_clamp(self._rng.gauss(self.spec.it_base, 0.006), 0.005, 0.160), 3)
        temp = round(self._rng.gauss(self.spec.temp_base, 0.14), 2)
        return ph, tds, it, temp, 0

    def _sample_anomalous(self) -> tuple[float, int, float, float, int]:
        ph, tds, it, temp, _ = self._sample_normal()
        anomalias = 0
        if self.spec.anom_mode == "tds_turb":
            tds = int(round(self._rng.uniform(460.0, 530.0)))
            it = round(self._rng.uniform(0.320, 0.430), 3)
            anomalias = ANO_TDS | ANO_TURB
        else:
            ph = round(self._rng.uniform(5.55, 5.95), 2)
            tds = int(round(self._rng.uniform(680.0, 760.0)))
            anomalias = ANO_PH | ANO_TDS
        return ph, tds, it, temp, anomalias

    def step(self) -> None:
        if not self.connected:
            return

        with self._lock:
            is_anomalous_reading = False

            if self._enter_sampling_next:
                self._enter_sampling_next = False
                self.estado = "MUESTREANDO"
                self.evento += 1
                self._after_sampling_next = True
                is_anomalous_reading = True
            elif self._after_sampling_next:
                self._after_sampling_next = False
                self.estado = "CAPTURA_ESTIMADA"
                self._block_next = True
            elif self._block_next:
                self._block_next = False
                self.estado = "BLOQUEADO"
                self._normal_cycles_blocked = 1
            elif self.estado == "BLOQUEADO":
                self._normal_cycles_blocked += 1
                if self._rearm_requested and self._normal_cycles_blocked >= CICLOS_NORMALES_REARME:
                    self._rearm_requested = False
                    self._normal_cycles_blocked = 0
                    self.estado = "ARMADO"
            elif self.estado == "ARMADO":
                if self._pending_anomaly:
                    self._pending_anomaly = False
                    self._anomaly_cycles_left = CICLOS_PERSISTENCIA
                if self._anomaly_cycles_left > 0:
                    is_anomalous_reading = True
                    self._anomaly_cycles_left -= 1
                    if self._anomaly_cycles_left == 0:
                        self._enter_sampling_next = True

            if is_anomalous_reading:
                ph, tds, it, temp, anomalias = self._sample_anomalous()
            else:
                ph, tds, it, temp, anomalias = self._sample_normal()

            self.anomalias = anomalias
            self.seq += 1
            seq = self.seq
            boot = self.boot
            estado = self.estado
            evento = self.evento

            estado_sig = (estado, anomalias)
            estado_changed = estado_sig != self._last_estado_sig
            self._last_estado_sig = estado_sig

            evento_changed = evento > 0 and evento != self._last_evento_published
            if evento_changed:
                self._last_evento_published = evento

        ts_ms = int(time.time() * 1000)
        rssi = self._rng.randint(*self.spec.rssi_range)
        snr = self._rng.randint(*self.spec.snr_range)
        pdr = 100.0

        telemetria = {
            "ts": ts_ms,
            "ph": ph,
            "tds": tds,
            "it": it,
            "temp": temp,
            "validez": VAL_ALL,
            "anomalias": anomalias,
            "estado": estado,
            "evento": evento,
            "seq": seq,
            "boot": boot,
            "rssi": rssi,
            "snr": snr,
            "pdr": pdr,
        }
        enlace = {
            "rssi": rssi,
            "snr": snr,
            "pdr": pdr,
            "seq": seq,
            "boot": boot,
        }

        self.client.publish(
            self.topic("telemetria"),
            payload=json.dumps(telemetria, ensure_ascii=False),
            qos=1,
            retain=True,
        )
        self.client.publish(
            self.topic("enlace"),
            payload=json.dumps(enlace, ensure_ascii=False),
            qos=1,
            retain=True,
        )

        if estado_changed:
            self.client.publish(
                self.topic("estado"),
                payload=json.dumps(
                    {"estado": estado, "anomalias": anomalias, "ts": ts_ms},
                    ensure_ascii=False,
                ),
                qos=1,
                retain=True,
            )

        if evento_changed:
            self.client.publish(
                self.topic("evento"),
                payload=json.dumps(
                    {"evento": evento, "estado": estado, "ts": ts_ms},
                    ensure_ascii=False,
                ),
                qos=1,
                retain=True,
            )

        hora = datetime.now().strftime("%H:%M:%S")
        print(
            f"[{hora}] {self.spec.nodo} seq={seq} estado={estado} ano=0x{anomalias:02X} "
            f"ev={evento} pH={ph:.2f} TDS={tds} IT={it:.3f} T={temp:.2f}C "
            f"RSSI={rssi} SNR={snr}",
            flush=True,
        )

    def shutdown(self) -> None:
        try:
            if self.connected:
                info = self.client.publish(
                    self.topic("conexion"),
                    payload="fuera_de_linea",
                    qos=1,
                    retain=True,
                )
                try:
                    info.wait_for_publish(timeout=2.0)
                except Exception:
                    pass
                self.client.disconnect()
        except Exception:
            pass
        finally:
            try:
                self.client.loop_stop()
            except Exception:
                pass


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Simulador MQTT de estaciones qm02 (Bajada de Baños) y qm03 (Pantanos de Villa)"
    )
    parser.add_argument("--host", default="localhost", help="Host del broker MQTT (por defecto: localhost)")
    parser.add_argument("--port", type=int, default=1883, help="Puerto MQTT (por defecto: 1883)")
    parser.add_argument(
        "--interval",
        type=float,
        default=5.0,
        help="Intervalo entre lecturas en segundos (por defecto: 5.0)",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Desactiva lectura de teclado en terminal (ideal para pruebas automatizadas)",
    )
    parser.add_argument(
        "--demo-anomaly-after",
        type=float,
        default=None,
        help="Segundos desde el inicio para disparar automáticamente una anomalía en qm02 una vez",
    )
    return parser


def _handle_key(key: str, stations: dict[str, SimulatedStation], stop_event: threading.Event) -> None:
    ch = key.lower()
    if ch in ("2", "a"):
        print(stations["qm02"].trigger_anomaly(), flush=True)
    elif ch == "3":
        print(stations["qm03"].trigger_anomaly(), flush=True)
    elif ch == "r":
        rearmed_any = False
        for st in stations.values():
            with st._lock:
                not_armado = st.estado != "ARMADO"
            if not_armado:
                rearmed_any = True
                print(st.request_rearm(), flush=True)
        if not rearmed_any:
            print("Todas las estaciones ya están en ARMADO.", flush=True)
    elif ch == "q":
        print("Salida solicitada ('q'); publicando fuera_de_linea...", flush=True)
        stop_event.set()


def main() -> int:
    args = _build_parser().parse_args()
    if args.interval <= 0:
        print("Error: --interval debe ser mayor a 0.", file=sys.stderr)
        return 2

    mqtt_mod = _import_mqtt()

    stop_event = threading.Event()

    def _on_signal(signum: int, _frame: Any) -> None:
        stop_event.set()

    signal.signal(signal.SIGINT, _on_signal)
    signal.signal(signal.SIGTERM, _on_signal)

    rng = random.Random()
    stations_list = [SimulatedStation(spec, mqtt_mod, rng) for spec in STATIONS]
    stations_by_id = {st.spec.nodo: st for st in stations_list}

    for st in stations_list:
        try:
            st.connect(args.host, args.port)
        except OSError as exc:
            print(
                f"Error: no se pudo conectar al broker MQTT en {args.host}:{args.port} ({exc}).\n"
                "¿Ejecutaste ./broker/iniciar.sh?",
                file=sys.stderr,
            )
            for started in stations_list:
                started.shutdown()
            return 1

    deadline_conn = time.monotonic() + 10.0
    for st in stations_list:
        remaining = max(0.0, deadline_conn - time.monotonic())
        if not st.connected_event.wait(timeout=remaining):
            print(
                f"Error: tiempo agotado esperando CONNACK para {st.spec.nodo} en {args.host}:{args.port}.",
                file=sys.stderr,
            )
            for started in stations_list:
                started.shutdown()
            return 1

    interactive = (not args.non_interactive) and sys.stdin.isatty()
    old_termios = None
    stdin_fd = None
    if interactive:
        try:
            import termios
            import tty

            stdin_fd = sys.stdin.fileno()
            old_termios = termios.tcgetattr(stdin_fd)
            tty.setcbreak(stdin_fd)
            print(
                "Controles interactivos: [2/a] anomalía qm02 | [3] anomalía qm03 | [r] rearmar | [q] salir",
                flush=True,
            )
        except Exception:
            interactive = False
            old_termios = None
            stdin_fd = None

    start_mono = time.monotonic()
    demo_deadline = (
        start_mono + max(0.0, args.demo_anomaly_after)
        if args.demo_anomaly_after is not None
        else None
    )
    demo_triggered = False
    next_tick = start_mono

    try:
        while not stop_event.is_set():
            now = time.monotonic()

            if demo_deadline is not None and not demo_triggered and now >= demo_deadline:
                demo_triggered = True
                print(
                    f"[demo] Disparando anomalía automática tras {args.demo_anomaly_after} s: "
                    + stations_by_id["qm02"].trigger_anomaly(),
                    flush=True,
                )

            if now >= next_tick:
                for st in stations_list:
                    st.step()
                next_tick += args.interval
                if next_tick < time.monotonic():
                    next_tick = time.monotonic() + args.interval

            wait_until = next_tick
            if demo_deadline is not None and not demo_triggered:
                wait_until = min(wait_until, demo_deadline)
            slice_sec = max(0.02, min(0.2, wait_until - time.monotonic()))

            if interactive and stdin_fd is not None:
                readable, _, _ = select.select([stdin_fd], [], [], slice_sec)
                if readable:
                    ch = os.read(stdin_fd, 1).decode("utf-8", errors="ignore")
                    if ch:
                        _handle_key(ch, stations_by_id, stop_event)
            else:
                stop_event.wait(timeout=slice_sec)
    finally:
        if old_termios is not None and stdin_fd is not None:
            try:
                import termios

                termios.tcsetattr(stdin_fd, termios.TCSADRAIN, old_termios)
            except Exception:
                pass
        for st in stations_list:
            st.shutdown()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
