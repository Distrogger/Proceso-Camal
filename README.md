# Tablero de línea primaria de faenamiento

Tablero estático e interactivo para GitHub Pages. Todo el cálculo ocurre en el
navegador sobre un único archivo de datos, así que no hace falta servidor,
base de datos ni backend.

## Estructura del repositorio

```
docs/
  index.html      página del tablero
  estilos.css     paleta y maquetación
  tablero.js      filtros, KPIs y gráficos
  datos.js        datos del periodo (lo genera el exportador)
exportar-web.py   convierte el dataframe del análisis en docs/datos.js
analisis-camal.py pipeline de limpieza, métricas y gráficos estáticos
```

## Paso 1. Generar los datos

En Colab, después de correr el pipeline de análisis:

```python
datos = procesar("produccion.xlsx")

exec(open("exportar-web.py").read())
exportar_tablero(datos, destino="docs")
empaquetar("docs")          # descarga docs comprimido
```

`exportar_tablero` escribe `docs/datos.js`. Es el único archivo que se
regenera cuando llegan datos nuevos.

## Paso 2. Publicar en GitHub

1. Crear un repositorio nuevo, por ejemplo `tablero-camal`.
2. Subir la carpeta `docs/` completa (interfaz web de GitHub: *Add file* →
   *Upload files*, arrastrar los cuatro archivos).
3. Ir a **Settings** → **Pages**.
4. En *Source* elegir **Deploy from a branch**.
5. Branch: `main`, carpeta: `/docs`. Guardar.
6. En un par de minutos el tablero queda en
   `https://<usuario>.github.io/tablero-camal/`.

Para actualizar basta con reemplazar `docs/datos.js` y hacer commit.

Si el repositorio debe ser privado, GitHub Pages privado requiere plan
Enterprise. Alternativas gratuitas con repositorio privado: Netlify Drop o
Cloudflare Pages, arrastrando la misma carpeta `docs/`.

## Uso del tablero

- **Rango de fechas**: acota el periodo analizado.
- **Dotación mínima y máxima**: aísla los turnos según el personal asignado.
  Es el control que responde al requerimiento de evaluar el impacto del
  personal de soporte.
- **Estándar de referencia**: mueve la meta de cerdos por hora y recalcula al
  instante cumplimiento, OEE y la cascada de pérdidas. Sirve para negociar el
  estándar con gerencia sobre evidencia y no sobre supuestos.
- **Línea y artículos**: separa el efecto de mezcla de producto, que suele
  explicar buena parte de la brecha contra el estándar único.

Los ocho indicadores de la parte superior y los siete gráficos se recalculan
con cada cambio. Cada gráfico se descarga en PNG desde su barra de
herramientas.

## Notas técnicas

- Los datos viajan como `window.DATOS` dentro de `datos.js`. Eso permite abrir
  `index.html` con doble clic sin tropezar con las restricciones de origen del
  navegador.
- Plotly se carga desde CDN. Si la planta tiene la salida a internet
  restringida, descargar `plotly-2.35.2.min.js` y referenciarlo localmente.
- Con más de unos quince mil turnos conviene agregar por semana antes de
  exportar, para que el archivo no supere unos pocos megabytes.
- El archivo de datos es público si el repositorio lo es. Revisar antes si la
  información de producción puede publicarse.
