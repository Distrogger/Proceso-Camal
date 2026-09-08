// Espera a que datos.js se cargue
function inicializar() {
    if (typeof window.DATOS === 'undefined') {
        console.error('No se cargaron los datos');
        mostrarError('No hay datos disponibles. Por favor, verifica que datos.js exista.');
        return;
    }

    const { meta, turnos } = window.DATOS;
    
    // Mostrar fecha de generación
    if (meta.generado) {
        document.getElementById('fecha-generacion').textContent = meta.generado;
    }

    // Poblar opciones de línea
    const selectLinea = document.getElementById('linea');
    meta.lineas.forEach(linea => {
        const option = document.createElement('option');
        option.value = linea;
        option.textContent = linea;
        selectLinea.appendChild(option);
    });

    // Establecer fechas límite
    if (meta.fechaMinima) {
        document.getElementById('fecha-desde').value = meta.fechaMinima;
    }
    if (meta.fechaMaxima) {
        document.getElementById('fecha-hasta').value = meta.fechaMaxima;
    }

    // Eventos de filtro
    document.getElementById('fecha-desde').addEventListener('change', renderizar);
    document.getElementById('fecha-hasta').addEventListener('change', renderizar);
    document.getElementById('linea').addEventListener('change', renderizar);
    document.getElementById('limpiar-filtros').addEventListener('click', limpiarFiltros);

    renderizar();
}

function obtenerFiltros() {
    return {
        fechaDesde: document.getElementById('fecha-desde').value,
        fechaHasta: document.getElementById('fecha-hasta').value,
        linea: document.getElementById('linea').value
    };
}

function filtrarTurnos() {
    const filtros = obtenerFiltros();
    const { turnos } = window.DATOS;

    return turnos.filter(t => {
        if (filtros.fechaDesde && t.fecha < filtros.fechaDesde) return false;
        if (filtros.fechaHasta && t.fecha > filtros.fechaHasta) return false;
        if (filtros.linea && t.linea !== filtros.linea) return false;
        return true;
    });
}

function renderizar() {
    const turnosFiltrados = filtrarTurnos();
    
    // Actualizar métricas
    document.getElementById('total-turnos').textContent = turnosFiltrados.length;
    
    const totalCerdos = turnosFiltrados.reduce((sum, t) => sum + (t.cerdos || 0), 0);
    document.getElementById('total-cerdos').textContent = totalCerdos.toLocaleString();
    
    const velocidades = turnosFiltrados.filter(t => t.velocidadNeta).map(t => t.velocidadNeta);
    const promedioVel = velocidades.length > 0 
        ? (velocidades.reduce((a,b) => a+b) / velocidades.length).toFixed(1)
        : 0;
    document.getElementById('promedio-velocidad').textContent = promedioVel;
    
    const totalBuenos = turnosFiltrados.reduce((sum, t) => sum + (t.buenos || 0), 0);
    const tasaBuenos = totalCerdos > 0 ? Math.round((totalBuenos / totalCerdos) * 100) : 0;
    document.getElementById('tasa-buenos').textContent = tasaBuenos + '%';

    // Llenar tabla
    const tbody = document.getElementById('tbody-turnos');
    tbody.innerHTML = '';

    if (turnosFiltrados.length === 0) {
        const fila = document.createElement('tr');
        fila.innerHTML = '<td colspan="9" style="text-align:center; padding: 20px; color: #999;">No hay turnos que coincidan con los filtros</td>';
        tbody.appendChild(fila);
        return;
    }

    turnosFiltrados.forEach(turno => {
        const fila = document.createElement('tr');
        const porcentajeBuenos = turno.cerdos > 0 
            ? Math.round((turno.buenos / turno.cerdos) * 100)
            : 0;

        fila.innerHTML = `
            <td><strong>${turno.fecha}</strong></td>
            <td>${turno.linea || '-'}</td>
            <td>${turno.personal || '-'}</td>
            <td>${turno.cerdos || '-'}</td>
            <td><span class="badge">${porcentajeBuenos}%</span></td>
            <td>${turno.horasProductivas ? turno.horasProductivas.toFixed(1) : '-'}</td>
            <td><strong>${turno.velocidadNeta ? turno.velocidadNeta.toFixed(1) : '-'}</strong></td>
            <td>${turno.defectosProceso || '-'}</td>
            <td>${turno.motivos && turno.motivos.length > 0 ? turno.motivos.join(', ') : '-'}</td>
        `;
        tbody.appendChild(fila);
    });
}

function limpiarFiltros() {
    document.getElementById('fecha-desde').value = '';
    document.getElementById('fecha-hasta').value = '';
    document.getElementById('linea').value = '';
    renderizar();
}

function mostrarError(mensaje) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = mensaje;
    container.insertBefore(errorDiv, container.firstChild);
}

// Inicializar cuando cargue el DOM
document.addEventListener('DOMContentLoaded', inicializar);
