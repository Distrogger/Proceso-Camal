// Datos estáticos
window.DATOS = {
  meta: {
    generado: "2026-09-09 12:00",
    estandarNominal: 40.0,
    totalTurnos: 3,
    fechaMinima: "2026-09-01",
    fechaMaxima: "2026-09-05",
    personalMinimo: 18,
    personalMaximo: 40,
    articulos: ["Articulo A", "Articulo B"],
    lineas: ["Línea 1", "Línea 2"]
  },
  turnos: [
    {
      "Fecha": "2026-09-01",
      "Turno": "Mañana",
      "Personal": 25,
      "Articulo": "Articulo A",
      "Linea": "Línea 1"
    },
    {
      "Fecha": "2026-09-02",
      "Turno": "Tarde",
      "Personal": 30,
      "Articulo": "Articulo B",
      "Linea": "Línea 2"
    },
    {
      "Fecha": "2026-09-03",
      "Turno": "Noche",
      "Personal": 20,
      "Articulo": "Articulo A",
      "Linea": "Línea 1"
    }
  ]
};

// Disparar evento para notificar que DATOS está listo
window.dispatchEvent(new Event('DATOS_LOADED'));
