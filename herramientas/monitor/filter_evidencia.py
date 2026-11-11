from __future__ import annotations

import argparse
import atexit
from datetime import datetime
import os
from pathlib import Path
import re
import sys
from typing import TextIO

try:
    from platformio.device.monitor.filters.base import DeviceMonitorFilterBase
except ImportError:
    class DeviceMonitorFilterBase:  # type: ignore[no-redef]
        def __init__(self, options=None, *args, **kwargs):
            self.options = options or {}


CSV_HEADER_V1 = "ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,validez"
CSV_HEADER_V2 = (
    "ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,validez,"
    "tds0_ppm,anomalias,c_ph,c_tds,solicitud_captura"
)
CSV_HEADER_V3 = (
    "ms,temp_C,ph_mV,pH,tds_mV,tds_ppm,turb_mV,it,validez,"
    "tds0_ppm,vt0_mV,anomalias,c_ph,c_tds,c_turb,solicitud_captura"
)
CSV_HEADER = CSV_HEADER_V3
_NUM_OR_NAN = r"(?:-?\d+(?:\.\d+)?|nan|-?inf)"
CSV_ROW_V1_RE = re.compile(
    rf"^\d+,-?\d+(?:\.\d+)?,\d+,{_NUM_OR_NAN},\d+,{_NUM_OR_NAN},\d+$",
    re.IGNORECASE,
)
CSV_ROW_V2_RE = re.compile(
    rf"^\d+,-?\d+(?:\.\d+)?,\d+,{_NUM_OR_NAN},\d+,{_NUM_OR_NAN},\d+,{_NUM_OR_NAN},\d+,\d+,\d+,\d+$",
    re.IGNORECASE,
)
CSV_ROW_V3_RE = re.compile(
    rf"^\d+,-?\d+(?:\.\d+)?,\d+,{_NUM_OR_NAN},\d+,{_NUM_OR_NAN},\d+,{_NUM_OR_NAN},\d+,{_NUM_OR_NAN},{_NUM_OR_NAN},\d+,\d+,\d+,\d+,\d+$",
    re.IGNORECASE,
)
PUNTO_PH_RE = re.compile(
    r"^>>\s*Punto pH\s+([\d\.]+)\s+capturado:\s+(\d+)\s+mV",
    re.IGNORECASE,
)


def _sanitize_token(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip()).strip("_")


class SessionRecorder:
    def __init__(
        self,
        output_dir: Path,
        env_name: str,
        tag: str = "",
        timestamp: str | None = None,
    ) -> None:
        self.output_dir = Path(output_dir)
        clean_env = _sanitize_token(env_name) or "serial"
        clean_tag = _sanitize_token(tag)
        ts = timestamp or datetime.now().strftime("%Y%m%d_%H%M%S")
        self.stem = f"{clean_env}_{ts}_{clean_tag}" if clean_tag else f"{clean_env}_{ts}"
        self.log_path = self.output_dir / f"{self.stem}.log"
        self.csv_path = self.output_dir / f"{self.stem}.csv"

        self._log_fh: TextIO | None = None
        self._csv_fh: TextIO | None = None
        self._csv_header_written = False
        self._rx_buf = ""

    def _ensure_log_open(self) -> TextIO:
        if self._log_fh is None:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            self._log_fh = self.log_path.open("a", encoding="utf-8", newline="\n")
        return self._log_fh

    def _ensure_csv_open(self) -> TextIO:
        if self._csv_fh is None:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            self._csv_fh = self.csv_path.open("a", encoding="utf-8", newline="\n")
        return self._csv_fh

    def _process_line(self, line: str) -> None:
        log_fh = self._ensure_log_open()
        log_fh.write(line + "\n")
        log_fh.flush()

        stripped = line.strip()
        m_ph = PUNTO_PH_RE.match(stripped)
        if m_ph:
            ph_val = float(m_ph.group(1))
            mv_val = float(m_ph.group(2))
            self.output_dir.mkdir(parents=True, exist_ok=True)
            cal_path = self.output_dir / "calibracion.log"
            ts_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with cal_path.open("a", encoding="utf-8", newline="\n") as cal_fh:
                cal_fh.write(f"{ts_now} | pH | {ph_val:.2f} | {mv_val:.1f} | {self.stem}\n")

        if stripped in (CSV_HEADER_V1, CSV_HEADER_V2, CSV_HEADER_V3):
            csv_fh = self._ensure_csv_open()
            if not self._csv_header_written:
                csv_fh.write(stripped + "\n")
                csv_fh.flush()
                self._csv_header_written = True
        elif CSV_ROW_V3_RE.match(stripped):
            csv_fh = self._ensure_csv_open()
            if not self._csv_header_written:
                csv_fh.write(CSV_HEADER_V3 + "\n")
                self._csv_header_written = True
            csv_fh.write(stripped + "\n")
            csv_fh.flush()
        elif CSV_ROW_V2_RE.match(stripped):
            csv_fh = self._ensure_csv_open()
            if not self._csv_header_written:
                csv_fh.write(CSV_HEADER_V2 + "\n")
                self._csv_header_written = True
            csv_fh.write(stripped + "\n")
            csv_fh.flush()
        elif CSV_ROW_V1_RE.match(stripped):
            csv_fh = self._ensure_csv_open()
            if not self._csv_header_written:
                csv_fh.write(CSV_HEADER_V1 + "\n")
                self._csv_header_written = True
            csv_fh.write(stripped + "\n")
            csv_fh.flush()

    def feed_rx(self, text: str) -> None:
        if not text:
            return
        normalized = text.replace("\r\n", "\n").replace("\r", "\n")
        self._rx_buf += normalized
        while "\n" in self._rx_buf:
            line, self._rx_buf = self._rx_buf.split("\n", 1)
            self._process_line(line)

    def close(self) -> None:
        if self._rx_buf:
            residual = self._rx_buf
            self._rx_buf = ""
            self._process_line(residual)
        if self._log_fh is not None:
            self._log_fh.close()
            self._log_fh = None
        if self._csv_fh is not None:
            self._csv_fh.close()
            self._csv_fh = None


class EvidenciaFilter(DeviceMonitorFilterBase):
    NAME = "evidencia"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._recorder: SessionRecorder | None = None

    def __call__(self):
        project_dir = self.options.get("project_dir") if hasattr(self, "options") and self.options else None
        if project_dir:
            base_project = Path(project_dir).resolve()
        else:
            base_project = Path(__file__).resolve().parent.parent

        output_dir = base_project.parent / "pruebas"
        env_name = (
            (self.options.get("environment") if hasattr(self, "options") and self.options else None)
            or os.environ.get("PIOENV")
            or "serial"
        )
        tag = os.environ.get("PRUEBA", "").strip()

        self._recorder = SessionRecorder(output_dir=output_dir, env_name=str(env_name), tag=tag)
        sys.stderr.write(
            f"--- [evidencia] Guardando sesion en pruebas/{self._recorder.stem}.log (y .csv si hay datos CSV) ---\n"
        )
        sys.stderr.flush()
        atexit.register(self.close)
        return self

    def rx(self, text: str) -> str:
        if self._recorder is not None:
            self._recorder.feed_rx(text)
        return text

    def tx(self, text: str) -> str:
        return text

    def close(self) -> None:
        if self._recorder is not None:
            self._recorder.close()

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass


def _run_cli() -> int:
    parser = argparse.ArgumentParser(
        description="Guarda la salida del monitor serial en pruebas/<env>_<fecha>.log y .csv"
    )
    parser.add_argument("--env", default=os.environ.get("PIOENV", "sensores"), help="Nombre del programa/entorno")
    parser.add_argument("--prueba", default=os.environ.get("PRUEBA", ""), help="Etiqueta opcional del ensayo")
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parents[2] / "pruebas"),
        help="Carpeta destino (por defecto: pruebas/)",
    )
    parser.add_argument("--port", default="", help="Puerto serial opcional (ej. /dev/ttyUSB0 o COM3)")
    parser.add_argument("--baud", type=int, default=115200, help="Baudrate cuando se usa --port")
    args = parser.parse_args()

    recorder = SessionRecorder(output_dir=Path(args.output_dir), env_name=args.env, tag=args.prueba)
    sys.stderr.write(
        f"--- [evidencia] Guardando sesion en pruebas/{recorder.stem}.log (y .csv si hay datos CSV) ---\n"
    )
    sys.stderr.flush()

    try:
        if args.port:
            import serial  # type: ignore[import-not-found]

            with serial.Serial(args.port, args.baud, timeout=0.2) as ser:
                while True:
                    chunk = ser.read(256)
                    if not chunk:
                        continue
                    text = chunk.decode("utf-8", errors="replace")
                    sys.stdout.write(text)
                    sys.stdout.flush()
                    recorder.feed_rx(text)
        else:
            for line in sys.stdin:
                sys.stdout.write(line)
                sys.stdout.flush()
                recorder.feed_rx(line)
    except KeyboardInterrupt:
        pass
    finally:
        recorder.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(_run_cli())
