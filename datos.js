// Este archivo carga el Excel "PROCESO CAMAL NUEVO FORMATO.xlsx"
// y crea window.DATOS dinámicamente para su uso en la página web.
// NO contiene datos estáticos - todo se lee del Excel

(async function(){
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

  try{
    // Fetch the Excel file placed in docs/
    const resp = await fetch('PROCESO%20CAMAL%20NUEVO%20FORMATO.xlsx');
    if(!resp.ok) throw new Error('No se pudo descargar el archivo Excel: '+resp.status+' '+resp.statusText);
    const arrayBuffer = await resp.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // XLSX must be disponible globalmente (index.html carga xlsx.full.min.js antes de este script)
    if(typeof XLSX === 'undefined') throw new Error('La librería XLSX (SheetJS) no está cargada. Asegúrate de cargar xlsx.full.min.js antes de datos.js');

    const workbook = XLSX.read(data, {type:'array', cellDates:true});
    if(!workbook.SheetNames || workbook.SheetNames.length===0) throw new Error('El libro Excel no tiene hojas');

    // Convertir la primera hoja a JSON (defval para mantener celdas vacías)
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {defval: null});

    // Asignar filas a turnos
    window.DATOS.turnos = rows;
    window.DATOS.meta.totalTurnos = rows.length;

    // establecer generado
    window.DATOS.meta.generado = isoLocal(new Date());

    // Detectar columnas con fechas para calcular fechaMinima/Maxima
    const dateCandidates = [];
    if(rows.length>0){
      const sample = rows[0];
      for(const key of Object.keys(sample)){
        // buscar nombres que indiquen fecha
        const low = key.toLowerCase();
        if(low.includes('fecha') || low.includes('date') || low.includes('dia')) dateCandidates.push(key);
      }
    }

    let minDate = null, maxDate = null;
    if(dateCandidates.length>0){
      for(const r of rows){
        for(const k of dateCandidates){
          const val = r[k];
          if(val==null) continue;
          let d = null;
          if(val instanceof Date) d = val;
          else if(typeof val === 'string'){
            const parsed = Date.parse(val);
            if(!isNaN(parsed)) d = new Date(parsed);
          } else if(typeof val === 'number'){
            // posible número de Excel (dias desde 1899-12-31)
            // XLSX with cellDates:true normally returns Date, pero por si acaso:
            d = XLSX.SSF.parse_date_code(val);
            if(d && typeof d === 'object' && d.y) {
              d = new Date(Date.UTC(d.y, d.m-1, d.d, d.H, d.M, Math.floor(d.S)));
            } else d = null;
          }
          if(d instanceof Date && !isNaN(d.getTime())){
            if(minDate===null || d < minDate) minDate = d;
            if(maxDate===null || d > maxDate) maxDate = d;
          }
        }
      }
    }

    window.DATOS.meta.fechaMinima = minDate ? isoLocal(minDate) : null;
    window.DATOS.meta.fechaMaxima = maxDate ? isoLocal(maxDate) : null;

    // Intentar inferir personalMinimo/personalMaximo si hay columnas tipo Personal/Min/Max
    const personals = ['personal','personas','tripulacion','crew'];
    let pMin=null,pMax=null;
    for(const key of Object.keys(rows[0]||{})){
      const low = key.toLowerCase();
      if(low.includes('min')) pMin = key;
      if(low.includes('max')) pMax = key;
      for(const cand of personals) if(low.includes(cand)) {
        // primer columna numérica encontrada
        for(const r of rows){
          const v = r[key];
          if(typeof v === 'number'){ if(pMin===null) pMin=key; if(pMax===null) pMax=key; break; }
        }
      }
    }
    if(pMin){
      const vals = rows.map(r=>Number(r[pMin])||0);
      window.DATOS.meta.personalMinimo = Math.min(...vals);
    }
    if(pMax){
      const vals = rows.map(r=>Number(r[pMax])||0);
      window.DATOS.meta.personalMaximo = Math.max(...vals);
    }

    // intentar llenar articulos/lineas desde columnas "Articulo/Linea"
    const artKey = Object.keys(rows[0]||{}).find(k=>k.toLowerCase().includes('artic'));
    const lineaKey = Object.keys(rows[0]||{}).find(k=>k.toLowerCase().includes('line'));
    if(artKey){
      window.DATOS.meta.articulos = Array.from(new Set(rows.map(r=>r[artKey]).filter(x=>x!=null)));
    }
    if(lineaKey){
      window.DATOS.meta.lineas = Array.from(new Set(rows.map(r=>r[lineaKey]).filter(x=>x!=null)));
    }

    // Disparar evento para notificar a la app que DATOS está listo
    window.dispatchEvent(new Event('DATOS_LOADED'));

  }catch(err){
    console.error('error cargando datos:', err);
    window.DATOS.error = String(err);
    window.dispatchEvent(new Event('DATOS_LOADED'));
  }
})();
