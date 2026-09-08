"""Script de prueba para generar docs/datos.js usando exportar-web.py.

Ejecuta exportar-web.py en su modo --test que crea un DataFrame de ejemplo
y escribe docs/datos.js. Útil en CI o para comprobar que la exportación
funciona sin depender del pipeline completo.
"""
import subprocess
import sys

def main():
    cmd = [sys.executable, "exportar-web.py", "--test"]
    print("Ejecutando:", " ".join(cmd))
    res = subprocess.run(cmd)
    if res.returncode != 0:
        raise SystemExit(f"exportar-web.py falló con código {res.returncode}")
    print("Generado docs/datos.js con el DataFrame de prueba.")

if __name__ == '__main__':
    main()
