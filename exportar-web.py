"""Exportador del tablero web de la linea primaria de faenamiento.

Toma el dataframe enriquecido que devuelve procesar() en el script de
analisis y escribe docs/datos.js, el unico archivo que necesita
actualizarse cuando llegan datos nuevos.

Se genera un archivo .js y no un .json a proposito: asi el tablero abre
tanto desde GitHub Pages como con doble clic en el archivo local, sin
tropezar con las restricciones de origen del navegador.

Uso tipico en Colab:

    datos = procesar("produccion.xlsx")
    exportar_tablero(datos, destino="docs")
    empaquetar("docs")
"""

import json
import math
import os
import re
import shutil
from datetime import datetime

import numpy as np
import pandas as pd

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
# 2. CONSTRUCCION DE REGISTROS
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
# 3. ESCRITURA Y EMPAQUETADO
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
    print(__doc__)
