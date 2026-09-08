/* Tablero de linea primaria de faenamiento.
   Todo el calculo ocurre en el navegador sobre window.DATOS, de modo que
   los filtros recalculan los indicadores sin volver a consultar el origen. */

(function () {
  "use strict";

  // ------------------------------------------------------------ Constantes

  var COLORES = {
    base: "#4c6a82",
    medio: "#88a0b3",
    claro: "#c3d0da",
    acento: "#c1442e",
    secundario: "#d9a441",
    positivo: "#5b7c68",
    neutro: "#8c8c8c",
    tinta: "#1f2933",
    linea: "#e2e6ea"
  };

  var DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes",
              "Sábado", "Domingo"];

  var UMBRAL_ALERTA = 0.85;   // cumplimiento bajo este valor se marca en rojo
  var MINIMO_GRUPO = 3;       // turnos minimos para dibujar una caja
  var TOP_MOTIVOS = 10;

  var TIPOGRAFIA = { family: "Segoe UI, Helvetica Neue, Arial, sans-serif",
                     size: 13, color: "#445260" };

  var CONFIGURACION = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
    toImageButtonOptions: { format: "png", scale: 2 }
  };

  var estado = {
    turnos: [],
    meta: {},
    articulosActivos: new Set()
  };

  // ------------------------------------------------------------ Utilidades

  function seleccionar(id) {
    return document.getElementById(id);
  }

  function numero(valor, decimales) {
    if (valor === null || valor === undefined || isNaN(valor)) { return "sin dato"; }
    return valor.toLocaleString("es-EC", {
      minimumFractionDigits: decimales || 0,
      maximumFractionDigits: decimales || 0
    });
  }

  function porcentaje(valor, decimales) {
    if (valor === null || valor === undefined || isNaN(valor)) { return "sin dato"; }
    return (valor * 100).toFixed(decimales === undefined ? 1 : decimales) + " %";
  }

  function sumar(lista, clave) {
    return lista.reduce(function (total, item) {
      var valor = item[clave];
      return total + (typeof valor === "number" && !isNaN(valor) ? valor : 0);
    }, 0);
  }

  function promedio(valores) {
    var limpios = valores.filter(function (v) { return typeof v === "number" && !isNaN(v); });
    if (!limpios.length) { return null; }
    return limpios.reduce(function (a, b) { return a + b; }, 0) / limpios.length;
  }

  function mediana(valores) {
    var orden = valores.slice().sort(function (a, b) { return a - b; });
    if (!orden.length) { return null; }
    var medio = Math.floor(orden.length / 2);
    return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
  }

  function agrupar(lista, obtenerClave) {
    var mapa = new Map();
    lista.forEach(function (item) {
      var clave = obtenerClave(item);
      if (clave === null || clave === undefined) { return; }
      if (!mapa.has(clave)) { mapa.set(clave, []); }
      mapa.get(clave).push(item);
    });
    return mapa;
  }

  /* Diseno comun: fondo limpio, sin borde superior ni derecho. */
  function disenoBase(tituloX, tituloY) {
    return {
      font: TIPOGRAFIA,
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      margin: { l: 68, r: 26, t: 18, b: 62 },
      hovermode: "closest",
      showlegend: false,
      xaxis: {
        title: { text: tituloX || "", font: { size: 13 } },
        showline: true, linecolor: "#666666", mirror: false,
        zeroline: false, showgrid: false, ticks: "outside", tickcolor: "#cccccc"
      },
      yaxis: {
        title: { text: tituloY || "", font: { size: 13 } },
        showline: true, linecolor: "#666666", mirror: false,
        zeroline: false, gridcolor: COLORES.linea, ticks: "outside",
        tickcolor: "#cccccc"
      }
    };
  }

  function dibujar(idContenedor, trazos, diseno) {
    var contenedor = seleccionar(idContenedor);
    // Si antes se mostro un aviso de vacio hay que limpiar el nodo:
    // Plotly no puede reutilizar un contenedor con html propio.
    if (contenedor.querySelector(".vacio")) { contenedor.innerHTML = ""; }
    Plotly.react(idContenedor, trazos, diseno, CONFIGURACION);
  }

  function mostrarVacio(idContenedor, mensaje) {
    Plotly.purge(idContenedor);
    seleccionar(idContenedor).innerHTML =
      '<div class="vacio">' + mensaje + "</div>";
  }

  // ------------------------------------------------------------ Filtros

  function estandarActual() {
    return parseFloat(seleccionar("estandar").value);
  }

  function obtenerFiltrados() {
    var desde = seleccionar("fechaInicio").value;
    var hasta = seleccionar("fechaFin").value;
    var minimo = parseInt(seleccionar("personalMinimo").value, 10);
    var maximo = parseInt(seleccionar("personalMaximo").value, 10);
    var linea = seleccionar("linea").value;

    return estado.turnos.filter(function (turno) {
      if (desde && turno.fecha < desde) { return false; }
      if (hasta && turno.fecha > hasta) { return false; }
      if (linea !== "Todas" && turno.linea !== linea) { return false; }
      if (estado.articulosActivos.size && !estado.articulosActivos.has(turno.articulo)) {
        return false;
      }
      if (turno.personal !== null && turno.personal !== undefined) {
        if (turno.personal < minimo || turno.personal > maximo) { return false; }
      }
      return true;
    });
  }

  // ------------------------------------------------------------ Indicadores

  function calcularKpis(turnos, estandar) {
    var cerdos = sumar(turnos, "cerdos");
    var buenos = sumar(turnos, "buenos");
    var horasProductivas = sumar(turnos, "horasProductivas");
    var horasProgramadas = sumar(turnos, "horasProgramadas");
    var paradasNo = sumar(turnos, "parasNoPlanificadas");
    var paradasSi = sumar(turnos, "parasPlanificadas");

    var velocidadNeta = horasProductivas ? cerdos / horasProductivas : null;
    var velocidadBruta = horasProgramadas ? cerdos / horasProgramadas : null;
    var disponibilidad = horasProgramadas ? horasProductivas / horasProgramadas : null;
    var calidad = cerdos ? buenos / cerdos : null;
    var ritmo = velocidadNeta !== null ? velocidadNeta / estandar : null;

    var potencial = estandar * horasProgramadas;
    var perdidaRitmo = Math.max(estandar * horasProductivas - cerdos, 0);

    return {
      turnos: turnos.length,
      cerdos: cerdos,
      velocidadNeta: velocidadNeta,
      velocidadBruta: velocidadBruta,
      disponibilidad: disponibilidad,
      calidad: calidad,
      ritmo: ritmo,
      oee: (disponibilidad !== null && ritmo !== null && calidad !== null)
        ? disponibilidad * ritmo * calidad : null,
      potencial: potencial,
      perdidaPlanificada: estandar * paradasSi,
      perdidaNoPlanificada: estandar * paradasNo,
      perdidaRitmo: perdidaRitmo,
      perdidaCalidad: cerdos - buenos,
      perdidaTotal: potencial - buenos,
      personalPromedio: promedio(turnos.map(function (t) { return t.personal; }))
    };
  }

  function renderKpis(kpis, estandar) {
    var tarjetas = [
      { titulo: "Velocidad neta", cifra: numero(kpis.velocidadNeta, 1),
        nota: "cerdos por hora productiva",
        alerta: kpis.ritmo !== null && kpis.ritmo < UMBRAL_ALERTA },
      { titulo: "Velocidad bruta", cifra: numero(kpis.velocidadBruta, 1),
        nota: "cerdos por hora programada",
        alerta: kpis.velocidadBruta !== null &&
                kpis.velocidadBruta < estandar * UMBRAL_ALERTA },
      { titulo: "Cumplimiento del estándar", cifra: porcentaje(kpis.ritmo),
        nota: "contra " + numero(estandar, 0) + " cerdos por hora",
        alerta: kpis.ritmo !== null && kpis.ritmo < UMBRAL_ALERTA },
      { titulo: "Disponibilidad", cifra: porcentaje(kpis.disponibilidad),
        nota: "horas productivas sobre programadas",
        alerta: kpis.disponibilidad !== null && kpis.disponibilidad < 0.85 },
      { titulo: "Calidad de proceso", cifra: porcentaje(kpis.calidad, 2),
        nota: "unidades sin defecto de línea",
        alerta: kpis.calidad !== null && kpis.calidad < 0.97 },
      { titulo: "OEE", cifra: porcentaje(kpis.oee),
        nota: "disponibilidad por ritmo por calidad",
        alerta: kpis.oee !== null && kpis.oee < 0.70 },
      { titulo: "Cerdos perdidos", cifra: numero(kpis.perdidaTotal, 0),
        nota: "frente al potencial teórico", alerta: true },
      { titulo: "Dotación promedio", cifra: numero(kpis.personalPromedio, 1),
        nota: kpis.turnos + " turnos en el filtro", alerta: false }
    ];

    var contenedor = seleccionar("rejillaKpis");
    contenedor.innerHTML = tarjetas.map(function (t) {
      var clase = t.alerta ? "tarjeta alerta" : "tarjeta correcta";
      return '<div class="' + clase + '">' +
             '<div class="titulo">' + t.titulo + "</div>" +
             '<div class="cifra">' + t.cifra + "</div>" +
             '<div class="nota">' + t.nota + "</div></div>";
    }).join("");
  }

  // ------------------------------------------------------------ Cascada

  function renderCascada(kpis) {
    if (!kpis.turnos) { mostrarVacio("graficoCascada", "Sin turnos en el filtro"); return; }

    var etiquetas = ["Potencial teórico", "Paradas planificadas",
                     "Paradas no planificadas", "Pérdida de ritmo",
                     "Defectos de proceso", "Producción buena"];
    var valores = [kpis.potencial, -kpis.perdidaPlanificada,
                   -kpis.perdidaNoPlanificada, -kpis.perdidaRitmo,
                   -kpis.perdidaCalidad, 0];

    var trazo = {
      type: "waterfall",
      orientation: "v",
      measure: ["absolute", "relative", "relative", "relative", "relative", "total"],
      x: etiquetas,
      y: valores,
      text: valores.map(function (v, i) {
        return i === valores.length - 1 ? "" : numero(Math.abs(v), 0);
      }),
      textposition: "outside",
      textfont: { size: 12, color: COLORES.tinta },
      connector: { line: { color: COLORES.claro, width: 1 } },
      decreasing: { marker: { color: COLORES.acento } },
      increasing: { marker: { color: COLORES.secundario } },
      totals: { marker: { color: COLORES.base } },
      hovertemplate: "%{x}<br>%{y:,.0f} cerdos<extra></extra>"
    };

    var diseno = disenoBase("", "Cerdos");
    diseno.margin.b = 96;
    diseno.xaxis.tickangle = -18;
    diseno.yaxis.tickformat = ",.0f";
    dibujar("graficoCascada", [trazo], diseno);
  }

  // ------------------------------------------------------------ Control

  function renderControl(turnos, estandar) {
    var serie = turnos.filter(function (t) {
      return t.horasProductivas > 0 && t.cerdos > 0;
    }).map(function (t) {
      return { fecha: t.fecha, valor: t.cerdos / t.horasProductivas,
               articulo: t.articulo, personal: t.personal };
    });

    if (serie.length < 8) {
      mostrarVacio("graficoControl", "Se requieren al menos ocho turnos");
      return;
    }

    var valores = serie.map(function (p) { return p.valor; });
    var centro = promedio(valores);
    var rangos = [];
    for (var i = 1; i < valores.length; i += 1) {
      rangos.push(Math.abs(valores[i] - valores[i - 1]));
    }
    var rangoMedio = promedio(rangos) || 0;
    var superior = centro + 2.66 * rangoMedio;
    var inferior = Math.max(centro - 2.66 * rangoMedio, 0);

    var normales = serie.filter(function (p) {
      return p.valor <= superior && p.valor >= inferior;
    });
    var especiales = serie.filter(function (p) {
      return p.valor > superior || p.valor < inferior;
    });

    function trazoPuntos(datos, color, tamano, nombre) {
      return {
        type: "scatter", mode: "markers", name: nombre,
        x: datos.map(function (p) { return p.fecha; }),
        y: datos.map(function (p) { return p.valor; }),
        marker: { color: color, size: tamano },
        customdata: datos.map(function (p) {
          return [p.articulo, p.personal === null ? "sin dato" : p.personal];
        }),
        hovertemplate: "%{x}<br>%{y:.1f} cerdos por hora" +
                       "<br>%{customdata[0]}<br>Dotación %{customdata[1]}<extra></extra>"
      };
    }

    var linea = {
      type: "scatter", mode: "lines",
      x: serie.map(function (p) { return p.fecha; }),
      y: valores,
      line: { color: COLORES.medio, width: 1.2 },
      hoverinfo: "skip"
    };

    var diseno = disenoBase("Fecha de proceso", "Cerdos por hora");
    diseno.shapes = [
      { type: "line", xref: "paper", x0: 0, x1: 1, y0: centro, y1: centro,
        line: { color: COLORES.neutro, width: 1.4 } },
      { type: "line", xref: "paper", x0: 0, x1: 1, y0: superior, y1: superior,
        line: { color: COLORES.medio, width: 1, dash: "dash" } },
      { type: "line", xref: "paper", x0: 0, x1: 1, y0: inferior, y1: inferior,
        line: { color: COLORES.medio, width: 1, dash: "dash" } },
      { type: "line", xref: "paper", x0: 0, x1: 1, y0: estandar, y1: estandar,
        line: { color: COLORES.acento, width: 2 } }
    ];
    diseno.annotations = [
      { xref: "paper", x: 1, y: estandar, xanchor: "right", yanchor: "bottom",
        text: "Estándar " + numero(estandar, 0), showarrow: false,
        font: { color: COLORES.acento, size: 12 } },
      { xref: "paper", x: 1, y: centro, xanchor: "right", yanchor: "top",
        text: "Media " + numero(centro, 1), showarrow: false,
        font: { color: COLORES.neutro, size: 12 } }
    ];

    dibujar("graficoControl",
            [linea, trazoPuntos(normales, COLORES.base, 6, "Dentro de control"),
             trazoPuntos(especiales, COLORES.acento, 11, "Causa especial")],
            diseno);
  }

  // ------------------------------------------------------------ Pareto

  function renderPareto(turnos) {
    var acumulador = new Map();
    turnos.forEach(function (turno) {
      var motivos = turno.motivos || [];
      if (!motivos.length) { return; }
      var horas = (turno.parasNoPlanificadas || 0) / motivos.length;
      motivos.forEach(function (motivo) {
        var previo = acumulador.get(motivo) || { horas: 0, eventos: 0 };
        previo.horas += horas;
        previo.eventos += 1;
        acumulador.set(motivo, previo);
      });
    });

    if (!acumulador.size) {
      mostrarVacio("graficoPareto", "Sin motivos de parada registrados");
      return;
    }

    var ordenado = Array.from(acumulador.entries())
      .sort(function (a, b) { return b[1].horas - a[1].horas; })
      .slice(0, TOP_MOTIVOS);

    var total = ordenado.reduce(function (t, par) { return t + par[1].horas; }, 0);
    var acumulado = 0;
    var curva = ordenado.map(function (par) {
      acumulado += par[1].horas;
      return total ? acumulado / total : 0;
    });

    var colores = curva.map(function (v, i) {
      return (i === 0 || curva[i - 1] < 0.8) ? COLORES.acento : COLORES.medio;
    });

    var barras = {
      type: "bar",
      x: ordenado.map(function (p) { return p[0]; }),
      y: ordenado.map(function (p) { return p[1].horas; }),
      marker: { color: colores },
      customdata: ordenado.map(function (p) { return p[1].eventos; }),
      hovertemplate: "%{x}<br>%{y:.1f} horas<br>%{customdata} eventos<extra></extra>"
    };

    var acumulada = {
      type: "scatter", mode: "lines+markers", yaxis: "y2",
      x: ordenado.map(function (p) { return p[0]; }),
      y: curva,
      line: { color: COLORES.base, width: 1.6 },
      marker: { size: 5 },
      hovertemplate: "Acumulado %{y:.0%}<extra></extra>"
    };

    var diseno = disenoBase("", "Horas perdidas");
    diseno.margin.b = 130;
    diseno.margin.r = 58;
    diseno.xaxis.tickangle = -35;
    diseno.yaxis2 = {
      overlaying: "y", side: "right", range: [0, 1.05], tickformat: ".0%",
      showgrid: false, zeroline: false, showline: false,
      title: { text: "Acumulado", font: { size: 13 } }
    };
    dibujar("graficoPareto", [barras, acumulada], diseno);
  }

  // ------------------------------------------------------------ Dotación

  function renderDotacion(turnos, estandar) {
    var conDatos = turnos.filter(function (t) {
      return t.personal !== null && t.horasProductivas > 0;
    });
    var grupos = agrupar(conDatos, function (t) { return Math.round(t.personal); });
    var niveles = Array.from(grupos.keys())
      .filter(function (nivel) { return grupos.get(nivel).length >= MINIMO_GRUPO; })
      .sort(function (a, b) { return a - b; });

    if (niveles.length < 2) {
      mostrarVacio("graficoDotacion",
                   "La dotación no varía lo suficiente para comparar grupos");
      return;
    }

    var trazos = niveles.map(function (nivel) {
      var valores = grupos.get(nivel).map(function (t) {
        return t.cerdos / t.horasProductivas;
      });
      var media = promedio(valores);
      return {
        type: "box", name: String(nivel), y: valores,
        boxpoints: "all", jitter: 0.4, pointpos: 0, boxmean: true,
        marker: { color: COLORES.base, size: 4, opacity: 0.45 },
        fillcolor: COLORES.claro,
        line: { color: COLORES.neutro, width: 1.2 },
        hovertemplate: "Dotación " + nivel + " · media " + media.toFixed(1) +
                       "<br>%{y:.1f} cerdos por hora<extra></extra>"
      };
    });

    var diseno = disenoBase("Cantidad de personal en el turno", "Cerdos por hora");
    diseno.shapes = [{
      type: "line", xref: "paper", x0: 0, x1: 1, y0: estandar, y1: estandar,
      line: { color: COLORES.acento, width: 2 }
    }];
    diseno.annotations = niveles.map(function (nivel, indice) {
      return {
        x: indice, y: 0, yref: "paper", yanchor: "bottom", showarrow: false,
        text: "n = " + grupos.get(nivel).length,
        font: { size: 11, color: COLORES.neutro }
      };
    });
    dibujar("graficoDotacion", trazos, diseno);
  }

  // ------------------------------------------------------------ Defectos

  function renderDefectos(turnos, estandar) {
    var puntos = turnos.filter(function (t) {
      return t.horasProductivas > 0 && t.cerdos > 0;
    }).map(function (t) {
      return {
        velocidad: t.cerdos / t.horasProductivas,
        tasa: (t.defectosProceso || 0) / t.cerdos,
        fecha: t.fecha
      };
    });

    if (puntos.length < 8) {
      mostrarVacio("graficoDefectos", "Se requieren al menos ocho turnos");
      return;
    }

    var corte = mediana(puntos.map(function (p) { return p.tasa; }));
    var altos = puntos.filter(function (p) { return p.tasa > corte; });
    var bajos = puntos.filter(function (p) { return p.tasa <= corte; });

    function nube(datos, color, nombre) {
      return {
        type: "scatter", mode: "markers", name: nombre,
        x: datos.map(function (p) { return p.velocidad; }),
        y: datos.map(function (p) { return p.tasa; }),
        marker: { color: color, size: 7, opacity: 0.6 },
        customdata: datos.map(function (p) { return p.fecha; }),
        hovertemplate: "%{customdata}<br>%{x:.1f} cerdos por hora" +
                       "<br>Defectos %{y:.2%}<extra></extra>"
      };
    }

    // Tendencia por tramos: promedio de la tasa en seis cortes de velocidad.
    var ordenados = puntos.slice().sort(function (a, b) {
      return a.velocidad - b.velocidad;
    });
    var tramos = 6;
    var tamano = Math.max(Math.floor(ordenados.length / tramos), 2);
    var tendenciaX = [];
    var tendenciaY = [];
    for (var inicio = 0; inicio < ordenados.length; inicio += tamano) {
      var bloque = ordenados.slice(inicio, inicio + tamano);
      if (bloque.length < 2) { break; }
      tendenciaX.push(promedio(bloque.map(function (p) { return p.velocidad; })));
      tendenciaY.push(promedio(bloque.map(function (p) { return p.tasa; })));
    }

    var tendencia = {
      type: "scatter", mode: "lines", name: "Tendencia por tramos",
      x: tendenciaX, y: tendenciaY,
      line: { color: COLORES.neutro, width: 2.4, shape: "spline" },
      hoverinfo: "skip"
    };

    var diseno = disenoBase("Velocidad neta (cerdos por hora)",
                            "Tasa de defecto de proceso");
    diseno.yaxis.tickformat = ".1%";
    diseno.shapes = [{
      type: "line", yref: "paper", y0: 0, y1: 1, x0: estandar, x1: estandar,
      line: { color: COLORES.acento, width: 1.6, dash: "dash" }
    }];
    dibujar("graficoDefectos",
            [nube(bajos, COLORES.base, "Defectos bajo la mediana"),
             nube(altos, COLORES.acento, "Defectos sobre la mediana"),
             tendencia],
            diseno);
  }

  // ------------------------------------------------------------ Mapa de calor

  function renderMapaCalor(turnos, estandar) {
    var validos = turnos.filter(function (t) {
      return t.semana !== null && t.dia && t.horasProductivas > 0;
    });
    if (!validos.length) {
      mostrarVacio("graficoMapaCalor", "Sin datos de calendario");
      return;
    }

    var semanas = Array.from(new Set(validos.map(function (t) { return t.semana; })))
      .sort(function (a, b) { return a - b; });

    var matriz = semanas.map(function (semana) {
      return DIAS.map(function (dia) {
        var celda = validos.filter(function (t) {
          return t.semana === semana && t.dia === dia;
        });
        if (!celda.length) { return null; }
        var cerdos = sumar(celda, "cerdos");
        var horas = sumar(celda, "horasProductivas");
        return horas ? cerdos / horas : null;
      });
    });

    var trazo = {
      type: "heatmap",
      z: matriz,
      x: DIAS,
      y: semanas.map(function (s) { return "Semana " + s; }),
      colorscale: [[0, COLORES.acento], [0.5, "#f0ddc2"], [1, COLORES.base]],
      zmid: estandar,
      hoverongaps: false,
      colorbar: { title: { text: "Cerdos por hora", side: "right" },
                  outlinewidth: 0, thickness: 14 },
      hovertemplate: "%{y} · %{x}<br>%{z:.1f} cerdos por hora<extra></extra>"
    };

    var diseno = disenoBase("", "");
    diseno.margin.l = 92;
    diseno.yaxis.showline = false;
    diseno.yaxis.gridcolor = "rgba(0,0,0,0)";
    diseno.yaxis.autorange = "reversed";
    dibujar("graficoMapaCalor", [trazo], diseno);
  }

  // ------------------------------------------------------------ Tendencia

  function renderTendencia(turnos, estandar) {
    var grupos = agrupar(turnos, function (t) { return t.semana; });
    var semanas = Array.from(grupos.keys())
      .filter(function (s) { return s !== null; })
      .sort(function (a, b) { return a - b; });

    if (semanas.length < 2) {
      mostrarVacio("graficoTendencia", "Se requieren al menos dos semanas");
      return;
    }

    var etiquetas = [];
    var netas = [];
    var brutas = [];
    var dotaciones = [];

    semanas.forEach(function (semana) {
      var bloque = grupos.get(semana);
      var cerdos = sumar(bloque, "cerdos");
      var productivas = sumar(bloque, "horasProductivas");
      var programadas = sumar(bloque, "horasProgramadas");
      etiquetas.push("S " + semana);
      netas.push(productivas ? cerdos / productivas : null);
      brutas.push(programadas ? cerdos / programadas : null);
      dotaciones.push(promedio(bloque.map(function (t) { return t.personal; })));
    });

    var bajoEstandar = netas.map(function (v) {
      return (v !== null && v < estandar * UMBRAL_ALERTA) ? v : null;
    });

    var trazos = [
      { type: "bar", name: "Dotación promedio", x: etiquetas, y: dotaciones,
        yaxis: "y2", marker: { color: COLORES.claro },
        hovertemplate: "%{x}<br>Dotación %{y:.1f}<extra></extra>" },
      { type: "scatter", mode: "lines+markers", name: "Velocidad bruta",
        x: etiquetas, y: brutas,
        line: { color: COLORES.medio, width: 1.8, dash: "dash" },
        marker: { size: 5 },
        hovertemplate: "%{x}<br>Bruta %{y:.1f}<extra></extra>" },
      { type: "scatter", mode: "lines+markers", name: "Velocidad neta",
        x: etiquetas, y: netas,
        line: { color: COLORES.base, width: 2.4 }, marker: { size: 6 },
        hovertemplate: "%{x}<br>Neta %{y:.1f}<extra></extra>" },
      { type: "scatter", mode: "markers", name: "Semana bajo el estándar",
        x: etiquetas, y: bajoEstandar,
        marker: { color: COLORES.acento, size: 12 },
        hovertemplate: "%{x}<br>%{y:.1f} cerdos por hora<extra></extra>" }
    ];

    var diseno = disenoBase("Semana", "Cerdos por hora");
    diseno.showlegend = true;
    diseno.legend = { orientation: "h", y: -0.22, x: 0 };
    diseno.margin.b = 92;
    diseno.margin.r = 62;
    diseno.yaxis2 = {
      overlaying: "y", side: "right", showgrid: false, zeroline: false,
      showline: false, rangemode: "tozero",
      title: { text: "Dotación promedio", font: { size: 13 } }
    };
    diseno.shapes = [{
      type: "line", xref: "paper", x0: 0, x1: 1, y0: estandar, y1: estandar,
      line: { color: COLORES.acento, width: 2 }
    }];
    dibujar("graficoTendencia", trazos, diseno);
  }

  // ------------------------------------------------------------ Orquestación

  function actualizar() {
    var estandar = estandarActual();
    var filtrados = obtenerFiltrados();

    seleccionar("etiquetaEstandar").textContent = numero(estandar, 0) + " por hora";
    seleccionar("etiquetaPersonalMinimo").textContent =
      seleccionar("personalMinimo").value + " personas";
    seleccionar("etiquetaPersonalMaximo").textContent =
      seleccionar("personalMaximo").value + " personas";
    seleccionar("conteo").textContent =
      filtrados.length + " de " + estado.turnos.length + " turnos en el filtro";

    var kpis = calcularKpis(filtrados, estandar);
    renderKpis(kpis, estandar);
    renderCascada(kpis);
    renderControl(filtrados, estandar);
    renderPareto(filtrados);
    renderDotacion(filtrados, estandar);
    renderDefectos(filtrados, estandar);
    renderMapaCalor(filtrados, estandar);
    renderTendencia(filtrados, estandar);
  }

  function sincronizarDeslizadores(origen) {
    var minimo = seleccionar("personalMinimo");
    var maximo = seleccionar("personalMaximo");
    if (parseInt(minimo.value, 10) > parseInt(maximo.value, 10)) {
      if (origen === "minimo") { maximo.value = minimo.value; }
      else { minimo.value = maximo.value; }
    }
  }

  function construirFichas() {
    var contenedor = seleccionar("fichasArticulos");
    contenedor.innerHTML = "";
    estado.meta.articulos.forEach(function (articulo) {
      var ficha = document.createElement("span");
      ficha.className = "ficha activa";
      ficha.textContent = articulo;
      ficha.addEventListener("click", function () {
        if (estado.articulosActivos.has(articulo)) {
          estado.articulosActivos.delete(articulo);
          ficha.classList.remove("activa");
        } else {
          estado.articulosActivos.add(articulo);
          ficha.classList.add("activa");
        }
        actualizar();
      });
      contenedor.appendChild(ficha);
      estado.articulosActivos.add(articulo);
    });
  }

  function aplicarValoresIniciales() {
    var meta = estado.meta;

    seleccionar("fechaInicio").value = meta.fechaMinima || "";
    seleccionar("fechaFin").value = meta.fechaMaxima || "";
    seleccionar("fechaInicio").min = meta.fechaMinima || "";
    seleccionar("fechaInicio").max = meta.fechaMaxima || "";
    seleccionar("fechaFin").min = meta.fechaMinima || "";
    seleccionar("fechaFin").max = meta.fechaMaxima || "";

    ["personalMinimo", "personalMaximo"].forEach(function (id) {
      var control = seleccionar(id);
      control.min = meta.personalMinimo;
      control.max = meta.personalMaximo;
      control.step = 1;
      control.value = id === "personalMinimo" ? meta.personalMinimo
                                              : meta.personalMaximo;
    });

    seleccionar("estandar").value = meta.estandarNominal;

    var selector = seleccionar("linea");
    selector.innerHTML = ['<option value="Todas">Todas</option>']
      .concat(meta.lineas.map(function (l) {
        return '<option value="' + l + '">' + l + "</option>";
      })).join("");

    estado.articulosActivos = new Set();
    construirFichas();
  }

  function conectarEventos() {
    ["fechaInicio", "fechaFin", "linea"].forEach(function (id) {
      seleccionar(id).addEventListener("change", actualizar);
    });
    seleccionar("estandar").addEventListener("input", actualizar);
    seleccionar("personalMinimo").addEventListener("input", function () {
      sincronizarDeslizadores("minimo");
      actualizar();
    });
    seleccionar("personalMaximo").addEventListener("input", function () {
      sincronizarDeslizadores("maximo");
      actualizar();
    });
    seleccionar("reiniciar").addEventListener("click", function () {
      aplicarValoresIniciales();
      actualizar();
    });
  }

  function iniciar() {
    if (!window.DATOS || !window.DATOS.turnos || !window.DATOS.turnos.length) {
      seleccionar("subtitulo").textContent =
        "No se encontró datos.js. Genérelo con exportar-web.py y súbalo junto a esta página.";
      return;
    }

    estado.turnos = window.DATOS.turnos;
    estado.meta = window.DATOS.meta;

    seleccionar("subtitulo").textContent =
      "Periodo del " + estado.meta.fechaMinima + " al " + estado.meta.fechaMaxima +
      " · " + estado.meta.totalTurnos + " turnos · estándar nominal " +
      numero(estado.meta.estandarNominal, 0) + " cerdos por hora";
    seleccionar("pie").textContent =
      "Datos generados el " + estado.meta.generado +
      ". Los indicadores se recalculan en el navegador con cada cambio de filtro.";

    aplicarValoresIniciales();
    conectarEventos();
    actualizar();
  }

  document.addEventListener("DOMContentLoaded", iniciar);
}());
