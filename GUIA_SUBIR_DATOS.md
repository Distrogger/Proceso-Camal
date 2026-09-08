# 📊 Guía Completa: Cómo Subir tus Datos Excel al Tablero

## ✅ Requisitos Previos

- **Python 3.7+** instalado en tu computadora
- **Git** instalado en tu computadora  
- Tu archivo Excel con datos reales
- Una cuenta en GitHub (ya tienes esta)

---

## 🚀 Paso a Paso (5 minutos)

### **Paso 1: Instalar Librerías Python**

Abre una terminal (PowerShell en Windows o Terminal en Mac/Linux) y ejecuta:

```bash
pip install pandas openpyxl numpy
```

---

### **Paso 2: Descargar el Repositorio**

En tu terminal:

```bash
git clone https://github.com/Distrogger/Proceso-Camal.git
cd Proceso-Camal
```

Esto crea una carpeta `Proceso-Camal` con todos los archivos.

---

### **Paso 3: Preparar tu Archivo Excel**

Tu archivo Excel **DEBE** tener estas columnas exactamente (mayúsculas y sin acentos):

| Columna Requerida | Tipo | Ejemplo |
|---|---|---|
| FECHA DE PROCESO | Fecha | 2026-01-15 |
| SEMANA | Número | 1 |
| DIA SEMANA | Texto | Lunes |
| DESCRIPCION ARTICULO | Texto | Cerdo Entero |
| LINEA PRODUCCION | Texto | Línea 1 |
| CANTIDAD DE PERSONAL | Número | 12 |
| CANTIDAD DE CERDOS | Número | 450 |
| CERDOS BUENOS | Número | 440 |
| HORAS PROGRAMADAS | Número | 8 |
| HORAS PRODUCTIVAS | Número | 7.5 |
| HORAS DE PARAS PLANIFICADAS | Número | 0.3 |
| HORAS DE PARAS NO PLANIFICADAS | Número | 0.2 |
| UNIDADES CON DEFECTOS PROCESO | Número | 7 |
| UNIDADES CON DEFECTOS GRANJA | Número | 3 |
| KILOGRAMOS EN PIE | Número | 1100 |
| KILOGRAMOS PROCESADOS | Número | 1050 |
| ESTANDAR APLICADO | Número | 40 |
| VELOCIDAD NETA | Número | 58.7 |
| VELOCIDAD BRUTA | Número | 56.3 |
| MOTIVOS DE PARADAS | Texto (opcional) | mantenimiento; limpieza |
| DEFECTOS PROCESO | Texto (opcional) | sangrado; corte |

**Importante:** Las columnas opcionales pueden estar vacías.

---

### **Paso 4: Copiar tu Excel a la Carpeta**

1. Copia tu archivo Excel (p.ej., `produccion.xlsx`)
2. Pégalo en la carpeta `Proceso-Camal` (la que acabas de descargar)

```
Proceso-Camal/
├── exportar-web.py
├── produccion.xlsx  ← Tu archivo aquí
├── docs/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── datos.js
└── GUIA_SUBIR_DATOS.md
```

---

### **Paso 5: Generar los Datos para el Tablero**

En tu terminal (dentro de la carpeta `Proceso-Camal`):

```bash
python procesar_datos.py produccion.xlsx
```

Reemplaza `produccion.xlsx` con el nombre de tu archivo si es diferente.

**Resultado esperado:**
```
Turnos descartados por falta de fecha u horas: 0
Datos del tablero: docs/datos.js | 150 turnos | 125.4 KB
✅ ¡Listo! Ahora sube los cambios a GitHub.
```

---

### **Paso 6: Subir a GitHub**

En tu terminal (dentro de `Proceso-Camal`):

```bash
git add .
git commit -m "Agregar datos reales de producción"
git push origin main
```

**Notas:**
- Si te pide credenciales, usa tu nombre de usuario y contraseña de GitHub
- O configura una clave SSH si ya la tienes

---

### **Paso 7: Activar GitHub Pages**

1. Ve a tu repositorio: https://github.com/Distrogger/Proceso-Camal
2. Haz clic en **Settings** (Configuración)
3. En el menú de la izquierda, busca **Pages**
4. En **Source**, selecciona:
   - **Branch:** `main`
   - **Folder:** `/docs`
5. Haz clic en **Save**

---

### **Paso 8: ¡Tu Tablero está Listo! 🎉**

Espera 1-2 minutos y accede a:

```
https://distrogger.github.io/Proceso-Camal/
```

Tu tablero interactivo se mostrará con todos tus datos.

---

## 🔄 Actualizar Datos Regularmente

Cada vez que tengas nuevos datos:

### **Opción A: Desde tu Computadora**

```bash
# 1. Actualiza tu archivo Excel

# 2. Genera los nuevos datos
python procesar_datos.py produccion.xlsx

# 3. Sube a GitHub
git add docs/datos.js
git commit -m "Actualizar datos"
git push origin main
```

El tablero se actualizará en 1-2 minutos automáticamente.

### **Opción B: Desde Google Colab (Sin instalar Python)**

```python
# 1. Sube tu archivo Excel
from google.colab import files
archivos = files.upload()

# 2. Lee y procesa
import pandas as pd
datos = pd.read_excel(list(archivos.keys())[0])

# 3. Usa el script
exec(open('exportar-web.py').read())
exportar_tablero(datos, destino="docs", estandar_nominal=40.0)
```

---

## ⚠️ Solución de Problemas

### ❌ Error: "No module named 'pandas'"

**Solución:**
```bash
pip install pandas openpyxl numpy
```

### ❌ Error: "No hay turnos válidos para exportar"

**Causas posibles:**
- La columna `FECHA DE PROCESO` está vacía
- La columna `HORAS PRODUCTIVAS` está vacía o tiene 0
- Los nombres de las columnas no coinciden exactamente

**Solución:** Verifica que tu Excel tenga estas dos columnas con datos.

### ❌ El tablero muestra "No hay datos disponibles"

**Causas posibles:**
- El archivo `docs/datos.js` no se actualizó
- No subiste los cambios a GitHub con `git push`
- Necesitas limpiar el caché del navegador

**Solución:**
1. Limpia caché (Ctrl+Shift+Del)
2. Recarga la página (Ctrl+F5)
3. Verifica que subiste el archivo: https://github.com/Distrogger/Proceso-Camal/blob/main/docs/datos.js

### ❌ Error: "fatal: not a git repository"

**Solución:**
```bash
cd Proceso-Camal  # Asegúrate de estar en esta carpeta
```

### ❌ Error: "PERMISSION DENIED" al hacer push

**Solución:**
- Configura tu Git con tus credenciales:
  ```bash
  git config --global user.name "Tu Nombre"
  git config --global user.email "tu@email.com"
  ```

---

## 📋 Checklist Rápido

- [ ] Python 3.7+ instalado (`python --version`)
- [ ] Librerías instaladas (`pip install pandas openpyxl numpy`)
- [ ] Repositorio descargado (`git clone ...`)
- [ ] Excel con las columnas correctas
- [ ] Excel en la carpeta `Proceso-Camal`
- [ ] Generados los datos (`python procesar_datos.py`)
- [ ] Subido a GitHub (`git push origin main`)
- [ ] GitHub Pages activado en Settings
- [ ] Esperó 1-2 minutos
- [ ] Accedió a `https://distrogger.github.io/Proceso-Camal/`

---

## 🆘 ¿Necesitas Ayuda?

Si algo no funciona:

1. Verifica que todos los pasos están hechos
2. Lee la sección "Solución de Problemas"
3. Revisa que tu Excel tenga los nombres de columnas exactos
4. Abre la consola del navegador (F12) para ver errores

---

**¡Listo! Tu tablero está en GitHub Pages y se actualiza automáticamente cada vez que subes nuevos datos.** 🚀
