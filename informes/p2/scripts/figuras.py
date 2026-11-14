#!/usr/bin/env python3
"""Figuras de resultados del Informe final P2 de QawapMayu.

Lee directamente los archivos de evidencia de pruebas/ (CSV y logs) y escribe
las figuras en informes/p2/figuras/ como PDF. Además imprime las cifras que se
citan en el informe, para que cada número sea reproducible.

Uso (desde la raíz del repositorio):
    python3 informes/p2/scripts/figuras.py
Requiere: matplotlib (pip install matplotlib).
"""
from __future__ import annotations

import csv
import math
import re
import statistics as st
import struct
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

RAIZ = Path(__file__).resolve().parents[3]
PRUEBAS = RAIZ / "pruebas"
SALIDA = RAIZ / "informes" / "p2" / "figuras"

# Paleta categórica validada (slots 1 y 2) y tinta neutra para umbrales/ejes.
AZUL = "#2a78d6"
NARANJA = "#eb6834"
GRIS = "#6b6a63"
TINTA = "#2b2b28"
SOMBRA = "#e9e8e3"

plt.rcParams.update({
    "font.family": "serif",
    "font.size": 9,
    "axes.edgecolor": GRIS,
    "axes.labelcolor": TINTA,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "grid.color": "#dcdbd5",
    "grid.linewidth": 0.5,
    "xtick.color": GRIS,
    "ytick.color": GRIS,
    "legend.frameon": False,
    "lines.linewidth": 1.2,
    "savefig.bbox": "tight",
})

# Formato de la trama (comun/trama.h): 27 bytes, little-endian.
TRAMA = struct.Struct("<BBHIIhHhhBBBHH")
ESTADOS = ["BLOQUEADO", "ARMADO", "MUESTREANDO", "CAPTURA_ESTIMADA", "FALLO"]


def leer_csv(nombre: str) -> list[dict]:
    with open(PRUEBAS / nombre, newline="") as f:
        return list(csv.DictReader(f))


def tramos(filas: list[dict]) -> list[list[dict]]:
    """Separa el registro en tramos cuando 'ms' retrocede (reinicio del ESP32)."""
    out: list[list[dict]] = [[]]
    for r in filas:
        if out[-1] and num(r["ms"]) < num(out[-1][-1]["ms"]):
            out.append([])
        out[-1].append(r)
    return out


def num(x: str) -> float:
    try:
        return float(x)
    except ValueError:
        return math.nan


def hora_a_s(h: str, m: str, s: str) -> float:
    return int(h) * 3600 + int(m) * 60 + float(s)


# ---------------------------------------------------------------- R1
def fig_turbidez() -> None:
    corridas = [
        ("r2", "sensores_20261109_122710_turb_gpio4_maicena_r2.csv", AZUL),
        ("r3", "sensores_20261109_194826_turb_gpio4_maicena_r3.csv", NARANJA),
    ]
    fig, ax = plt.subplots(figsize=(6.3, 2.8))
    print("R1 turbidez con maicena")
    for nombre, archivo, color in corridas:
        tramo = max(tramos(leer_csv(archivo)), key=len)
        filas = [r for r in tramo if not math.isnan(num(r["it"]))]
        it = [num(r["it"]) for r in filas]
        # Disparo: primera de 3 filas consecutivas con IT > 0.200
        k = next(i for i in range(len(it) - 2) if min(it[i:i + 3]) > 0.200)
        t0 = num(filas[k]["ms"])
        t = [(num(r["ms"]) - t0) / 1000 for r in filas]
        base = st.mean(it[max(0, k - 60):max(1, k - 5)])
        ax.plot(t, it, color=color, label=f"Réplica {nombre}")
        print(f"  {nombre}: tramo de {len(tramo)} filas, {len(filas)} válidas, base IT {base:.3f} "
              f"(60 filas previas), IT máx {max(it):.3f}, delta pico {max(it) - base:.3f} ({archivo})")
    ax.axhline(0.200, color=GRIS, linestyle="--", linewidth=1)
    ax.text(0.99, 0.200, "umbral IT = 0.200", transform=ax.get_yaxis_transform(),
            ha="right", va="bottom", color=GRIS, fontsize=8)
    ax.set_xlabel("Tiempo relativo al disparo (s); disparo = 3 lecturas seguidas sobre el umbral")
    ax.axvline(0, color=GRIS, linewidth=0.6, linestyle=":")
    ax.set_ylabel("Índice de turbidez $I_T$")
    ax.legend(loc="upper right")
    fig.savefig(SALIDA / "r1_turbidez_maicena.pdf")
    plt.close(fig)


# ---------------------------------------------------------------- R2
def fig_tds() -> None:
    base = leer_csv("sensores_20261111_202348_cal_tds_base.csv")
    sal_todo = tramos(leer_csv("sensores_20261111_223040_cal_tds_base.csv"))
    sal = sal_todo[0]  # antes del reinicio; el 2.º tramo re-fija TDS0 con agua salada
    fig, (a, b) = plt.subplots(1, 2, figsize=(6.3, 2.6), sharey=True)

    t0 = num(base[0]["ms"])
    tb = [(num(r["ms"]) - t0) / 1000 for r in base]
    vb = [num(r["tds_ppm"]) for r in base]
    a.plot(tb, vb, color=AZUL, linewidth=0.8)
    media = st.mean(vb)
    a.axhline(media, color=GRIS, linestyle=":", linewidth=1)
    a.text(0.98, 255, f"media {media:.0f} ppm", transform=a.get_yaxis_transform(),
           ha="right", va="bottom", color=GRIS, fontsize=8)
    a.set_title("(a) Agua de caño, línea base", fontsize=9, color=TINTA)
    a.set_xlabel("Tiempo (s)")
    a.set_ylabel("TDS (ppm)")

    t0 = num(sal[0]["ms"])
    ts = [(num(r["ms"]) - t0) / 1000 for r in sal]
    vs = [num(r["tds_ppm"]) for r in sal]
    umbral = [num(r["tds0_ppm"]) + 100 for r in sal]
    b.plot(ts, vs, color=AZUL, linewidth=0.8, label="TDS medido")
    b.plot(ts, umbral, color=GRIS, linestyle="--", linewidth=1, label="umbral TDS$_0$ + 100")
    b.set_title("(b) Tras agregar sal", fontsize=9, color=TINTA)
    b.set_xlabel("Tiempo (s)")
    b.legend(loc="upper right", fontsize=8)
    fig.savefig(SALIDA / "r2_tds.pdf")
    plt.close(fig)

    print("R2 TDS")
    print(f"  base: {len(vb)} filas, media {media:.0f}, desv {st.stdev(vb):.0f}, "
          f"rango {min(vb):.0f}-{max(vb):.0f} ppm")
    tds0 = sorted({num(r['tds0_ppm']) for r in sal})
    sol = sum(1 for r in sal if r["solicitud_captura"] == "1")
    t2 = sal_todo[1] if len(sal_todo) > 1 else []
    if t2:
        v2 = [num(r["tds_ppm"]) for r in t2]
        print(f"  sal tramo 2 (tras reinicio): {len(t2)} filas, TDS0 {sorted({num(r['tds0_ppm']) for r in t2})}, "
              f"rango {min(v2):.0f}-{max(v2):.0f}, solicitud=1 en {sum(r['solicitud_captura'] == '1' for r in t2)} filas")
    print(f"  sal tramo 1: {len(vs)} filas, rango {min(vs):.0f}-{max(vs):.0f} ppm, "
          f"TDS0 registrados {tds0}, filas con solicitud_captura=1: {sol}")


# ---------------------------------------------------------------- R3
def fig_lora() -> None:
    tx: dict[int, float] = {}
    rx: dict[int, tuple[float, int, int]] = {}
    for linea in open(PRUEBAS / "nodo_20261110_005911_p7_1m_nodo.log", errors="ignore"):
        m = re.match(r"(\d+):(\d+):([\d.]+) > TX seq=(\d+)", linea)
        if m:
            tx[int(m[4])] = hora_a_s(m[1], m[2], m[3])
    for linea in open(PRUEBAS / "gateway_20261110_005746_p7_1m_gw.log", errors="ignore"):
        m = re.match(r"(\d+):(\d+):([\d.]+) > RX seq=(\d+).*rssi=(-?\d+) snr=(-?\d+)", linea)
        if m:
            rx[int(m[4])] = (hora_a_s(m[1], m[2], m[3]), int(m[5]), int(m[6]))
    lo, hi = max(min(tx), min(rx)), min(max(tx), max(rx))
    enviados = [s for s in tx if lo <= s <= hi]
    recibidos = [s for s in rx if lo <= s <= hi]
    comunes = sorted(set(enviados) & set(recibidos))
    lat = [(rx[s][0] - tx[s]) * 1000 for s in comunes]
    rssi = [rx[s][1] for s in comunes]
    snr = [rx[s][2] for s in comunes]

    fig, (a, b) = plt.subplots(1, 2, figsize=(6.3, 2.5))
    a.plot(comunes, lat, color=AZUL, marker="o", markersize=2.5, linewidth=0.6)
    a.set_xlabel("Número de secuencia")
    a.set_ylabel("Latencia RX − TX (ms)")
    a.set_ylim(min(lat) - 5, max(lat) + 5)
    a.set_title("(a) Latencia por trama", fontsize=9, color=TINTA)
    b.plot(comunes, rssi, color=AZUL, marker="o", markersize=2.5, linewidth=0.6)
    b.set_xlabel("Número de secuencia")
    b.set_ylabel("RSSI (dBm)")
    b.set_ylim(min(rssi) - 3, max(rssi) + 3)
    b.set_title("(b) Potencia recibida", fontsize=9, color=TINTA)
    fig.tight_layout()
    fig.savefig(SALIDA / "r3_lora.pdf")
    plt.close(fig)

    print("R3 LoRa p7 a 1 m")
    print(f"  ventana común seq {lo}-{hi}: enviadas {len(enviados)}, recibidas {len(recibidos)}, "
          f"PDR {100 * len(recibidos) / len(enviados):.1f} %")
    print(f"  latencia min/mediana/max {min(lat):.0f}/{st.median(lat):.0f}/{max(lat):.0f} ms; "
          f"RSSI {min(rssi)} a {max(rssi)} dBm; SNR {min(snr)} a {max(snr)} dB")


# ---------------------------------------------------------------- R4
def fig_ciclo() -> None:
    archivo = PRUEBAS / "nodo_20261107_225307.log"
    puntos = []          # (t_s, it, estado)
    transiciones = []    # (t_s, origen, destino)
    for linea in open(archivo, errors="ignore"):
        m = re.search(r"AT\+PSEND=([0-9A-F]{54})", linea)
        if m and linea.startswith("TX seq="):
            c = TRAMA.unpack(bytes.fromhex(m[1]))
            _, _, _, _, t_ms, _, _, it_x1000, _, validez, _, estado, _, _ = c
            it = it_x1000 / 1000 if validez & 0x04 else math.nan
            puntos.append((t_ms / 1000, it, ESTADOS[estado % 5]))
        m = re.match(r"\[\s*(\d+)\] (\w+) -> (\w+)", linea)
        if m:
            transiciones.append((int(m[1]) / 1000, m[2], m[3]))

    t_ini, t_fin = 2240.0, 2600.0
    ventana = [p for p in puntos if t_ini <= p[0] <= t_fin]
    fig, ax = plt.subplots(figsize=(6.3, 2.9))
    ax.plot([p[0] - t_ini for p in ventana], [p[1] for p in ventana],
            color=AZUL, marker="o", markersize=2.5, linewidth=0.8, label="$I_T$ por ciclo")
    ax.axhline(0.200, color=GRIS, linestyle="--", linewidth=1)
    ax.text(0.01, 0.205, "umbral 0.200", transform=ax.get_yaxis_transform(),
            ha="left", va="bottom", color=GRIS, fontsize=8)

    # Bombeo (relé ON): de ARMADO->MUESTREANDO a MUESTREANDO->CAPTURA_ESTIMADA
    inicio = None
    for t, o, d in transiciones:
        if d == "MUESTREANDO":
            inicio = t
        elif o == "MUESTREANDO" and inicio is not None and t_ini <= inicio <= t_fin:
            ax.axvspan(inicio - t_ini, t - t_ini, color=NARANJA, alpha=0.35, linewidth=0)
            inicio = None
    # Etiquetas: una por captura y una por rearme
    ymax = max(p[1] for p in ventana if not math.isnan(p[1]))
    ev = 0
    for t, o, d in transiciones:
        if not (t_ini <= t <= t_fin):
            continue
        if d == "MUESTREANDO":
            ev += 1
            ax.text(t - t_ini + 6, ymax * 1.05, f"captura {ev}", fontsize=7.5, color=TINTA, ha="left", va="top")
        elif d == "ARMADO":
            ax.axvline(t - t_ini, color=GRIS, linewidth=0.8, linestyle=":")
            ax.text(t - t_ini - 2, ymax * 1.05, "rearme", fontsize=7.5, color=TINTA, ha="right", va="top")
        elif d == "BLOQUEADO":
            ax.axvline(t - t_ini, color=GRIS, linewidth=0.6, linestyle=":")
    ax.plot([], [], color=NARANJA, alpha=0.35, linewidth=6, label="relé activo (bombeo)")
    ax.set_xlabel(f"Tiempo (s) desde t = {t_ini:.0f} s tras el encendido")
    ax.set_ylabel("Índice de turbidez $I_T$")
    ax.set_ylim(-0.05, ymax * 1.12)
    ax.legend(loc="upper left", bbox_to_anchor=(0.0, 0.88), fontsize=8)
    fig.savefig(SALIDA / "r4_ciclo_estados.pdf")
    plt.close(fig)

    print("R4 ciclo de estados (nodo_20261107_225307.log)")
    for t, o, d in transiciones:
        if t_ini <= t <= t_fin + 60:
            print(f"  t={t:9.3f} s  {o} -> {d}")


if __name__ == "__main__":
    SALIDA.mkdir(parents=True, exist_ok=True)
    fig_turbidez()
    fig_tds()
    fig_lora()
    fig_ciclo()
