#!/usr/bin/env python3
"""
Grabador de mensajes MQTT a CSV para evidencia de pruebas en QawapMayu.

Se suscribe a qawapmayu/v1/# y guarda cada mensaje recibido en:
  pruebas/mqtt_<AAAAMMDD_HHMMSS>[_<PRUEBA>].csv
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime
import os
from pathlib import Path
import re
import signal
import sys
import threading
from typing import Any, TextIO


CSV_COLUMNS = [
    "ts_local_iso",
    "topico",
    "zona",
    "sitio",
    "nodo",
    "canal",
    "retain",
    "payload",
]


def _import_mqtt() -> Any:
    try:
        import paho.mqtt.client as mqtt  # type: ignore[import-not-found]
    except ImportError:
        print(
            "Error: falta el paquete 'paho-mqtt' (>=2.0) en este intérprete.\n"
            "Ejecuta con: herramientas/.venv/bin/python herramientas/registro_mqtt.py\n"
            "O instálalo en el venv con: herramientas/.venv/bin/pip install -r herramientas/requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return mqtt


def _sanitize_token(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip()).strip("_")


def _reason_ok(reason_code: Any) -> bool:
    if hasattr(reason_code, "is_failure"):
        return not bool(reason_code.is_failure)
    return reason_code == 0


def parse_topic(topic: str) -> tuple[str, str, str, str]:
    """Descompone tópicos qawapmayu/v1/... en (zona, sitio, nodo, canal)."""
    parts = topic.split("/")
    if len(parts) >= 6 and parts[0] == "qawapmayu" and parts[1] == "v1":
        return parts[2], parts[3], parts[4], "/".join(parts[5:])
    if len(parts) == 5 and parts[0] == "qawapmayu" and parts[1] == "v1":
        # Tópico de gateway: qawapmayu/v1/gw/gw01/conexion
        return parts[2], parts[3], parts[3], parts[4]
    if len(parts) >= 3 and parts[0] == "qawapmayu" and parts[1] == "v1":
        return parts[2], "", "", "/".join(parts[3:])
    return "", "", "", topic


def build_csv_path(output_dir: Path, tag: str, timestamp: str | None = None) -> Path:
    clean_tag = _sanitize_token(tag)
    ts = timestamp or datetime.now().strftime("%Y%m%d_%H%M%S")
    stem = f"mqtt_{ts}_{clean_tag}" if clean_tag else f"mqtt_{ts}"
    base_dir = Path(output_dir)
    candidate = base_dir / f"{stem}.csv"
    idx = 1
    while candidate.exists():
        candidate = base_dir / f"{stem}_{idx}.csv"
        idx += 1
    return candidate


class MqttCsvRecorder:
    """Escribe de forma segura y con flush inmediato cada mensaje MQTT en CSV."""

    def __init__(self, csv_path: Path) -> None:
        self.csv_path = Path(csv_path)
        self._lock = threading.Lock()
        self._fh: TextIO | None = None
        self._writer: Any = None
        self.count = 0

    def open(self) -> None:
        with self._lock:
            self.csv_path.parent.mkdir(parents=True, exist_ok=True)
            self._fh = self.csv_path.open("w", encoding="utf-8", newline="")
            self._writer = csv.writer(self._fh)
            self._writer.writerow(CSV_COLUMNS)
            self._fh.flush()

    def record(self, topic: str, retain: bool, payload_bytes: bytes) -> None:
        ts_local = datetime.now().astimezone().isoformat(timespec="milliseconds")
        zona, sitio, nodo, canal = parse_topic(topic)
        payload = payload_bytes.decode("utf-8", errors="replace")
        retain_val = 1 if retain else 0

        with self._lock:
            if self._fh is None or self._writer is None:
                return
            self._writer.writerow(
                [ts_local, topic, zona, sitio, nodo, canal, retain_val, payload]
            )
            self._fh.flush()
            self.count += 1

    def close(self) -> None:
        with self._lock:
            if self._fh is not None:
                self._fh.flush()
                self._fh.close()
                self._fh = None
                self._writer = None


def _build_parser() -> argparse.ArgumentParser:
    default_out = str(Path(__file__).resolve().parents[1] / "pruebas")
    parser = argparse.ArgumentParser(
        description="Registra mensajes MQTT de qawapmayu/v1/# en un archivo CSV dentro de pruebas/"
    )
    parser.add_argument("--host", default="localhost", help="Host del broker MQTT (por defecto: localhost)")
    parser.add_argument("--port", type=int, default=1883, help="Puerto MQTT (por defecto: 1883)")
    parser.add_argument(
        "--prueba",
        default=os.environ.get("PRUEBA", ""),
        help="Etiqueta opcional del ensayo (por defecto: variable de entorno PRUEBA)",
    )
    parser.add_argument(
        "--output-dir",
        default=default_out,
        help="Carpeta destino (por defecto: <repo>/pruebas)",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=None,
        help="Duración opcional en segundos tras la cual finaliza limpiamente",
    )
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    if args.duration is not None and args.duration < 0:
        print("Error: --duration no puede ser negativo.", file=sys.stderr)
        return 2

    mqtt_mod = _import_mqtt()

    stop_event = threading.Event()
    connected_event = threading.Event()

    def _on_signal(signum: int, _frame: Any) -> None:
        stop_event.set()

    signal.signal(signal.SIGINT, _on_signal)
    signal.signal(signal.SIGTERM, _on_signal)

    csv_path = build_csv_path(Path(args.output_dir), args.prueba)
    recorder = MqttCsvRecorder(csv_path)

    client = mqtt_mod.Client(
        callback_api_version=mqtt_mod.CallbackAPIVersion.VERSION2,
        client_id=f"qawapmayu-registro-{os.getpid()}",
    )

    def _on_connect(
        cl: Any,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any,
    ) -> None:
        if not _reason_ok(reason_code):
            print(
                f"Error: conexión rechazada por el broker MQTT ({reason_code}).",
                file=sys.stderr,
                flush=True,
            )
            return
        cl.subscribe("qawapmayu/v1/#", qos=1)
        connected_event.set()

    def _on_message(cl: Any, userdata: Any, message: Any) -> None:
        recorder.record(message.topic, bool(message.retain), message.payload)

    client.on_connect = _on_connect
    client.on_message = _on_message

    try:
        client.connect(args.host, args.port, keepalive=30)
    except OSError as exc:
        print(
            f"Error: no se pudo conectar al broker MQTT en {args.host}:{args.port} ({exc}).\n"
            "¿Ejecutaste ./broker/iniciar.sh?",
            file=sys.stderr,
        )
        return 1

    recorder.open()
    client.loop_start()

    try:
        if not connected_event.wait(timeout=10.0):
            print(
                f"Error: tiempo agotado esperando CONNACK del broker en {args.host}:{args.port}.",
                file=sys.stderr,
            )
            return 1

        print(
            f"--- [registro_mqtt] Suscrito a qawapmayu/v1/# en {args.host}:{args.port} "
            f"-> {csv_path} ---",
            flush=True,
        )
        stop_event.wait(timeout=args.duration)
    finally:
        try:
            client.disconnect()
        except Exception:
            pass
        client.loop_stop()
        recorder.close()

    print(
        f"--- [registro_mqtt] Cerrado ({recorder.count} mensajes guardados en {csv_path}) ---",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
