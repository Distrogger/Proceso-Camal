"""Exportador del tablero web de la linea primaria de faenamiento.

Toma datos pegados directamente como texto (CSV o tab-separated) que devuelve
procesar() y escribe docs/datos.js, el unico archivo que necesita
actualizarse cuando llegan datos nuevos.

Se genera un archivo .js y no un .json a proposito: asi el tablero abre
tanto desde GitHub Pages como con doble clic en el archivo local, sin
tropezar con las restricciones de origen del navegador.

USO:
    1. Pega los datos directamente en la variable DATOS_TEXTO (ver abajo)
    2. Ejecuta: python exportar-web.py
    3. O con opciones: python exportar-web.py --dest docs --pack

Puedes pegar datos en:
    - CSV (separado por comas)
    - TSV (separado por tabulaciones)
    - Copiar directamente desde Excel/Sheets

La primera línea debe contener los nombres de las columnas.
"""

import json
import math
import os
import re
import shutil
from datetime import datetime
import argparse
from io import StringIO

import numpy as np
import pandas as pd

# ============================================================================
# SECCION DE DATOS: Pega aqui tus datos directamente como texto
# ============================================================================
# Ejemplo formato CSV:
"""
FECHA DE PROCESO,SEMANA,DIA SEMANA,DESCRIPCION ARTICULO,LINEA PRODUCCION,CANTIDAD DE PERSONAL,CANTIDAD DE CERDOS,CERDOS BUENOS,HORAS PROGRAMADAS,HORAS PRODUCTIVAS,HORAS DE PARAS PLANIFICADAS,HORAS DE PARAS NO PLANIFICADAS,UNIDADES CON DEFECTOS PROCESO,UNIDADES CON DEFECTOS GRANJA,KILOGRAMOS EN PIE,KILOGRAMOS PROCESADOS,ESTANDAR APLICADO,VELOCIDAD NETA,VELOCIDAD BRUTA,MOTIVOS DE PARADAS,DEFECTOS PROCESO
2025-01-06,1,Lunes,Art A,L1,10,400,395,8,7.5,0.2,0.3,5,0,1000,980,40,53.3,50.0,"motor; limpieza",corte - sangrado
2025-01-07,1,Martes,Art B,L1,11,420,415,8,7.8,0.1,0.1,5,0,1050,1020,40,53.8,52.5,"","" 
2025-01-13,2,Lunes,Art A,L2,9,380,375,8,7.6,0.0,0.2,4,0,980,960,40,50.0,48.0,"falta de repuesto",sangrado
2025-01-14,2,Martes,Art C,L2,12,410,405,8,7.9,0.3,0.0,5,0,1020,1005,40,51.9,50.0,"",""
"""

# PEGA TUS DATOS AQUI (reemplaza lo de arriba):
DATOS_TEXTO = """FECHA DE PROCESO,SEMANA,DIA SEMANA,DESCRIPCION ARTICULO,LINEA PRODUCCION,CANTIDAD DE PERSONAL,CANTIDAD DE CERDOS,CERDOS BUENOS,HORAS PROGRAMADAS,HORAS PRODUCTIVAS,HORAS DE PARAS PLANIFICADAS,HORAS DE PARAS NO PLANIFICADAS,UNIDADES CON DEFECTOS PROCESO,UNIDADES CON DEFECTOS GRANJA,KILOGRAMOS EN PIE,KILOGRAMOS PROCESADOS,ESTANDAR APLICADO,VELOCIDAD NETA,VELOCIDAD BRUTA,MOTIVOS DE PARADAS,DEFECTOS PROCESO
2025-01-06,1,Lunes,Art A,L1,10,400,395,8,7.5,0.2,0.3,5,0,1000,980,40,53.3,50.0,"motor; limpieza",corte - sangrado
2025-01-07,1,Martes,Art B,L1,11,420,415,8,7.8,0.1,0.1,5,0,1050,1020,40,53.8,52.5,"",""
2025-01-13,2,Lunes,Art A,L2,9,380,375,8,7.6,0.0,0.2,4,0,980,960,40,50.0,48.0,"falta de repuesto",sangrado
2025-01-14,2,Martes,Art C,L2,12,410,405,8,7.9,0.3,0.0,5,0,1020,1005,40,51.9,50.0,"",""
"""
# ============================================================================

# Separadores usuales en los campos de texto libre del supervisor.
SEPARADORES = r"[;/|]|,\s|\n|\r| - | y "

RUIDO = {"NAN", "NINGUNO", "NINGUNA", "N/A", "NA", "-", "SIN DEFECTO",
         "SIN DEFECTOS", "SIN PARADA", "0"}


# ---------------------------------------------------------------------------
# 1. UTILIDADES DE CONVERSION
# ---------------------------------------------------------------------------

def limpiar_valor(valor):
    """Convierte un valor de pandas a un tipo serializable en JSON.

    Los enteros nativos de Python se atienden antes que cualquier otra
    rama: si caen al final terminan convertidos en texto y el tablero
    deja de poder sumarlos.
    """
    if valor is None:
        return None
    if isinstance(valor, (bool, np.bool_)):
        return bool(valor)
    if isinstance(valor, (int, np.integer)):
        return int(valor)
    if isinstance(valor, (float, np.floating)):
        numero = float(valor)
        return None if math.isnan(numero) or math.isinf(numero) else numero
    if isinstance(valor, (pd.Timestamp, datetime)):
        return valor.strftime("%Y-%m-%d")
    if isinstance(valor, np.datetime64):
        return pd.Timestamp(valor).strftime("%Y-%m-%d")
    if pd.isna(valor):
        return None
    return str(valor)


def separar_texto(valor):
    """Divide un campo de texto libre en una lista de etiquetas limpias."""
    if valor is None or (isinstance(valor, float) and math.isnan(valor)):
        return []
    etiquetas = []
    for pieza in re.split(SEPARADORES, str(valor)):
        limpio = re.sub(r"\s+", " ", pieza).strip().upper()
        if len(limpio) > 2 and limpio not in RUIDO:
            etiquetas.append(limpio.title())
    return etiquetas


def columna(df, nombre, defecto=np.nan):
    """Devuelve la columna solicitada o una serie de relleno si no existe."""
    if nombre in df.columns:
        return df[nombre]
    return pd.Series(defecto, index=df.index)


# ---------------------------------------------------------------------------
# 2. CARGA DE DATOS DESDE TEXTO
# ---------------------------------------------------------------------------

def cargar_datos_desde_texto(texto):
    """Carga datos directamente desde un string CSV/TSV.
    
    Detecta automáticamente si es CSV o TSV y lee los datos.
    """
    if not texto or not texto.strip():
        raise ValueError("No hay datos para procesar. Pega los datos en DATOS_TEXTO.")
    
    # Detectar si es TSV o CSV
    primera_linea = texto.strip().split('\n')[0]
    separador = '\t' if '\t' in primera_linea else ','
    
    print(f"Detectado formato: {'TSV (tabulaciones)' if separador == '\t' else 'CSV (comas)'}")
    
    try:
        df = pd.read_csv(StringIO(texto), sep=separador, encoding='utf-8')
        # Normalizar nombres de columna: mayusculas y sin espacios extra
        df.columns = [c.strip().upper() if isinstance(c, str) else c for c in df.columns]
        print(f"Datos cargados: {len(df)} filas, {len(df.columns)} columnas")
        return df
    except Exception as e:
        raise ValueError(f"Error al cargar datos: {e}")


# ---------------------------------------------------------------------------
# 3. CONSTRUCCION DE REGISTROS
# ---------------------------------------------------------------------------

def construir_registros(df):
    """Arma la lista de turnos con solo los campos que usa el tablero.

    Las claves son cortas y sin acentos porque viajan al navegador; las
    etiquetas visibles se definen en el lado del tablero.
    """
    campos = {
        "fecha": columna(df, "FECHA DE PROCESO"),
        "semana": columna(df, "SEMANA"),
        "dia": columna(df, "DIA SEMANA"),
        "articulo": columna(df, "DESCRIPCION ARTICULO", "Sin detalle"),
        "linea": columna(df, "LINEA PRODUCCION", "Sin detalle"),
        "personal": columna(df, "CANTIDAD DE PERSONAL"),
        "cerdos": columna(df, "CANTIDAD DE CERDOS"),
        "buenos": columna(df, "CERDOS BUENOS"),
        "horasProgramadas": columna(df, "HORAS PROGRAMADAS"),
        "horasProductivas": columna(df, "HORAS PRODUCTIVAS"),
        "parasPlanificadas": columna(df, "HORAS DE PARAS PLANIFICADAS"),
        "parasNoPlanificadas": columna(df, "HORAS DE PARAS NO PLANIFICADAS"),
        "defectosProceso": columna(df, "UNIDADES CON DEFECTOS PROCESO"),
        "defectosGranja": columna(df, "UNIDADES CON DEFECTOS GRANJA"),
        "kilosPie": columna(df, "KILOGRAMOS EN PIE"),
        "kilosProcesados": columna(df, "KILOGRAMOS PROCESADOS"),
        "estandar": columna(df, "ESTANDAR APLICADO"),
        "velocidadNeta": columna(df, "VELOCIDAD NETA"),
        "velocidadBruta": columna(df, "VELOCIDAD BRUTA"),
    }

    tabla = pd.DataFrame(campos)
    motivos = columna(df, "MOTIVOS DE PARADAS", None)
    defectos = columna(df, "DEFECTOS PROCESO", None)

    registros = []
    # to_dict preserva el tipo de cada columna; iterrows lo homogenizaria.
    for posicion, crudo in zip(tabla.index, tabla.to_dict(orient="records")):
        registro = {clave: limpiar_valor(valor) for clave, valor in crudo.items()}
        registro["motivos"] = separar_texto(motivos.get(posicion))
        registro["defectosTexto"] = separar_texto(defectos.get(posicion))
        registros.append(registro)

    # Sin fecha o sin horas productivas el turno no aporta al tablero.
    validos = [r for r in registros
               if r["fecha"] and r["horasProductivas"]]
    descartados = len(registros) - len(validos)
    if descartados:
        print(f"Turnos descartados por falta de fecha u horas: {descartados}")
    validos.sort(key=lambda r: r["fecha"])
    return validos


def construir_metadatos(registros, estandar_nominal):
    """Calcula los rangos que alimentan los controles de filtro."""
    def valores(clave):
        return [r[clave] for r in registros if r[clave] is not None]

    personal = [v for v in valores("personal") if isinstance(v, (int, float))]
    fechas = valores("fecha")
    return {
        "generado": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "estandarNominal": float(estandar_nominal),
        "totalTurnos": len(registros),
        "fechaMinima": min(fechas) if fechas else None,
        "fechaMaxima": max(fechas) if fechas else None,
        "personalMinimo": int(min(personal)) if personal else 0,
        "personalMaximo": int(max(personal)) if personal else 0,
        "articulos": sorted({r["articulo"] for r in registros if r["articulo"]}),
        "lineas": sorted({r["linea"] for r in registros if r["linea"]}),
    }


# ---------------------------------------------------------------------------
# 4. ESCRITURA Y EMPAQUETADO
# ---------------------------------------------------------------------------

def exportar_tablero(df, destino="docs", estandar_nominal=40.0):
    """Escribe destino/datos.js con los turnos y los metadatos del periodo."""
    os.makedirs(destino, exist_ok=True)
    registros = construir_registros(df)
    if not registros:
        raise ValueError("No hay turnos validos para exportar.")

    contenido = {
        "meta": construir_metadatos(registros, estandar_nominal),
        "turnos": registros,
    }
    cuerpo = json.dumps(contenido, ensure_ascii=False, allow_nan=False,
                        separators=(",", ":"))

    ruta = os.path.join(destino, "datos.js")
    with open(ruta, "w", encoding="utf-8") as archivo:
        archivo.write("// Generado automaticamente por exportar-web.py.\n")
        archivo.write("// No editar a mano: se sobrescribe en cada corrida.\n")
        archivo.write(f"window.DATOS = {cuerpo};\n")

    peso = os.path.getsize(ruta) / 1024
    print(f"Datos del tablero: {ruta} | {len(registros)} turnos | {peso:.1f} KB")
    return ruta


def empaquetar(carpeta="docs", nombre="tablero-camal"):
    """Comprime la carpeta del tablero y la descarga si se corre en Colab."""
    archivo = shutil.make_archive(nombre, "zip", carpeta)
    print(f"Paquete listo: {archivo}")
    try:
        from google.colab import files
        files.download(archivo)
    except ImportError:
        pass
    return archivo


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Exportar datos pegados directamente para el tablero web.",
        epilog="Pega tus datos en la variable DATOS_TEXTO dentro del archivo y ejecuta."
    )
    parser.add_argument("--dest", default="docs", help="Carpeta destino (por defecto: docs)")
    parser.add_argument("--pack", action="store_true", help="Comprime la carpeta destino en un zip")
    parser.add_argument("--estandar", type=float, default=40.0, 
                        help="Valor del estándar nominal (por defecto: 40.0)")
    args = parser.parse_args()

    try:
        df = cargar_datos_desde_texto(DATOS_TEXTO)
        ruta = exportar_tablero(df, destino=args.dest, estandar_nominal=args.estandar)
        if args.pack:
            empaquetar(args.dest)
        print(f"✓ Datos exportados exitosamente a: {ruta}")
    except ValueError as e:
        print(f"✗ Error: {e}")
        exit(1)
    except Exception as e:
        print(f"✗ Error inesperado: {e}")
        exit(1)
