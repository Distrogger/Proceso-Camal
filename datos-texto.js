// Este archivo carga datos en texto plano (CSV/TSV) directamente en el código
// y crea window.DATOS dinámicamente para su uso en la página web.

(function(){
  // valor por defecto mientras se carga
  window.DATOS = {
    meta: {
      generado: null,
      estandarNominal: 40.0,
      totalTurnos: 0,
      fechaMinima: null,
      fechaMaxima: null,
      personalMinimo: 0,
      personalMaximo: 0,
      articulos: [],
      lineas: []
    },
    turnos: []
  };

  function isoLocal(d){
    if(!(d instanceof Date)) return null;
    const pad = n=>String(n).padStart(2,'0');
    return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+" "+pad(d.getHours())+":"+pad(d.getMinutes());
  }

  // ═══════════════════════════════════════════════════════════════
  // 👇 AQUI PEGAS TUS DATOS - Copia todo el texto de tu tabla/excel
  // ═══════════════════════════════════════════════════════════════
  const datosTexto = `Fecha	Línea	Personal	Cerdos	Buenos	Horas	Velocidad	Defectos	Motivos
2026-09-01	Primaria	20	850	95%	8.5	42.3	5%	Parada mecánica
2026-09-02	Primaria	22	920	96%	8.0	46.1	4%	Mantenimiento
2026-09-03	Primaria	19	780	93%	8.3	38.5	7%	Error operario
2026-09-04	Primaria	21	890	94%	8.2	43.2	6%	Parada hidráulica
2026-09-05	Primaria	20	840	95%	8.4	41.8	5%	Limpieza
2026-09-06	Primaria	23	950	97%	7.9	47.5	3%	Buena marcha
2026-09-07	Primaria	20	855	94%	8.6	41.2	6%	Cuchillas
2026-09-08	Primaria	21	900	95%	8.1	44.3	5%	Material defectuoso`;
  // ═══════════════════════════════════════════════════════════════
  // ☝️  FIN DE LA SECCION DE DATOS
  // ═══════════════════════════════════════════════════════════════

  // Función para parsear texto delimitado (CSV/TSV)
  function parseDelimitedText(text, delimiter = '\t'){
    const lines = text.trim().split('\n');
    if(lines.length < 2) throw new Error('El texto debe tener encabezados y al menos una fila de datos');
    
    // Primera línea = encabezados
    const headers = lines[0].split(delimiter).map(h => h.trim());
    
    // Resto = datos
    const rows = [];
    for(let i = 1; i < lines.length; i++){
      const values = lines[i].split(delimiter).map(v => v.trim());
      const row = {};
      for(let j = 0; j < headers.length; j++){
        const val = values[j];
        // Intentar convertir a número si es posible
        if(val === '') {
          row[headers[j]] = null;
        } else if(!isNaN(val) && val !== ''){
          row[headers[j]] = Number(val);
        } else {
          row[headers[j]] = val;
        }
      }
      rows.push(row);
    }
    return rows;
  }

  // Función para procesar fechas en diferentes formatos
  function parseDate(dateStr){
    if(!dateStr || dateStr === '') return null;
    
    // Si ya es una fecha, devolverla
    if(dateStr instanceof Date) return dateStr;
    
    // Intentar parsear como string
    const parsed = new Date(dateStr);
    if(!isNaN(parsed.getTime())) return parsed;
    
    // Si no funciona, retornar null
    return null;
  }

  // Función para procesar datos
  function procesarDatos(textData, delimiter = '\t'){
    try{
      const rows = parseDelimitedText(textData, delimiter);
      
      window.DATOS.turnos = rows;
      window.DATOS.meta.totalTurnos = rows.length;
      window.DATOS.meta.generado = isoLocal(new Date());

      // Detectar columnas con fechas
      const dateCandidates = [];
      if(rows.length > 0){
        const sample = rows[0];
        for(const key of Object.keys(sample)){
          const low = key.toLowerCase();
          if(low.includes('fecha') || low.includes('date') || low.includes('dia')) {
            dateCandidates.push(key);
          }
        }
      }

      // Calcular fechaMinima/Maxima
      let minDate = null, maxDate = null;
      if(dateCandidates.length > 0){
        for(const r of rows){
          for(const k of dateCandidates){
            const val = r[k];
            if(val == null) continue;
            const d = parseDate(val);
            if(d instanceof Date && !isNaN(d.getTime())){
              if(minDate === null || d < minDate) minDate = d;
              if(maxDate === null || d > maxDate) maxDate = d;
            }
          }
        }
      }

      window.DATOS.meta.fechaMinima = minDate ? isoLocal(minDate) : null;
      window.DATOS.meta.fechaMaxima = maxDate ? isoLocal(maxDate) : null;

      // Inferir personalMinimo/personalMaximo
      const personals = ['personal','personas','tripulacion','crew'];
      let pMin = null, pMax = null;
      for(const key of Object.keys(rows[0] || {})){
        const low = key.toLowerCase();
        if(low.includes('min')) pMin = key;
        if(low.includes('max')) pMax = key;
        for(const cand of personals) {
          if(low.includes(cand)){
            for(const r of rows){
              const v = r[key];
              if(typeof v === 'number'){ 
                if(pMin === null) pMin = key; 
                if(pMax === null) pMax = key; 
                break; 
              }
            }
          }
        }
      }
      
      if(pMin){
        const vals = rows.map(r => Number(r[pMin]) || 0);
        window.DATOS.meta.personalMinimo = Math.min(...vals);
      }
      if(pMax){
        const vals = rows.map(r => Number(r[pMax]) || 0);
        window.DATOS.meta.personalMaximo = Math.max(...vals);
      }

      // Llenar articulos/lineas
      const artKey = Object.keys(rows[0] || {}).find(k => k.toLowerCase().includes('artic'));
      const lineaKey = Object.keys(rows[0] || {}).find(k => k.toLowerCase().includes('line'));
      
      if(artKey){
        window.DATOS.meta.articulos = Array.from(new Set(rows.map(r => r[artKey]).filter(x => x != null)));
      }
      if(lineaKey){
        window.DATOS.meta.lineas = Array.from(new Set(rows.map(r => r[lineaKey]).filter(x => x != null)));
      }

      // Disparar evento
      window.dispatchEvent(new Event('DATOS_LOADED'));
      return { success: true, totalTurnos: rows.length };

    }catch(err){
      console.error('error cargando datos:', err);
      window.DATOS.error = String(err);
      window.dispatchEvent(new Event('DATOS_LOADED'));
      return { success: false, error: String(err) };
    }
  }

  // Cargar datos automáticamente al cargar la página
  procesarDatos(datosTexto, '\t');

  // Exponer funciones para modificar datos si es necesario
  window.cargarDatosTexto = function(textData, delimiter = '\t'){
    return procesarDatos(textData, delimiter);
  };

  window.cargarDatosAutodetect = function(textData){
    const delimiters = ['\t', ',', ';', '|'];
    for(const delim of delimiters){
      try{
        const result = parseDelimitedText(textData, delim);
        if(result.length > 0){
          return procesarDatos(textData, delim);
        }
      }catch(e){
        continue;
      }
    }
    throw new Error('No se pudo detectar el formato del texto');
  };

})();
