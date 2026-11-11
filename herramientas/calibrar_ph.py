#!/usr/bin/env python3
"""
Herramienta de calibración offline de pH para QawapMayu.
Lee los puntos guardados en pruebas/calibracion.log,
calcula la recta de regresión pH = m * mV + b y muestra el comando final.

Uso:
  python3 herramientas/calibrar_ph.py                      # Lee pruebas/calibracion.log
  python3 herramientas/calibrar_ph.py --add 8.3 1550 "Bicarbonato"  # Agrega un punto y calcula
  python3 herramientas/calibrar_ph.py 3.0:414 8.3:1550     # Cálculo manual puntual
"""
import os
import sys

LOG_CAL = "pruebas/calibracion.log"

def leer_puntos_archivo():
    if not os.path.exists(LOG_CAL):
        return []
    por_ph = {}
    with open(LOG_CAL, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            partes = [p.strip() for p in line.split("|")]
            if len(partes) >= 4 and partes[1].upper() == "PH":
                try:
                    ph_ref = float(partes[2])
                    mv_val = float(partes[3])
                    nota = partes[4] if len(partes) >= 5 else ""
                    por_ph[round(ph_ref, 2)] = (mv_val, ph_ref, nota)
                except ValueError:
                    pass
    return [por_ph[k] for k in sorted(por_ph.keys())]

def agregar_punto(ph_ref, mv_val, nota=""):
    import datetime
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_CAL, "a", encoding="utf-8") as f:
        f.write(f"{now_str} | pH | {ph_ref:.2f} | {mv_val:.1f} | {nota}\n")
    print(f">> Punto agregado a {LOG_CAL}: pH {ph_ref:.2f} = {mv_val:.1f} mV ({nota})")

def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "--add":
        ph_ref = float(sys.argv[2])
        mv_val = float(sys.argv[3])
        nota = sys.argv[4] if len(sys.argv) >= 5 else ""
        agregar_punto(ph_ref, mv_val, nota)

    # Cargar puntos
    puntos_raw = []
    fuente = ""
    
    # Argumentos manuales tipo ph:mV
    manual_args = [a for a in sys.argv[1:] if ":" in a]
    if len(manual_args) >= 2:
        for arg in manual_args:
            ph_str, mv_str = arg.split(":", 1)
            puntos_raw.append((float(mv_str), float(ph_str), "Manual"))
        fuente = "Argumentos de línea de comandos"
    else:
        puntos_raw = leer_puntos_archivo()
        fuente = f"Archivo persistente del repositorio: {LOG_CAL}"

    if len(puntos_raw) < 2:
        print("=" * 65)
        print("  ESTADO DE CALIBRACIÓN DE pH - QAWAPMAYU")
        print(f"  Fuente: {fuente}")
        print("=" * 65)
        print(f"Puntos registrados actualmente ({len(puntos_raw)} de 2 necesarios):")
        for i, (mv, ph, nota) in enumerate(puntos_raw, 1):
            print(f"  Punto {i}: pH ref = {ph:5.2f} | mV medido = {mv:6.1f} mV | {nota}")
        print("-" * 65)
        print("Falta el Punto 2 (Bicarbonato) para calcular la recta.")
        print(f"Puedes agregarlo ejecutando: python3 herramientas/calibrar_ph.py --add <pH> <mV> 'Bicarbonato'")
        print("=" * 65)
        sys.exit(0)

    puntos = [(mv, ph) for mv, ph, _ in puntos_raw]
    n = len(puntos)
    sx = sum(x for x, y in puntos)
    sy = sum(y for x, y in puntos)
    sxy = sum(x * y for x, y in puntos)
    sxx = sum(x * x for x, y in puntos)

    den = n * sxx - sx * sx
    if den == 0:
        print("Error: Los voltajes son idénticos. Se requieren voltajes distintos.")
        sys.exit(1)

    m = (n * sxy - sx * sy) / den
    b = (sy - m * sx) / n
    sensibilidad = (1.0 / m) if m != 0 else 0.0

    print("=" * 65)
    print("  CALIBRACIÓN DE pH OFFLINE - QAWAPMAYU")
    print(f"  Fuente: {fuente}")
    print("=" * 65)
    print(f"Puntos utilizados ({n}):")
    for i, (mv, ph, nota) in enumerate(puntos_raw, 1):
        pred = m * mv + b
        err = pred - ph
        print(f"  Punto {i}: pH {ph:5.2f} | {mv:6.1f} mV | modelo = {pred:5.2f} (error: {err:+.2f}) | {nota}")

    print("-" * 65)
    print(f"Ecuación lineal: pH = {m:.6f} * mV + {b:.4f}")
    print(f"Sensibilidad:    {sensibilidad:.1f} mV por unidad de pH")
    print("-" * 65)
    print("COMANDO PARA EL ESP32 (copia y pega en el Serial Monitor):")
    print(f"  setph {m:.6f} {b:.4f}")
    print("=" * 65)

if __name__ == "__main__":
    main()
