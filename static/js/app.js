// JavaScript para la aplicación GIS Web App

// Inicializar el mapa
let map;
let geoData = [];
let recursosLayer = null;
let mobiliarioLayer = null;
let searchLayer = null;
let placesLayer = null;
let radiusCircle = null;
let currentSearchType = null;
let currentSearchData = null;
let currentClickHandler = null;
let savedLocationbutton = null;

// Variables para el sistema de zonas
let isDrawingZone = false;
let zonePoints = [];
let zoneDrawingLayer = null;

console.log('🔧 Variables globales inicializadas:');
console.log('  - map:', map);
console.log('  - isDrawingZone:', isDrawingZone);
console.log('  - zonePoints:', zonePoints);
console.log('  - zoneDrawingLayer:', zoneDrawingLayer);

// Variables para zonas personalizadas
let customZones = [];
let currentZone = null;
let zoneLayer = null;

// Variables para selección de recursos
let recursosSeleccionados = new Set(); // Almacena los No_ de recursos seleccionados
let recursosDataMap = new Map(); // Almacena los datos completos de cada recurso por No_

// Incidencias / GTask (misma lógica que Rutas)
let incidenciasDeviceId = null;
let incidenciasCurrentUser = null;
let incidenciasIsAuthenticated = false;

function setIncidenciasStatus(msg, isError) {
    const el = document.getElementById('status');
    if (el) {
        el.textContent = msg || '';
        el.style.color = isError ? '#dc2626' : '#64748b';
    }
}

function getIncidenciasDeviceId() {
    if (!incidenciasDeviceId) {
        try {
            incidenciasDeviceId = localStorage.getItem('gis_device_id');
        } catch (e) { /* ignore */ }
        if (!incidenciasDeviceId) {
            incidenciasDeviceId = 'gis-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            try {
                localStorage.setItem('gis_device_id', incidenciasDeviceId);
            } catch (e) { /* ignore */ }
        }
    }
    return incidenciasDeviceId;
}

function getIncidenciasAppBaseUrl() {
    return (typeof window !== 'undefined' && window.INCIDENCIAS_URL)
        ? (String(window.INCIDENCIAS_URL).replace(/\/$/, '') + '/')
        : '';
}

function openGtaskUrlForIncidencia(idTareaGtask, idQr) {
    if (idTareaGtask) {
        window.open(
            'https://gtasks-app.deploy.malla.es/task/' + encodeURIComponent(String(idTareaGtask)),
            '_blank'
        );
        return;
    }
    if (idQr) {
        window.open(
            'https://gtasks-app.deploy.malla.es/IdQr/' + encodeURIComponent(String(idQr)),
            '_blank'
        );
    }
}

function openIncidenciasAppUrl(parada, recurso, documentNo) {
    const base = getIncidenciasAppBaseUrl();
    if (!base) return false;
    let url;
    if (documentNo) {
        url = base + '?id=' + encodeURIComponent(String(documentNo));
    } else {
        const params = new URLSearchParams();
        if (parada) params.set('parada', parada);
        if (recurso) params.set('recurso', recurso);
        url = base + (params.toString() ? '?' + params.toString() : '');
    }
    window.open(url, '_blank');
    return true;
}

function openIncidenciasForContext(ctx) {
    const parada = (ctx.parada || '').trim();
    const recurso = parada ? '' : (ctx.recurso || '').trim();
    if (!parada && !recurso) {
        setIncidenciasStatus('No hay parada ni recurso para incidencias.', true);
        return;
    }
    const base = getIncidenciasAppBaseUrl();
    if (!base) {
        const msg = 'INCIDENCIAS_URL no configurada. Añade INCIDENCIAS_URL al .env del servidor.';
        setIncidenciasStatus(msg, true);
        console.warn(msg);
        return;
    }
    if (!incidenciasIsAuthenticated || !incidenciasCurrentUser) {
        openIncidenciasAppUrl(parada, recurso, null);
        setIncidenciasStatus('Abriendo incidencias (inicia sesión GTask para reutilizar INC abiertas).');
        return;
    }
    const body = {};
    if (parada) body.parada = parada;
    else body.recurso = recurso;
    setIncidenciasStatus('Buscando incidencias abiertas...');
    fetch('/api/incidencias-abiertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-ID': getIncidenciasDeviceId() },
        body: JSON.stringify(body)
    })
        .then(r => r.json())
        .then(data => {
            if (!data.success) {
                setIncidenciasStatus(data.error || 'Error al buscar incidencias', true);
                return;
            }
            if (data.documentNo) {
                openIncidenciasAppUrl(parada, recurso, data.documentNo);
                setIncidenciasStatus('Abriendo incidencia ' + data.documentNo + '.');
                return;
            }
            openIncidenciasAppUrl(parada, recurso, null);
            setIncidenciasStatus('Abriendo incidencias para ' + (parada || recurso) + ' (nueva).');
        })
        .catch(e => {
            setIncidenciasStatus('Error al buscar incidencias: ' + e.message + '. Abriendo formulario nuevo.', true);
            openIncidenciasAppUrl(parada, recurso, null);
        });
}

function openGtaskIncidenciaForContext(ctx) {
    const parada = ctx.parada || '';
    const recurso = parada ? '' : (ctx.recurso || '');
    if (!parada && !recurso) {
        setIncidenciasStatus('No hay parada ni recurso para buscar incidencias.', true);
        return;
    }
    const body = {};
    if (parada) body.parada = parada;
    else body.recurso = recurso;
    setIncidenciasStatus('Buscando incidencia abierta...');
    fetch('/api/incidencia-gtask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-ID': getIncidenciasDeviceId() },
        body: JSON.stringify(body)
    })
        .then(r => r.json())
        .then(data => {
            if (!data.success) {
                setIncidenciasStatus(data.error || 'Error al buscar incidencia', true);
                return;
            }
            if (!data.encontrado) {
                setIncidenciasStatus('No hay incidencias en esta parada/recurso', true);
                return;
            }
            if (data.error && !data.idTareaGtask) {
                setIncidenciasStatus(data.error, true);
                return;
            }
            if (data.idTareaGtask || data.idQr) {
                openGtaskUrlForIncidencia(data.idTareaGtask, data.idQr);
                setIncidenciasStatus(
                    data.tareaCreada
                        ? 'Tarea de incidencia creada en GTask. Abriendo…'
                        : 'Abriendo tarea incidencia en GTask.'
                );
                return;
            }
            setIncidenciasStatus('No hay incidencias en esta parada/recurso', true);
        })
        .catch(e => {
            setIncidenciasStatus('Error al buscar incidencia: ' + e.message, true);
        });
}

function htmlEscapeAttr(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function escapeJsString(s) {
    return String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '')
        .replace(/\n/g, '\\n');
}

/** Llamado desde onclick en el HTML del popup (fiable con Leaflet) */
function gisIncidenciaClick(ev, action, parada, recurso) {
    if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
    }
    const ctx = { parada: parada || '', recurso: recurso || '' };
    if (action === 'incidencia') openIncidenciasForContext(ctx);
    else if (action === 'tarea') openGtaskIncidenciaForContext(ctx);
}
window.gisIncidenciaClick = gisIncidenciaClick;

function getIncidenciasBotonesHtml(parada, recurso) {
    const p = escapeJsString(parada);
    const r = escapeJsString(recurso);
    return `
        <div class="popup-incidencias-botones">
            <div class="popup-botones" data-parada="${htmlEscapeAttr(parada)}" data-recurso="${htmlEscapeAttr(recurso)}">
                <button type="button" class="btn btn-card btn-card-icon btn-card-incidencia" data-inc-action="incidencia" title="Abrir o crear incidencia"
                    onclick="gisIncidenciaClick(event,'incidencia','${p}','${r}'); return false;">
                    <img src="/static/images/incidencias-icon.png" alt="Incidencias" class="btn-icon-img">
                </button>
                <button type="button" class="btn btn-card btn-card-icon btn-card-tarea" data-inc-action="tarea" title="Abrir incidencia en GTask"
                    onclick="gisIncidenciaClick(event,'tarea','${p}','${r}'); return false;">
                    <span class="gtask-logo-mini">
                        <span class="gtask-square gtask-square-1"></span>
                        <span class="gtask-square gtask-square-2"></span>
                        <span class="gtask-plus">+</span>
                    </span>
                </button>
            </div>
        </div>`;
}

/** Delegación en el mapa: los botones funcionan aunque el popup se regenere con setPopupContent */
function initIncidenciasPopupDelegation() {
    if (!map || map._incidenciasDelegationInit) return;
    map._incidenciasDelegationInit = true;
    const container = map.getContainer();
    container.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-inc-action]');
        if (!btn || !btn.closest('.leaflet-popup')) return;
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        const box = btn.closest('.popup-botones');
        if (!box) return;
        const ctx = {
            parada: box.getAttribute('data-parada') || '',
            recurso: box.getAttribute('data-recurso') || ''
        };
        const action = btn.getAttribute('data-inc-action');
        if (action === 'incidencia') openIncidenciasForContext(ctx);
        else if (action === 'tarea') openGtaskIncidenciaForContext(ctx);
    }, true);
}

function setupPopupIncidenciaButtons(marker) {
    marker.off('popupopen.incidencias');
    marker.on('popupopen', function () {
        const el = marker.getPopup()?.getElement();
        if (!el) return;
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.disableScrollPropagation(el);
    });
}

async function initIncidenciasAuth() {
    getIncidenciasDeviceId();
    try {
        const r = await fetch('/api/gtask/status', {
            headers: { 'X-Device-ID': getIncidenciasDeviceId() }
        });
        const data = await r.json();
        if (data.success && data.is_authenticated) {
            incidenciasIsAuthenticated = true;
            incidenciasCurrentUser = data.user;
        }
    } catch (e) {
        console.warn('Estado GTask no disponible:', e);
    }
}

// Función para obtener el icono según el tipo de recurso
function getIconoPorTipoRecurso(tipoRecurso, color) {
    // Normalizar el tipo de recurso (trim, mayúsculas)
    const tipoNormalizado = tipoRecurso ? tipoRecurso.trim().toUpperCase() : '';
    
    // Mapeo de tipos de recurso a iconos/emojis (en mayúsculas para comparación)
    const iconosPorTipo = {
        'APAR.OB.B': '📺',      // Aparato Oblicuo B
        'ASCENSOR': '🛗',        // Ascensor
        'ASCENSORES': '🛗',      // Ascensores (plural)
        'BANDEROLA': '🚩',       // Banderola
        'IND.CALLE': '🚏',       // Indicador Calle
        'INDICADOR': '🚏',       // Indicador
        'MARQUESINA': '🏢',      // Marquesina
        'MUEBLE': '🪑',          // Mueble
        'PANEL': '📋',           // Panel
        'POSTER': '🖼️',         // Poster
        'MONOPOSTER':'📍',
        'ROTULO': '📝',         // Rótulo
        'VALLA': '🪧',        // Valla
        'V.PARKING': '🪧',        // V. Parking,
        'V.PEATONAL': '🚧',        // Vallado
        'VPEATON': '🚧',        // Vallado
        'V.2x1,5': '🪧',        // V. Peatonal,
        'OPI': '🖼️',        // OPI,
        'OPI SMAP': '🪟',        // OPI SMAP,
        'MINI OPI': '🪟',        // Mini OPI,
        'LUMINOSOS': '💡',        // Luminos,
        'OPI DIGITAL': '📱',        // OPI Digital móvil,
        'OPIDIGITAL': '📱',        // OPI Digital móvil,
        'OPI DIGIT.': '📱',        // OPI Digital móvil,
        'P.LEDS': '📱',        // OPI Digital móvil,
        'RELOJ': '🕒',        // Reloj,
        'MEDIANERA':'🧱',// PAred ladrillo
        'VARIOS':'🔧',// Varios
        // Añadir más tipos según sea necesario
    };
    
    // Buscar el emoji (búsqueda exacta primero, luego parcial)
    let emoji = iconosPorTipo[tipoNormalizado];
    
    // Si no se encuentra exacto, buscar parcialmente
    if (!emoji && tipoNormalizado) {
        for (const [tipo, icono] of Object.entries(iconosPorTipo)) {
            if (tipoNormalizado.includes(tipo) || tipo.includes(tipoNormalizado)) {
                emoji = icono;
                break;
            }
        }
    }
    
    // Si aún no se encuentra, usar uno por defecto
    if (!emoji) {
        emoji = '🔧';
        // Log solo para los primeros casos para no saturar la consola
        if (!getIconoPorTipoRecurso._loggedTypes) {
            getIconoPorTipoRecurso._loggedTypes = new Set();
        }
        if (!getIconoPorTipoRecurso._loggedTypes.has(tipoNormalizado) && getIconoPorTipoRecurso._loggedTypes.size < 10) {
            console.log(`⚠️ Tipo de recurso no mapeado: "${tipoRecurso}" (normalizado: "${tipoNormalizado}") - usando icono por defecto 🔧`);
            getIconoPorTipoRecurso._loggedTypes.add(tipoNormalizado);
        }
    }
    
    // Crear icono personalizado con el color de fondo según el estado
    return L.divIcon({
        className: 'custom-recurso-icon',
        html: `<div style="
            background-color: ${color};
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            text-align: center;
            line-height: 20px;
        ">${emoji}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
}

function getFechasFormulario() {
    return {
        fechaDesde: document.getElementById('fechaDesde')?.value || '',
        fechaHasta: document.getElementById('fechaHasta')?.value || ''
    };
}

async function fetchConTimeout(url, ms = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function buildUrlCampanasRecurso(noRecurso) {
    const { fechaDesde, fechaHasta } = getFechasFormulario();
    const params = new URLSearchParams();
    params.append('no_recurso', noRecurso);
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    return `/api/campanas?${params.toString()}`;
}

// Función común para crear un popup completo de recurso con carga de detalles
function crearPopupRecurso(marker, recurso) {
    // Almacenar datos del recurso
    recursosDataMap.set(recurso.No_, recurso);
    
    // Marcar como seleccionado por defecto
    recursosSeleccionados.add(recurso.No_);
    
    // Crear tooltip simple inicial (solo información básica)
    const simpleTooltip = `
        <div style="max-width: 350px; padding: 5px;">
            <h4>🔧 Recurso: ${recurso.Name || 'Sin nombre'}</h4>
            <p><strong>Nº:</strong> ${recurso.No_}</p>
            ${recurso['Tipo Recurso'] ? `<p><strong>Tipo de Recurso:</strong> ${recurso['Tipo Recurso']}</p>` : ''}
            ${recurso.Empresa ? `<p><strong>Empresa:</strong> ${recurso.Empresa}</p>` : ''}
            <p><strong>Estado:</strong> ${recurso.tiene_incidencia && recurso.total_incidencias > 0 ? '🚨 Con incidencias' : recurso.total_campanas > 0 ? '📋 Con campañas' : '✅ Sin problemas'}</p>
            <p><strong>Total campañas:</strong> ${recurso.total_campanas || 0}</p>
            <p><strong>Total incidencias:</strong> ${recurso.total_incidencias || 0}</p>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="checkbox" id="select-${recurso.No_}" 
                           checked 
                           onchange="toggleRecursoSeleccionado('${recurso.No_}')" 
                           style="margin-right: 8px;">
                    <span>Deseleccionar</span>
                </label>
            </div>
            <p style="text-align: center; margin-top: 5px; font-size: 12px; color: #666;">
                <em>Haz clic para ver detalles completos</em>
            </p>
            ${getIncidenciasBotonesHtml('', String(recurso.No_ || recurso['No_'] || ''))}
        </div>
    `;
    
    // Usar tooltip simple inicialmente
    marker.bindPopup(simpleTooltip, { maxWidth: 400 });
    setupPopupIncidenciaButtons(marker);
    
    let recursoDetallesCargados = false;
    let recursoDetallesCargando = false;
    
    // Crear tooltip completo solo cuando se necesite (no en cada clic del popup)
    marker.on('click', async function() {
        if (recursoDetallesCargados || recursoDetallesCargando) return;
        recursoDetallesCargando = true;
        console.log(`🖱️ Click en recurso: ${recurso.No_}`);
        
        const loadingTooltip = `
            <div style="max-width: 300px; padding: 10px; text-align: center;">
                <h4>🔧 ${recurso.Name || 'Sin nombre'}</h4>
                <p>Cargando detalles...</p>
                <div style="border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin: 10px auto;"></div>
            </div>
        `;
        marker.setPopupContent(loadingTooltip);
        
        try {
            const urlCampanas = buildUrlCampanasRecurso(recurso.No_);
            const { fechaDesde, fechaHasta } = getFechasFormulario();
            let urlDetallesFull = `/api/recursos/${encodeURIComponent(recurso.No_)}/detalles`;
            const detParams = new URLSearchParams();
            if (fechaDesde) detParams.append('fecha_desde', fechaDesde);
            if (fechaHasta) detParams.append('fecha_hasta', fechaHasta);
            if (detParams.toString()) urlDetallesFull += '?' + detParams.toString();

            const [responseDetalles, responseCampanas] = await Promise.all([
                fetch(urlDetallesFull),
                fetch(urlCampanas)
            ]);

            if (!responseDetalles.ok) {
                throw new Error(`Error al cargar detalles: ${responseDetalles.status}`);
            }

            const dataDetalles = await responseDetalles.json();
            let dataCampanas = { datos: [], total_registros: 0 };
            if (responseCampanas.ok) {
                dataCampanas = await responseCampanas.json();
            } else {
                console.warn(`⚠️ Error al cargar campañas: ${responseCampanas.status}`);
            }

            // Solo campañas filtradas por periodo (nunca el listado histórico de /detalles)
            const campanas = Array.isArray(dataCampanas.datos) ? dataCampanas.datos : [];
            const totalCampanas = campanas.length;

            let imagenBase64 = null;
            const ruta = recurso.Ruta || recurso['Ruta'] || recurso.ruta || '';
            const numeroRecurso = recurso.No_ || recurso['No_'] || '';

            if (ruta && numeroRecurso) {
                try {
                    const filepath = ruta + '/' + numeroRecurso + '.jpg';
                    const urlImagen = `/file?filepath=${encodeURIComponent(filepath)}`;
                    const responseImagen = await fetchConTimeout(urlImagen, 5000);
                    if (responseImagen.ok) {
                        const imagenData = await responseImagen.text();
                        if (imagenData && imagenData.trim().length > 0) {
                            imagenBase64 = imagenData;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Imagen del recurso no cargada (timeout o error):`, error);
                }
            }

            let tooltipContent = `
                <div style="max-width: 400px; max-height: 500px; overflow-y: auto; padding: 5px;">
                    <h4>🔧 Recurso: ${recurso.Name || 'Sin nombre'}</h4>
                    <p><strong>Nº:</strong> ${recurso.No_}</p>
                    ${recurso['Tipo Recurso'] ? `<p><strong>Tipo de Recurso:</strong> ${recurso['Tipo Recurso']}</p>` : ''}
                    ${recurso.Empresa ? `<p><strong>Empresa:</strong> ${recurso.Empresa}</p>` : ''}
                    ${fechaDesde && fechaHasta ? `<p><strong>Periodo:</strong> ${fechaDesde} → ${fechaHasta}</p>` : ''}
                    <p><strong>Estado:</strong> ${dataDetalles.total_incidencias > 0 ? '🚨 Con incidencias' : totalCampanas > 0 ? '📋 Con campañas' : '✅ Sin problemas'}</p>
                    <p><strong>Total campañas (periodo):</strong> ${totalCampanas}</p>
                    <p><strong>Total incidencias:</strong> ${dataDetalles.total_incidencias || 0}</p>
                    ${imagenBase64 ? `
                    <div style="margin: 10px 0; text-align: center;">
                        <h5>📷 Foto del Recurso</h5>
                        <img src="data:image/jpeg;base64,${imagenBase64}" 
                             alt="Foto del recurso ${recurso.No_}" 
                             style="max-width: 100%; max-height: 200px; border-radius: 5px; border: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
                             onerror="this.style.display='none';">
                    </div>
                    ` : ''}
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="select-detail-${recurso.No_}" 
                                   ${recursosSeleccionados.has(recurso.No_) ? 'checked' : ''} 
                                   onchange="toggleRecursoSeleccionado('${recurso.No_}')" 
                                   style="margin-right: 8px;">
                            <span>${recursosSeleccionados.has(recurso.No_) ? 'Deseleccionar' : 'Seleccionar para exportar'}</span>
                        </label>
                    </div>
            `;
            
            if (campanas.length > 0) {
                tooltipContent += `<h5 style="margin-top: 15px; margin-bottom: 10px;">📋 Campañas (${campanas.length}):</h5>`;
                campanas.forEach((campana, index) => {
                    tooltipContent += `<div style="margin-bottom: 10px; padding: 8px; background-color: #f8f9fa; border-left: 3px solid #007bff; border-radius: 4px;">`;
                    tooltipContent += `<strong style="color: #007bff; font-size: 1.05em;">Campaña ${index + 1}</strong><br><br>`;
                    const nombreCampana = campana.Campaña || campana['Campaña'] || campana.campana || '';
                    const cliente = campana.Cliente || campana['Cliente'] || campana.cliente || '';
                    const inicio = campana.Inicio || campana['Inicio'] || campana.inicio || '';
                    const fin = campana.Fin || campana['Fin'] || campana.fin || '';
                    const noIncidencia = campana['Nº Incidencia'] || campana.no_incidencia || '';
                    if (nombreCampana) tooltipContent += `<strong>📌 Nombre:</strong> ${nombreCampana}<br>`;
                    if (cliente) tooltipContent += `<strong>👤 Cliente:</strong> ${cliente}<br>`;
                    if (inicio) tooltipContent += `<strong>📅 Inicio:</strong> ${formatearFecha(inicio)}<br>`;
                    if (fin) tooltipContent += `<strong>📅 Fin:</strong> ${formatearFecha(fin)}<br>`;
                    if (inicio && fin) {
                        try {
                            const diffDays = Math.ceil(Math.abs(new Date(fin) - new Date(inicio)) / (1000 * 60 * 60 * 24));
                            tooltipContent += `<strong>⏱️ Duración:</strong> ${diffDays} día${diffDays !== 1 ? 's' : ''}<br>`;
                        } catch (e) { /* ignore */ }
                    }
                    if (noIncidencia) tooltipContent += `<strong>🔢 Nº Incidencia:</strong> ${noIncidencia}<br>`;
                    tooltipContent += `</div>`;
                });
            } else {
                tooltipContent += `<p><em>No hay campañas en el periodo seleccionado</em></p>`;
            }
            
            if (dataDetalles.incidencias && dataDetalles.incidencias.length > 0) {
                tooltipContent += `<h5>🚨 Incidencias (${dataDetalles.incidencias.length}):</h5>`;
                const incidenciasPorTipo = {};
                dataDetalles.incidencias.forEach(incidencia => {
                    const tipo = incidencia.Tipo || 'Sin tipo';
                    if (!incidenciasPorTipo[tipo]) incidenciasPorTipo[tipo] = [];
                    incidenciasPorTipo[tipo].push(incidencia);
                });
                Object.keys(incidenciasPorTipo).forEach(tipo => {
                    const incidenciasTipo = incidenciasPorTipo[tipo];
                    const fechas = incidenciasTipo.map(i => i.Fecha).filter(f => f).sort();
                    const desde = fechas.length > 0 ? formatearFecha(fechas[0]) : 'Sin fecha';
                    const hasta = fechas.length > 0 ? formatearFecha(fechas[fechas.length - 1]) : 'Sin fecha';
                    tooltipContent += `<div style="margin-bottom: 8px; padding: 5px; background-color: #fff3cd; border-left: 3px solid #ffc107;">`;
                    tooltipContent += `<strong>Tipo:</strong> ${tipo}<br>`;
                    tooltipContent += `<strong>Cantidad:</strong> ${incidenciasTipo.length}<br>`;
                    tooltipContent += `<strong>Desde:</strong> ${desde}<br>`;
                    tooltipContent += `<strong>Hasta:</strong> ${hasta}<br>`;
                    tooltipContent += `</div>`;
                });
            } else {
                tooltipContent += `<p><em>No hay incidencias registradas</em></p>`;
            }
            
            tooltipContent += getIncidenciasBotonesHtml('', String(recurso.No_ || recurso['No_'] || ''));
            tooltipContent += `</div>`;
            recursoDetallesCargados = true;
            marker.setPopupContent(tooltipContent);
            if (marker.isPopupOpen()) marker.openPopup();
            
        } catch (error) {
            console.error('Error cargando detalles:', error);
            const errorTooltip = `
                <div style="max-width: 300px; padding: 10px;">
                    <h4>🔧 ${recurso.Name || 'Sin nombre'}</h4>
                    <p><strong>Nº:</strong> ${recurso.No_}</p>
                    <p style="color: red;"><em>Error cargando detalles</em></p>
                    <p style="color: #666; font-size: 11px;">${error.message || 'Error desconocido'}</p>
                    ${getIncidenciasBotonesHtml('', recurso.No_)}
                </div>
            `;
            marker.setPopupContent(errorTooltip);
        } finally {
            recursoDetallesCargando = false;
        }
    });
}

// Función para plegar/desplegar las instrucciones
function toggleInstructions() {
    const content = document.getElementById('instructionsContent');
    const toggle = document.querySelector('.instructions-toggle');
    const icon = document.getElementById('instructionsIcon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.classList.add('expanded');
    } else {
        content.style.display = 'none';
        toggle.classList.remove('expanded');
    }
}

// Función para seleccionar/deseleccionar un recurso
function toggleRecursoSeleccionado(noRecurso) {
    if (recursosSeleccionados.has(noRecurso)) {
        recursosSeleccionados.delete(noRecurso);
    } else {
        recursosSeleccionados.add(noRecurso);
    }
    
    // Actualizar checkboxes en todos los popups
    const checkboxSimple = document.getElementById(`select-${noRecurso}`);
    const checkboxDetail = document.getElementById(`select-detail-${noRecurso}`);
    const checkboxSearch = document.getElementById(`select-search-${noRecurso}`);
    const checkboxZone = document.getElementById(`select-zone-${noRecurso}`);
    
    const isSelected = recursosSeleccionados.has(noRecurso);
    
    if (checkboxSimple) {
        checkboxSimple.checked = isSelected;
        const labelSimple = checkboxSimple.nextElementSibling;
        if (labelSimple) labelSimple.textContent = isSelected ? 'Deseleccionar' : 'Seleccionar para exportar';
    }
    if (checkboxDetail) {
        checkboxDetail.checked = isSelected;
        const labelDetail = checkboxDetail.nextElementSibling;
        if (labelDetail) labelDetail.textContent = isSelected ? 'Deseleccionar' : 'Seleccionar para exportar';
    }
    if (checkboxSearch) {
        checkboxSearch.checked = isSelected;
        const labelSearch = checkboxSearch.nextElementSibling;
        if (labelSearch) labelSearch.textContent = isSelected ? 'Deseleccionar' : 'Seleccionar para exportar';
    }
    if (checkboxZone) {
        checkboxZone.checked = isSelected;
        const labelZone = checkboxZone.nextElementSibling;
        if (labelZone) labelZone.textContent = isSelected ? 'Deseleccionar' : 'Seleccionar para exportar';
    }
    
    // Actualizar contador si existe
    updateContadorSeleccionados();
}

// Función para actualizar el contador de recursos seleccionados
function updateContadorSeleccionados() {
    const contador = document.getElementById('contadorSeleccionados');
    if (contador) {
        contador.textContent = `(${recursosSeleccionados.size} seleccionados)`;
    }
}

// Función para exportar recursos seleccionados a Excel
async function exportarRecursosExcel() {
    if (recursosSeleccionados.size === 0) {
        showNotification('No hay recursos seleccionados para exportar', 'warning');
        return;
    }
    
    try {
        const recursosArray = Array.from(recursosSeleccionados);
        const response = await fetch('/api/exportar-excel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ recursos: recursosArray })
        });
        
        if (!response.ok) {
            throw new Error('Error al exportar a Excel');
        }
        
        // Descargar el archivo
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recursos_seleccionados_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showNotification(`Excel exportado con ${recursosSeleccionados.size} recursos`, 'success');
    } catch (error) {
        console.error('Error exportando a Excel:', error);
        showNotification('Error al exportar a Excel: ' + error.message, 'error');
    }
}


// Función auxiliar para añadir fechas y tipos de recurso a las URLs de las APIs
function addFechasToUrl(url) {
    const fechaDesde = document.getElementById('fechaDesde').value;
    const fechaHasta = document.getElementById('fechaHasta').value;
    
    const params = new URLSearchParams();
    
    // Añadir parámetros existentes de la URL
    const urlObj = new URL(url, window.location.origin);
    urlObj.searchParams.forEach((value, key) => {
        params.append(key, value);
    });
    
    // Añadir fechas si están seleccionadas
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    
    // Añadir tipos de recurso y empresas seleccionados (solo para APIs de recursos, no mobiliario)
    if (url.includes('/api/recursos') && !url.includes('/api/mobiliario')) {
        const tiposRecursoSelect = document.getElementById('tiposRecurso');
        if (tiposRecursoSelect) {
            const selectedTipos = Array.from(tiposRecursoSelect.selectedOptions)
                .map(option => option.value)
                .filter(value => value); // Filtrar valores vacíos
            
            if (selectedTipos.length > 0) {
                params.append('tipos_recurso', selectedTipos.join(','));
            }
        }
        
        const empresasSelect = document.getElementById('empresas');
        if (empresasSelect) {
            const selectedEmpresas = Array.from(empresasSelect.selectedOptions)
                .map(option => option.value)
                .filter(value => value); // Filtrar valores vacíos
            
            if (selectedEmpresas.length > 0) {
                params.append('empresas', selectedEmpresas.join(','));
            }
        }
        
        const familiasSelect = document.getElementById('familias');
        if (familiasSelect) {
            const selectedFamilias = Array.from(familiasSelect.selectedOptions)
                .map(option => option.value)
                .filter(value => value); // Filtrar valores vacíos
            
            if (selectedFamilias.length > 0) {
                params.append('familias', selectedFamilias.join(','));
            }
        }
    }
    
    // Construir nueva URL
    const baseUrl = url.split('?')[0];
    const queryString = params.toString();
    
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// Cargar empresas disponibles
async function loadEmpresas() {
    try {
        const empresasSelect = document.getElementById('empresas');
        if (!empresasSelect) return;
        
        // Limpiar opciones existentes
        empresasSelect.innerHTML = '<option value="">Cargando empresas...</option>';
        
        // Construir URL con fechas (si no hay fechas, el backend usará la fecha de hoy)
        const fechaDesde = document.getElementById('fechaDesde')?.value || '';
        const fechaHasta = document.getElementById('fechaHasta')?.value || '';
        
        let url = '/api/empresas';
        const params = new URLSearchParams();
        
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Limpiar y añadir opciones
        empresasSelect.innerHTML = '';
        
        if (data.empresas && data.empresas.length > 0) {
            data.empresas.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa;
                option.textContent = empresa;
                empresasSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay empresas disponibles';
            empresasSelect.appendChild(option);
        }
        
        console.log(`✅ Cargadas ${data.total || 0} empresas`);
        
    } catch (error) {
        console.error('Error al cargar empresas:', error);
        const empresasSelect = document.getElementById('empresas');
        if (empresasSelect) {
            empresasSelect.innerHTML = '<option value="">Error al cargar empresas</option>';
        }
    }
}

// Cargar familias disponibles
async function loadFamilias() {
    try {
        const familiasSelect = document.getElementById('familias');
        if (!familiasSelect) return;
        
        // Limpiar opciones existentes
        familiasSelect.innerHTML = '<option value="">Cargando familias...</option>';
        
        // Construir URL con fechas (si no hay fechas, el backend usará la fecha de hoy)
        const fechaDesde = document.getElementById('fechaDesde')?.value || '';
        const fechaHasta = document.getElementById('fechaHasta')?.value || '';
        
        let url = '/api/familias';
        const params = new URLSearchParams();
        
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Limpiar y añadir opciones
        familiasSelect.innerHTML = '';
        
        if (data.familias && data.familias.length > 0) {
            data.familias.forEach(familia => {
                const option = document.createElement('option');
                option.value = familia;
                option.textContent = familia;
                familiasSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay familias disponibles';
            familiasSelect.appendChild(option);
        }
        
        console.log(`✅ Cargadas ${data.total || 0} familias`);
        
    } catch (error) {
        console.error('Error al cargar familias:', error);
        const familiasSelect = document.getElementById('familias');
        if (familiasSelect) {
            familiasSelect.innerHTML = '<option value="">Error al cargar familias</option>';
        }
    }
}

// Cargar tipos de recurso disponibles
async function loadTiposRecurso() {
    try {
        const tiposSelect = document.getElementById('tiposRecurso');
        if (!tiposSelect) return;
        
        // Limpiar opciones existentes
        tiposSelect.innerHTML = '<option value="">Cargando tipos...</option>';
        
        // Construir URL con fechas (si no hay fechas, el backend usará la fecha de hoy)
        const fechaDesde = document.getElementById('fechaDesde')?.value || '';
        const fechaHasta = document.getElementById('fechaHasta')?.value || '';
        
        let url = '/api/tipos-recurso';
        const params = new URLSearchParams();
        
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Limpiar y añadir opciones
        tiposSelect.innerHTML = '';
        
        if (data.tipos_recurso && data.tipos_recurso.length > 0) {
            data.tipos_recurso.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo;
                option.textContent = tipo;
                tiposSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay tipos disponibles';
            tiposSelect.appendChild(option);
        }
        
        console.log(`✅ Cargados ${data.total || 0} tipos de recurso`);
        
    } catch (error) {
        console.error('Error al cargar tipos de recurso:', error);
        const tiposSelect = document.getElementById('tiposRecurso');
        if (tiposSelect) {
            tiposSelect.innerHTML = '<option value="">Error al cargar tipos</option>';
        }
    }
}

// Función auxiliar para formatear fechas
function formatearFecha(fecha) {
    if (!fecha) return 'Sin fecha';
    
    try {
        // Si es una cadena de fecha, convertirla a objeto Date
        const fechaObj = new Date(fecha);
        
        // Verificar si es una fecha válida
        if (isNaN(fechaObj.getTime())) {
            return fecha; // Devolver la cadena original si no es una fecha válida
        }
        
        // Formatear como dd/mm/yyyy
        const dia = fechaObj.getDate().toString().padStart(2, '0');
        const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
        const año = fechaObj.getFullYear();
        
        return `${dia}/${mes}/${año}`;
    } catch (error) {
        console.error('Error formateando fecha:', error, 'Fecha original:', fecha);
        return fecha; // Devolver la cadena original si hay error
    }
}

// Configuración inicial del mapa
function initMap() {
    console.log('🗺️ Inicializando mapa...');
    
    // Crear el mapa centrado en España (ajustar según tu ubicación)
    map = L.map('map').setView([40.4168, -3.7038], 6);
    console.log('✅ Mapa creado:', map);
    
    // Agregar capa de tiles de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    initIncidenciasPopupDelegation();

    console.log('✅ Mapa inicializado correctamente');
}

// Cargar todos los datos geoespaciales desde la API
async function loadAllGeoData() {
    const statusDiv = document.getElementById('status');
    const loadButton = document.getElementById('loadAllData');
    
    try {
        statusDiv.textContent = 'Cargando todos los datos...';
        statusDiv.className = 'status';
        loadButton.disabled = true;
        
        // Limpiar datos anteriores
        clearMap();
        
        // Obtener fechas si están seleccionadas
        const fechaDesde = document.getElementById('fechaDesde').value;
        const fechaHasta = document.getElementById('fechaHasta').value;
        
        // Construir URLs con parámetros de fecha si existen
        let recursosUrl = '/api/recursos';
        let mobiliarioUrl = '/api/mobiliario';
        const params = new URLSearchParams();
        
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);
        
        if (params.toString()) {
            recursosUrl += '?' + params.toString();
            mobiliarioUrl += '?' + params.toString();
        }
        
        // Cargar recursos y mobiliario en paralelo
        const [recursosResponse, mobiliarioResponse] = await Promise.all([
            fetch(recursosUrl),
            fetch(mobiliarioUrl)
        ]);
        
        if (!recursosResponse.ok || !mobiliarioResponse.ok) {
            throw new Error(`Error HTTP: ${recursosResponse.status} / ${mobiliarioResponse.status}`);
        }
        
        const recursosData = await recursosResponse.json();
        const mobiliarioData = await mobiliarioResponse.json();
        
        if (recursosData.error) {
            throw new Error(`Error en recursos: ${recursosData.error}`);
        }
        if (mobiliarioData.error) {
            throw new Error(`Error en mobiliario: ${mobiliarioData.error}`);
        }
        
        // Cargar recursos
        await loadRecursosData(recursosData);
        
        // Cargar mobiliario
        await loadMobiliarioData(mobiliarioData);
        
        const totalElementos = recursosData.total_registros + mobiliarioData.total_registros;
        statusDiv.textContent = `✓ Cargados ${totalElementos} elementos (${recursosData.total_registros} recursos + ${mobiliarioData.total_registros} mobiliario)`;
        statusDiv.className = 'status success';
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        statusDiv.textContent = `✗ Error: ${error.message}`;
        statusDiv.className = 'status error';
    } finally {
        loadButton.disabled = false;
    }
}

// Función auxiliar para cargar datos de recursos
async function loadRecursosData(data) {
    // Verificar que el mapa esté inicializado
    if (!map) {
        console.error('❌ El mapa no está inicializado');
        return;
    }
    
    // Crear un nuevo layer (asegurarse de que no se reutiliza el anterior)
    const newRecursosLayer = L.layerGroup();
    recursosLayer = newRecursosLayer;
    console.log('✅ Nuevo layer de recursos creado:', recursosLayer);
    console.log('ID del layer:', recursosLayer._leaflet_id);
    
    // Procesar en lotes para mejor rendimiento
    const batchSize = 100;
    const totalItems = data.datos.length;
    let marcadoresCreados = 0;
    let recursosSinCoordenadas = 0;
    
    console.log(`Procesando ${totalItems} recursos en lotes de ${batchSize}...`);
    
    for (let i = 0; i < totalItems; i += batchSize) {
        const batch = data.datos.slice(i, i + batchSize);
        
        batch.forEach(recurso => {
            // Verificar que las coordenadas existan y sean válidas
            if (recurso.PuntoX != null && recurso.PuntoY != null && 
                !isNaN(recurso.PuntoX) && !isNaN(recurso.PuntoY) &&
                recurso.PuntoX !== 0 && recurso.PuntoY !== 0) {
                
                // Lógica de colores: Rojo si tiene incidencias, Naranja si tiene campañas, Verde si no tiene nada
                let color = '#44ff44'; // Verde por defecto
                if (recurso.tiene_incidencia && recurso.total_incidencias > 0) {
                    color = '#ff4444'; // Rojo si tiene incidencias
                } else if (recurso.total_campanas > 0) {
                    color = '#ff8800'; // Naranja si tiene campañas pero no incidencias
                }
                
                try {
                    // Validar coordenadas antes de crear el marcador
                    const lat = parseFloat(recurso.PuntoY);
                    const lng = parseFloat(recurso.PuntoX);
                    
                    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                        console.warn(`Coordenadas inválidas para recurso ${recurso.No_}: (${recurso.PuntoY}, ${recurso.PuntoX})`);
                        recursosSinCoordenadas++;
                        return;
                    }
                    
                    // Obtener el tipo de recurso
                    const tipoRecurso = recurso['Tipo Recurso'] || recurso['TipoRecurso'] || '';
                    
                    // Log para los primeros marcadores para verificar qué tipos se están recibiendo
                    if (marcadoresCreados < 5) {
                        console.log(`🔍 Recurso ${recurso.No_}: Tipo original="${recurso['Tipo Recurso']}", Tipo usado="${tipoRecurso}"`);
                    }
                    
                    // Obtener el icono según el tipo de recurso
                    const icono = getIconoPorTipoRecurso(tipoRecurso, color);
                    
                    // Crear marcador con icono personalizado
                    const marker = L.marker([lat, lng], {
                        icon: icono
                    });
                
                    // Usar función común para crear el popup
                    crearPopupRecurso(marker, recurso);
                    
                    recursosLayer.addLayer(marker);
                    marcadoresCreados++;
                    
                    // Mostrar coordenadas de los primeros 3 marcadores para verificación
                    if (marcadoresCreados <= 3) {
                        const markerLatLng = marker.getLatLng();
                        console.log(`Marcador ${marcadoresCreados} creado en: (${markerLatLng.lat}, ${markerLatLng.lng}) - Recurso: ${recurso.No_}, Tipo: "${tipoRecurso}"`);
                    }
                } catch (error) {
                    console.error(`Error creando marcador para recurso ${recurso.No_}:`, error);
                    recursosSinCoordenadas++;
                }
            }
        });
        
        // Mostrar progreso
        const progress = Math.min(100, Math.round(((i + batchSize) / totalItems) * 100));
        const currentItem = Math.min(i + batchSize, totalItems);
        console.log(`Progreso recursos: ${progress}% (${currentItem}/${totalItems})`);
        
        // Actualizar indicador visual
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = `Cargando recursos... ${progress}% (${currentItem}/${totalItems})`;
        }
        
        // Pequeña pausa para no bloquear la UI
        if (i + batchSize < totalItems) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    console.log(`Recursos cargados completamente: ${marcadoresCreados} marcadores creados, ${recursosSinCoordenadas} sin coordenadas válidas`);
    
    // Verificar que hay marcadores antes de añadir al mapa
    const totalMarcadores = recursosLayer.getLayers().length;
    console.log(`Total de marcadores en el layer: ${totalMarcadores}`);
    
    // Mostrar coordenadas de algunos marcadores de ejemplo para verificación
    if (totalMarcadores > 0) {
        const sampleMarkers = [];
        recursosLayer.eachLayer(function(layer, index) {
            if (index < 3 && layer.getLatLng && typeof layer.getLatLng === 'function') {
                const latLng = layer.getLatLng();
                sampleMarkers.push(`Marcador ${index + 1}: (${latLng.lat}, ${latLng.lng})`);
            }
        });
        if (sampleMarkers.length > 0) {
            console.log('Coordenadas de ejemplo:', sampleMarkers.join(', '));
        }
    }
    
    if (totalMarcadores > 0) {
        // Añadir el layer al mapa usando addLayer para mayor control
        if (!map.hasLayer(recursosLayer)) {
            map.addLayer(recursosLayer);
            console.log('✅ Capa de recursos añadida al mapa con addLayer()');
        } else {
            console.log('⚠️ El layer ya estaba en el mapa');
        }
        
        // Forzar actualización del mapa
        map.invalidateSize();
        
        // Pequeño delay para asegurar que el layer se renderice
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Ajustar vista del mapa para mostrar todos los recursos
        try {
            const bounds = L.latLngBounds();
            let boundsCount = 0;
            let invalidCoords = 0;
            
            // Función helper para validar coordenadas
            function isValidCoordinate(lat, lng) {
                return lat != null && lng != null && 
                       !isNaN(lat) && !isNaN(lng) &&
                       lat >= -90 && lat <= 90 &&
                       lng >= -180 && lng <= 180;
            }
            
            recursosLayer.eachLayer(function(layer) {
                // Para markers y circleMarkers, usar getLatLng()
                if (layer instanceof L.Marker || layer instanceof L.CircleMarker || (layer.getLatLng && typeof layer.getLatLng === 'function')) {
                    const latLng = layer.getLatLng();
                    if (latLng) {
                        const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
                        const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
                        
                        if (isValidCoordinate(lat, lng)) {
                            bounds.extend([lat, lng]);
                            boundsCount++;
                        } else {
                            invalidCoords++;
                            if (invalidCoords <= 5) {
                                console.warn(`Coordenada inválida ignorada: (${lat}, ${lng})`);
                            }
                        }
                    }
                } else if (layer.getLatLngs && typeof layer.getLatLngs === 'function') {
                    // Para polígonos y otras formas
                    const latLngs = layer.getLatLngs();
                    if (Array.isArray(latLngs)) {
                        latLngs.forEach(latLng => {
                            const lat = typeof latLng.lat === 'function' ? latLng.lat() : (latLng.lat || latLng[0]);
                            const lng = typeof latLng.lng === 'function' ? latLng.lng() : (latLng.lng || latLng[1]);
                            if (isValidCoordinate(lat, lng)) {
                                bounds.extend([lat, lng]);
                            }
                        });
                    } else if (latLngs) {
                        const lat = typeof latLngs.lat === 'function' ? latLngs.lat() : latLngs.lat;
                        const lng = typeof latLngs.lng === 'function' ? latLngs.lng() : latLngs.lng;
                        if (isValidCoordinate(lat, lng)) {
                            bounds.extend([lat, lng]);
                        }
                    }
                }
            });
            
            console.log(`Bounds extendidos con ${boundsCount} marcadores válidos, ${invalidCoords} inválidos ignorados`);
            
            if (bounds.isValid() && boundsCount > 0) {
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();
                console.log(`Bounds válidos: SW(${sw.lat.toFixed(6)}, ${sw.lng.toFixed(6)}), NE(${ne.lat.toFixed(6)}, ${ne.lng.toFixed(6)})`);
                
                map.fitBounds(bounds, { padding: [50, 50] });
                console.log('✅ Vista del mapa ajustada a los recursos');
                
                // Esperar a que el ajuste de vista se complete
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Verificar y re-añadir el layer si es necesario después del fitBounds
                if (!map.hasLayer(recursosLayer)) {
                    console.warn('⚠️ Layer desapareció después de fitBounds, re-añadiendo...');
                    map.addLayer(recursosLayer);
                    map.invalidateSize();
                }
            } else {
                console.warn('⚠️ Los bounds no son válidos o no hay marcadores con coordenadas');
                // Construir bounds manualmente iterando sobre los layers
                try {
                    const manualBounds = L.latLngBounds();
                    let validCount = 0;
                    
                    function isValidCoordinate(lat, lng) {
                        return lat != null && lng != null && 
                               !isNaN(lat) && !isNaN(lng) &&
                               lat >= -90 && lat <= 90 &&
                               lng >= -180 && lng <= 180;
                    }
                    
                    recursosLayer.eachLayer(function(layer) {
                        if (layer instanceof L.Marker || layer instanceof L.CircleMarker || (layer.getLatLng && typeof layer.getLatLng === 'function')) {
                            const latLng = layer.getLatLng();
                            if (latLng) {
                                const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
                                const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
                                
                                if (isValidCoordinate(lat, lng)) {
                                    manualBounds.extend([lat, lng]);
                                    validCount++;
                                }
                            }
                        }
                    });
                    
                    if (manualBounds.isValid() && validCount > 0) {
                        const sw = manualBounds.getSouthWest();
                        const ne = manualBounds.getNorthEast();
                        console.log(`Usando bounds manuales: SW(${sw.lat.toFixed(6)}, ${sw.lng.toFixed(6)}), NE(${ne.lat.toFixed(6)}, ${ne.lng.toFixed(6)})`);
                        map.fitBounds(manualBounds, { padding: [50, 50] });
                        console.log('✅ Vista del mapa ajustada usando bounds manuales');
                    } else {
                        console.warn('⚠️ No se pudieron construir bounds válidos');
                        // Como último recurso, hacer zoom a un nivel razonable
                        map.setView([39.5696, 2.6502], 10); // Coordenadas aproximadas de Baleares
                        console.log('✅ Vista del mapa ajustada a coordenadas por defecto');
                    }
                } catch (boundsError) {
                    console.error('Error construyendo bounds manuales:', boundsError);
                    // Como último recurso, hacer zoom a un nivel razonable
                    map.setView([39.5696, 2.6502], 10);
                    console.log('✅ Vista del mapa ajustada a coordenadas por defecto (fallback)');
                }
            }
        } catch (error) {
            console.error('Error ajustando vista del mapa:', error);
            // Como último recurso, hacer zoom a un nivel razonable
            try {
                map.setView([39.5696, 2.6502], 10);
                console.log('✅ Vista del mapa ajustada a coordenadas por defecto (error handler)');
            } catch (fallbackError) {
                console.error('Error en fallback de vista:', fallbackError);
            }
        }
        
        // Verificación final: asegurar que el layer está en el mapa
        await new Promise(resolve => setTimeout(resolve, 100));
        const layersInMap = map.hasLayer(recursosLayer);
        const totalLayers = recursosLayer.getLayers().length;
        console.log(`Verificación final: Layer está en el mapa: ${layersInMap}, Total marcadores: ${totalLayers}`);
        
        if (!layersInMap) {
            console.error('❌ El layer no se añadió correctamente al mapa, intentando de nuevo...');
            map.addLayer(recursosLayer);
            map.invalidateSize();
            
            // Verificar de nuevo después de re-añadir
            await new Promise(resolve => setTimeout(resolve, 100));
            const stillInMap = map.hasLayer(recursosLayer);
            console.log(`Verificación después de re-añadir: Layer está en el mapa: ${stillInMap}`);
            
            if (!stillInMap) {
                console.error('❌❌ CRÍTICO: El layer no se puede mantener en el mapa');
            }
        } else {
            console.log('✅✅ Layer confirmado en el mapa con', totalLayers, 'marcadores');
            
            // Verificar que el zoom sea razonable (no demasiado alejado)
            const currentZoom = map.getZoom();
            const center = map.getCenter();
            console.log(`Zoom actual: ${currentZoom}, Centro: (${center.lat}, ${center.lng})`);
            
            // Si el zoom es muy bajo (< 5), ajustarlo a un nivel más razonable
            if (currentZoom < 5) {
                console.warn('⚠️ Zoom muy bajo, ajustando a nivel 8');
                map.setZoom(8);
            }
            
            // Verificar que al menos algunos marcadores estén en la vista actual
            const mapBounds = map.getBounds();
            let visibleMarkers = 0;
            recursosLayer.eachLayer(function(layer) {
                if (layer instanceof L.Marker || layer instanceof L.CircleMarker || (layer.getLatLng && typeof layer.getLatLng === 'function')) {
                    const latLng = layer.getLatLng();
                    if (latLng && mapBounds.contains(latLng)) {
                        visibleMarkers++;
                    }
                }
            });
            console.log(`Marcadores visibles en la vista actual: ${visibleMarkers} de ${totalLayers}`);
            
            if (visibleMarkers === 0 && totalLayers > 0) {
                console.warn('⚠️ Ningún marcador está visible en la vista actual, ajustando zoom...');
                // Construir bounds manualmente
                try {
                    const layerBounds = L.latLngBounds();
                    let validCount = 0;
                    
                    function isValidCoordinate(lat, lng) {
                        return lat != null && lng != null && 
                               !isNaN(lat) && !isNaN(lng) &&
                               lat >= -90 && lat <= 90 &&
                               lng >= -180 && lng <= 180;
                    }
                    
                    recursosLayer.eachLayer(function(layer) {
                        if (layer instanceof L.Marker || layer instanceof L.CircleMarker || (layer.getLatLng && typeof layer.getLatLng === 'function')) {
                            const latLng = layer.getLatLng();
                            if (latLng) {
                                const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
                                const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
                                
                                if (isValidCoordinate(lat, lng)) {
                                    layerBounds.extend([lat, lng]);
                                    validCount++;
                                }
                            }
                        }
                    });
                    
                    if (layerBounds.isValid() && validCount > 0) {
                        map.fitBounds(layerBounds, { padding: [50, 50], maxZoom: 15 });
                        console.log('✅ Vista re-ajustada usando bounds manuales');
                    } else {
                        console.warn('⚠️ No se pudieron construir bounds para re-ajuste');
                    }
                } catch (error) {
                    console.error('Error re-ajustando vista:', error);
                }
            }
        }
        
        // Monitor temporal para detectar si el layer desaparece
        let monitorCount = 0;
        const monitorInterval = setInterval(() => {
            monitorCount++;
            const isInMap = map.hasLayer(recursosLayer);
            const markerCount = recursosLayer ? recursosLayer.getLayers().length : 0;
            
            if (!isInMap && markerCount > 0) {
                console.error(`🚨 ALERTA: Layer desapareció después de ${monitorCount * 500}ms! Re-añadiendo...`);
                map.addLayer(recursosLayer);
                map.invalidateSize();
            }
            
            // Detener el monitor después de 10 segundos
            if (monitorCount >= 20) {
                clearInterval(monitorInterval);
                console.log('Monitor de layer detenido');
            }
        }, 500);
    } else {
        console.warn('⚠️ No se crearon marcadores, no se añadirá nada al mapa');
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = '⚠️ No se encontraron recursos con coordenadas válidas';
            statusDiv.className = 'status error';
        }
    }
    
    // Actualizar contador de seleccionados
    updateContadorSeleccionados();
}

// Función auxiliar para cargar datos de mobiliario
const GOOGLE_MAPS_API_KEY = 'AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno';

function esZonaCriticaMobiliario(mobiliario) {
    const v = mobiliario['Zona Crítica'];
    return v !== undefined && v !== null && v !== 0 && v !== '0' && v !== '';
}

function getMobiliarioEstadoTexto(mobiliario) {
    if (esZonaCriticaMobiliario(mobiliario)) return '🚨 Zona crítica';
    return mobiliario.tiene_incidencia ? '⚠️ Con incidencias' : '✅ Sin incidencias';
}

function getTipoParadaInfo(mobiliario) {
    const rawTipoParada = (mobiliario['Tipo Parada'] || mobiliario.Tipo || '').toString().trim();
    const tipoLower = rawTipoParada.toLowerCase();
    const extraText = (
        (mobiliario['Tipo Banco'] || '') + ' ' +
        (mobiliario['Banco Madera'] || '') + ' ' +
        (mobiliario['Descripción'] || '')
    ).toString().toLowerCase();
    const palLiRegex = /pal\s*-\s*li|pal\s*li|pal-li/;

    if (palLiRegex.test(tipoLower) || palLiRegex.test(extraText)) {
        return { base: 'P', badge: '*', family: 'pal-li', raw: rawTipoParada };
    }

    let base = '🚏';
    let badge = '';
    let family = 'otro';

    if (tipoLower.includes('opi')) {
        base = 'O';
        family = 'opi';
    } else if (tipoLower.includes('poste') || tipoLower.startsWith('pi') || tipoLower.startsWith('pa') || tipoLower.includes(' pi')) {
        base = 'P';
        family = 'poste';
    } else if (tipoLower.includes('marquesina') || /^ma[-\s]?\d+/.test(tipoLower) || /ma[-\s]?\d+/i.test(rawTipoParada)) {
        base = 'M';
        family = 'marquesina';
    } else if (tipoLower.includes('banco')) {
        base = 'B';
        family = 'banco';
    }

    if (family === 'poste') {
        if (tipoLower === 'pa') badge = 'A';
        else if (tipoLower === 'pi' || tipoLower.startsWith('pi') || tipoLower.includes(' pi')) badge = 'I';
    }
    if (family === 'marquesina') {
        const matchMa = tipoLower.match(/ma[-\s]?(\d+)/);
        if (matchMa) badge = matchMa[1];
        if (tipoLower.includes('nuevo')) badge = badge ? `${badge}N` : 'N';
    }
    if (family === 'banco') {
        const bancoRaw = ((mobiliario['Tipo Banco'] || mobiliario['Banco Madera'] || rawTipoParada) || '').toString().toLowerCase();
        const matchListones = bancoRaw.match(/(\d+)\s*liston/);
        if (matchListones) badge = matchListones[1];
    }

    return { base, badge, family, raw: rawTipoParada };
}

function getMobiliarioMarkerColor(mobiliario) {
    if (esZonaCriticaMobiliario(mobiliario)) return '#ff4444';
    if (mobiliario.tiene_incidencia) return '#ff8800';
    return '#4488ff';
}

function buildMobiliarioUbicacionHtml(mobiliario, width, height) {
    const lat = parseFloat(mobiliario.PuntoY).toFixed(6);
    const lon = parseFloat(mobiliario.PuntoX).toFixed(6);
    const num = mobiliario['Nº Emplazamiento'];
    const desc = mobiliario.Descripción || mobiliario.Dirección || `${mobiliario.PuntoY},${mobiliario.PuntoX}`;
    const mapsQuery = encodeURIComponent(`Parada Bus ${num} - ${desc} - Palma de Mallorca`);

    return `
        <div style="margin:10px 0;text-align:center;">
            <h5 style="margin:5px 0;font-size:14px;">🌍 Ubicación</h5>
            <div style="position:relative;width:${width}px;height:${height}px;border:1px solid #ccc;border-radius:5px;overflow:hidden;background:#f0f0f0;">
                <img decoding="async"
                    src="https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${lat},${lon}&heading=0&pitch=0&fov=90&key=${GOOGLE_MAPS_API_KEY}"
                    style="width:100%;height:100%;object-fit:cover;"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='block';"
                    alt="Street View de la parada">
                <div style="display:none;width:100%;height:100%;">
                    <iframe width="100%" height="100%" frameborder="0" style="border:none;"
                        src="https://www.google.com/maps/embed/v1/view?center=${lat},${lon}&zoom=18&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}"
                        allowfullscreen></iframe>
                </div>
                <div style="position:absolute;top:5px;left:5px;background:rgba(0,0,0,0.7);color:white;padding:6px;border-radius:3px;font-size:11px;max-width:150px;">
                    <strong>🚌 ${num}</strong><br>
                    <small>${mobiliario.Descripción || 'Parada'}</small>
                </div>
            </div>
            <p style="font-size:11px;color:#666;margin-top:3px;">
                <a href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}" target="_blank" style="color:#007bff;text-decoration:none;">🔗 Google Maps</a>
                <span style="margin:0 8px;">|</span>
                <a href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}&t=h" target="_blank" style="color:#ff6b35;text-decoration:none;">🚶 Street View</a>
                <span style="margin:0 8px;">|</span>
                <a href="https://www.openstreetmap.org/?mlat=${mobiliario.PuntoY}&mlon=${mobiliario.PuntoX}&zoom=18" target="_blank" style="color:#28a745;text-decoration:none;">🗺️ OpenStreetMap</a>
            </p>
        </div>`;
}

function buildMobiliarioCamposHtml(mobiliario) {
    const tipoParada = mobiliario['Tipo Parada'] || 'N/A';
    const tipoBanco = mobiliario['Tipo Banco'] || 'N/A';
    const opiInstalado = (mobiliario['Opi Instalado'] === 1 || mobiliario['Opi Instalado'] === '1') ? 'Sí' : 'No';
    const tip = mobiliario.SAE || 'No';
    const direccion = mobiliario.Dirección || 'No disponible';

    return `
        <hr style="margin:8px 0;border-color:#ddd;">
        <p><strong>Tipo de Parada:</strong> ${tipoParada}</p>
        ${tipoBanco !== 'N/A' ? `<p><strong>Tipo de Banco:</strong> ${tipoBanco}</p>` : ''}
        <p><strong>OPI Instalado:</strong> ${opiInstalado}</p>
        <p><strong>TIP:</strong> ${tip}</p>
        <p><strong>Dirección:</strong> ${direccion}</p>`;
}

function buildMobiliarioPopupSimple(mobiliario, distanciaKm) {
    const distTxt = distanciaKm != null ? `<p><strong>Distancia:</strong> ${Number(distanciaKm).toFixed(2)} km</p>` : '';
    return `
        <div style="max-width:350px;padding:5px;">
            <h4>🪑 ${mobiliario.Descripción || 'Sin descripción'}</h4>
            <p><strong>Nº:</strong> ${mobiliario['Nº Emplazamiento']}</p>
            <p><strong>Estado:</strong> ${getMobiliarioEstadoTexto(mobiliario)}</p>
            <p><strong>Incidencias:</strong> ${mobiliario.total_incidencias || 0}</p>
            ${distTxt}
            ${buildMobiliarioCamposHtml(mobiliario)}
            ${buildMobiliarioUbicacionHtml(mobiliario, 320, 150)}
            <p style="text-align:center;margin-top:5px;font-size:12px;color:#666;">
                <em>Haz clic para ver detalles completos</em>
            </p>
            ${getIncidenciasBotonesHtml(String(mobiliario['Nº Emplazamiento'] || ''), '')}
        </div>`;
}

function buildMobiliarioIncidenciasHtml(data) {
    const incidencias = data.incidencias || [];
    if (incidencias.length > 0) {
        let html = `<h5>🚨 Incidencias (${incidencias.length}):</h5><div style="max-height:200px;overflow-y:auto;">`;
        incidencias.forEach((incidencia) => {
            const fecha = incidencia.Fecha ? formatearFecha(incidencia.Fecha) : 'Sin fecha';
            const motivo = incidencia.Motivo || 'Sin motivo';
            const tipo = incidencia.Tipo || 'Sin tipo';
            const numIncidencia = incidencia['Nº Incidencia'] || '';
            const motivoCorto = motivo.length > 80 ? `${motivo.substring(0, 80)}...` : motivo;
            html += `
                <div style="margin-bottom:8px;padding:8px;background-color:#fff3cd;border-left:3px solid #ffc107;border-radius:4px;">
                    <strong>#${numIncidencia}</strong> - ${tipo}<br>
                    <small style="color:#666;">📅 ${fecha}</small><br>
                    <small style="color:#333;">${motivoCorto}</small>
                </div>`;
        });
        html += '</div>';
        return html;
    }
    if (data.total_incidencias > 0) {
        return `<p style="color:orange;"><em>⚠️ Hay ${data.total_incidencias} incidencia(s) pero no se pudieron cargar los detalles</em></p>`;
    }
    return '<p><em>No hay incidencias registradas</em></p>';
}

async function cargarMobiliarioPopupDetalle(marker, mobiliario) {
    const loadingTooltip = `
        <div style="max-width:300px;padding:10px;text-align:center;">
            <h4>🪑 ${mobiliario.Descripción || 'Sin descripción'}</h4>
            <p>Cargando incidencias...</p>
            <div style="border:2px solid #f3f3f3;border-top:2px solid #3498db;border-radius:50%;width:20px;height:20px;animation:spin 1s linear infinite;margin:10px auto;"></div>
        </div>`;
    marker.setPopupContent(loadingTooltip);

    try {
        const response = await fetch(`/api/mobiliario/${mobiliario['Nº Emplazamiento']}/incidencias`);
        if (!response.ok) {
            throw new Error(`Error al obtener incidencias: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Error al obtener incidencias');
        }

        let tooltipContent = `
            <div style="max-width:460px;max-height:520px;overflow-y:auto;overflow-x:hidden;padding:5px;">
                <h4>🪑 Mobiliario: ${mobiliario.Descripción || 'Sin descripción'}</h4>
                <p><strong>Nº Emplazamiento:</strong> ${mobiliario['Nº Emplazamiento']}</p>
                <p><strong>Tipo:</strong> ${mobiliario.Tipo || 'N/A'}</p>
                ${buildMobiliarioCamposHtml(mobiliario)}
                ${mobiliario.geocodificado ? '<p><strong>📍 Ubicación:</strong> <em>Geocodificada desde dirección de Mallorca</em></p>' : ''}
                <hr style="margin:8px 0;border-color:#ddd;">
                <p><strong>Estado:</strong> ${getMobiliarioEstadoTexto(mobiliario)}</p>
                <p><strong>Total incidencias:</strong> ${data.total_incidencias || 0}</p>
                ${buildMobiliarioUbicacionHtml(mobiliario, 350, 200)}`;

        if (mobiliario.Operario) {
            tooltipContent += `<p><strong>Operario:</strong> ${mobiliario.Operario}</p>`;
        }
        if (mobiliario['Zona Limpieza']) {
            tooltipContent += `<p><strong>Zona Limpieza:</strong> ${mobiliario['Zona Limpieza']}</p>`;
        }

        tooltipContent += buildMobiliarioIncidenciasHtml(data);
        tooltipContent += getIncidenciasBotonesHtml(String(mobiliario['Nº Emplazamiento'] || ''), '');
        tooltipContent += '</div>';

        marker.setPopupContent(tooltipContent);
        setupPopupIncidenciaButtons(marker);
        return true;
    } catch (error) {
        console.error('Error cargando incidencias de mobiliario:', error);
        marker.setPopupContent(`
            <div style="max-width:300px;padding:10px;">
                <h4>🪑 ${mobiliario.Descripción || 'Sin descripción'}</h4>
                <p><strong>Nº Emplazamiento:</strong> ${mobiliario['Nº Emplazamiento']}</p>
                <p><strong>Estado:</strong> ${getMobiliarioEstadoTexto(mobiliario)}</p>
                <p><strong>Total incidencias:</strong> ${mobiliario.total_incidencias || 0}</p>
                <p style="color:red;"><em>Error cargando detalles de incidencias</em></p>
                ${getIncidenciasBotonesHtml(String(mobiliario['Nº Emplazamiento'] || ''), '')}
            </div>`);
        setupPopupIncidenciaButtons(marker);
        return false;
    }
}

function crearMarcadorMobiliario(mobiliario, distanciaKm) {
    if (!mobiliario.PuntoX || !mobiliario.PuntoY) return null;

    const tipoInfo = getTipoParadaInfo(mobiliario);
    const color = getMobiliarioMarkerColor(mobiliario);
    const busIcon = L.divIcon({
        className: 'custom-bus-icon',
        html: `<div style="background-color:${color};color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);position:relative;">
            <span>${tipoInfo.base}</span>
            ${tipoInfo.badge ? `<span style="position:absolute;bottom:-3px;right:-2px;font-size:9px;font-weight:800;color:#fff;text-shadow:0 0 2px rgba(0,0,0,0.9);">${tipoInfo.badge}</span>` : ''}
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const marker = L.marker([mobiliario.PuntoY, mobiliario.PuntoX], { icon: busIcon });
    marker.mobiliarioData = mobiliario;
    marker.bindPopup(buildMobiliarioPopupSimple(mobiliario, distanciaKm), { maxWidth: 420 });
    setupPopupIncidenciaButtons(marker);

    let detallesCargados = false;
    marker.on('click', async function() {
        if (detallesCargados) return;
        const ok = await cargarMobiliarioPopupDetalle(marker, mobiliario);
        if (ok) detallesCargados = true;
    });

    return marker;
}

async function loadMobiliarioData(data) {
    mobiliarioLayer = L.layerGroup();
    
    // Procesar en lotes para mejor rendimiento
    const batchSize = 100;
    const totalItems = data.datos.length;
    
    console.log(`Procesando ${totalItems} elementos de mobiliario en lotes de ${batchSize}...`);
    
    for (let i = 0; i < totalItems; i += batchSize) {
        const batch = data.datos.slice(i, i + batchSize);
        
        batch.forEach(mobiliario => {
            const marker = crearMarcadorMobiliario(mobiliario);
            if (marker) mobiliarioLayer.addLayer(marker);
        });
        
        // Mostrar progreso
        const progress = Math.min(100, Math.round(((i + batchSize) / totalItems) * 100));
        const currentItem = Math.min(i + batchSize, totalItems);
        console.log(`Progreso mobiliario: ${progress}% (${currentItem}/${totalItems})`);
        
        // Actualizar indicador visual
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = `Cargando mobiliario... ${progress}% (${currentItem}/${totalItems})`;
        }
        
        // Pequeña pausa para no bloquear la UI
        if (i + batchSize < totalItems) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    console.log('Mobiliario cargado completamente');
    mobiliarioLayer.addTo(map);
}

// Cargar datos de RecursosGis
async function loadRecursos() {
    const statusDiv = document.getElementById('status');
    const loadButton = document.getElementById('loadRecursos');
    
    try {
        statusDiv.textContent = 'Cargando recursos...';
        statusDiv.className = 'status';
        loadButton.disabled = true;
        
        // Obtener fechas si están seleccionadas
        const fechaDesde = document.getElementById('fechaDesde').value;
        const fechaHasta = document.getElementById('fechaHasta').value;
        
        // Construir URL con parámetros de fecha si existen
        let url = '/api/recursos';
        const params = new URLSearchParams();
        
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);
        
        // Añadir tipos de recurso seleccionados
        const tiposRecursoSelect = document.getElementById('tiposRecurso');
        if (tiposRecursoSelect) {
            const selectedTipos = Array.from(tiposRecursoSelect.selectedOptions)
                .map(option => option.value)
                .filter(value => value && value.trim() !== '');
            if (selectedTipos.length > 0) {
                params.append('tipos_recurso', selectedTipos.join(','));
                console.log(`📋 Filtro tipos de recurso: ${selectedTipos.join(', ')}`);
            }
        }
        
        // Añadir empresas seleccionadas
        const empresasSelect = document.getElementById('empresas');
        if (empresasSelect) {
            const selectedEmpresas = Array.from(empresasSelect.selectedOptions)
                .map(option => option.value)
                .filter(value => value && value.trim() !== '');
            if (selectedEmpresas.length > 0) {
                params.append('empresas', selectedEmpresas.join(','));
                console.log(`🏢 Filtro empresas: ${selectedEmpresas.join(', ')}`);
            }
        }
        
        // Añadir familias seleccionadas
        const familiasSelect = document.getElementById('familias');
        if (familiasSelect) {
            const selectedFamilias = Array.from(familiasSelect.selectedOptions)
                .map(option => option.value)
                .filter(value => value && value.trim() !== '');
            if (selectedFamilias.length > 0) {
                params.append('familias', selectedFamilias.join(','));
                console.log(`👨‍👩‍👧 Filtro familias: ${selectedFamilias.join(', ')}`);
            }
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        console.log(`🔗 URL de petición: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Limpiar capa de recursos anterior
        if (recursosLayer) {
            try {
                if (map.hasLayer(recursosLayer)) {
                    map.removeLayer(recursosLayer);
                    console.log('✅ Capa de recursos anterior eliminada del mapa');
                }
                // Limpiar todos los layers del grupo anterior (pero no eliminar la referencia)
                const oldLayer = recursosLayer;
                oldLayer.clearLayers();
                console.log('✅ Layers del grupo anterior limpiados');
            } catch (error) {
                console.warn('Error removiendo capa de recursos anterior:', error);
            }
        }
        
        // Mostrar datos en consola y en el mapa
        console.log('Datos de RecursosGis:', data);
        
        // Cargar datos de recursos (esta función ya añade el layer al mapa y ajusta la vista)
        await loadRecursosData(data);
        
        // Verificar que los recursos se cargaron correctamente
        const totalMarcadores = recursosLayer ? recursosLayer.getLayers().length : 0;
        console.log(`Verificación final: ${totalMarcadores} marcadores en el layer de recursos`);
        
        if (totalMarcadores > 0) {
            statusDiv.textContent = `✓ Cargados ${data.total_registros} recursos (${totalMarcadores} visibles en el mapa)`;
            statusDiv.className = 'status success';
        } else {
            statusDiv.textContent = `⚠ Cargados ${data.total_registros} recursos, pero ninguno tiene coordenadas válidas`;
            statusDiv.className = 'status error';
        }
        
    } catch (error) {
        console.error('Error al cargar recursos:', error);
        statusDiv.textContent = `✗ Error: ${error.message}`;
        statusDiv.className = 'status error';
    } finally {
        loadButton.disabled = false;
    }
}

// Cargar datos de MobiliarioGis
async function loadMobiliario() {
    const statusDiv = document.getElementById('status');
    const loadButton = document.getElementById('loadMobiliario');
    
    try {
        statusDiv.textContent = 'Cargando mobiliario...';
        statusDiv.className = 'status';
        loadButton.disabled = true;
        
        // Obtener fechas si están seleccionadas
        const fechaDesde = document.getElementById('fechaDesde').value;
        const fechaHasta = document.getElementById('fechaHasta').value;
        
        // Construir URL con parámetros de fecha si existen
        let url = '/api/mobiliario';
        const params = new URLSearchParams();
        
        if (fechaDesde) params.append('fecha_desde', fechaDesde);
        if (fechaHasta) params.append('fecha_hasta', fechaHasta);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Limpiar capa de mobiliario anterior
        if (mobiliarioLayer) {
            map.removeLayer(mobiliarioLayer);
        }
        
        // Mostrar datos en consola y en el mapa
        console.log('Datos de MobiliarioGis:', data);
        
        // Cargar datos de mobiliario
        await loadMobiliarioData(data);
        
        // Ajustar vista del mapa para mostrar todo el mobiliario
        if (data.datos.length > 0) {
            const bounds = L.latLngBounds();
            mobiliarioLayer.eachLayer(function(layer) {
                if (layer.getLatLng && typeof layer.getLatLng === 'function') {
                    bounds.extend(layer.getLatLng());
                } else if (layer.getLatLngs && typeof layer.getLatLngs === 'function') {
                    // Para círculos y otras formas
                    const latLngs = layer.getLatLngs();
                    if (Array.isArray(latLngs)) {
                        latLngs.forEach(latLng => bounds.extend(latLng));
                    } else {
                        bounds.extend(latLngs);
                    }
                }
            });
            if (bounds.isValid()) {
                map.fitBounds(bounds.pad(0.1));
            }
        }
        
        statusDiv.textContent = `✓ Cargados ${data.total_registros} elementos de mobiliario`;
        statusDiv.className = 'status success';
        
    } catch (error) {
        console.error('Error al cargar mobiliario:', error);
        statusDiv.textContent = `✗ Error: ${error.message}`;
        statusDiv.className = 'status error';
    } finally {
        loadButton.disabled = false;
    }
}

// Mostrar datos geoespaciales en el mapa
function displayGeoData(geoJsonData) {
    geoData = geoJsonData;
    
    // Crear capa de GeoJSON
    const geoJsonLayer = L.geoJSON(geoJsonData, {
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
                radius: 8,
                fillColor: '#667eea',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });
        },
        onEachFeature: function(feature, layer) {
            // Crear popup con información del elemento
            const popupContent = `
                <div>
                    <h3>${feature.properties.nombre || 'Elemento'}</h3>
                    <p><strong>ID:</strong> ${feature.properties.id}</p>
                    <p><strong>Tipo:</strong> ${feature.geometry.type}</p>
                </div>
            `;
            layer.bindPopup(popupContent);
        }
    });
    
    // Agregar la capa al mapa
    geoJsonLayer.addTo(map);
    
    // Ajustar la vista del mapa para mostrar todos los elementos
    if (geoJsonData.features.length > 0) {
        const group = new L.featureGroup(geoJsonLayer.getLayers());
        if (group.getBounds().isValid()) {
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }
    
    console.log(`Mostrando ${geoJsonData.features.length} elementos en el mapa`);
}

// Limpiar el mapa
function clearMap() {
    // Limpiar selección de recursos (pero no los datos del mapa)
    recursosSeleccionados.clear();
    recursosDataMap.clear();
    updateContadorSeleccionados();
    
    // Remover capas específicas
    if (recursosLayer) {
        try {
            map.removeLayer(recursosLayer);
        } catch (error) {
            console.warn('Error removiendo capa de recursos:', error);
        }
        recursosLayer = null;
    }
    if (mobiliarioLayer) {
        try {
            map.removeLayer(mobiliarioLayer);
        } catch (error) {
            console.warn('Error removiendo capa de mobiliario:', error);
        }
        mobiliarioLayer = null;
    }
    
    // Limpiar resultados de búsqueda
    clearSearchResults();
    
    // Remover cualquier otra capa que no sea la base (más seguro)
    const layersToRemove = [];
    map.eachLayer(function(layer) {
        // Verificar que no sea la capa base del mapa
        if (layer !== map && !layer._url) {
            layersToRemove.push(layer);
        }
    });
    
    layersToRemove.forEach(layer => {
        try {
            map.removeLayer(layer);
        } catch (error) {
            console.warn('Error removiendo capa:', error);
        }
    });
    
    geoData = [];
    console.log('Mapa limpiado');
}

// Verificar el estado de la aplicación
async function checkHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('Estado de la aplicación:', data);
    } catch (error) {
        console.error('Error al verificar el estado:', error);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Establecer fechas por defecto a hoy
    const fechaDesde = document.getElementById('fechaDesde');
    const fechaHasta = document.getElementById('fechaHasta');
    const hoy = new Date().toISOString().split('T')[0];
    
    if (fechaDesde) {
        fechaDesde.value = hoy;
    }
    if (fechaHasta) {
        fechaHasta.value = hoy;
    }
    
    // Inicializar contador de seleccionados
    updateContadorSeleccionados();
    
    // Cargar tipos de recurso y empresas al iniciar
    loadTiposRecurso();
    loadEmpresas();
    loadFamilias();
    
    // Recargar tipos, empresas y familias cuando cambien las fechas
    if (fechaDesde) {
        fechaDesde.addEventListener('change', () => {
            loadTiposRecurso();
            loadEmpresas();
            loadFamilias();
        });
    }
    if (fechaHasta) {
        fechaHasta.addEventListener('change', () => {
            loadTiposRecurso();
            loadEmpresas();
            loadFamilias();
        });
    }
    // Inicializar el mapa cuando se carga la página
    initMap();
    
    // Verificar el estado de la aplicación
    checkHealth();
    initIncidenciasAuth();
    initAddressPickerModal();
    
    // Cargar tipos de lugares disponibles
    loadPlaceTypes();
    
    // Actualizar el botón de ubicación según si hay una ubicación guardada
    updateLocationButton();
    
    // Asegurar que los botones de ubicación guardada se actualicen
    setTimeout(() => {
        updateSavedLocationButtons();
    }, 100);
    
    // Inicializar zonas personalizadas
    loadCustomZones();
    updateZoneSelector();
    
    // Event listeners para los botones principales
    document.getElementById('loadAllData').addEventListener('click', loadAllGeoData);
    document.getElementById('loadRecursos').addEventListener('click', loadRecursos);
    document.getElementById('loadMobiliario').addEventListener('click', loadMobiliario);
    document.getElementById('clearMap').addEventListener('click', clearMap);
    
    // Event listener para exportar Excel
    document.getElementById('exportarExcel').addEventListener('click', exportarRecursosExcel);
    
    // Event listeners para búsqueda
    document.getElementById('searchByPlace').addEventListener('click', searchByPlace);
    document.getElementById('searchByCoordinates').addEventListener('click', searchByCoordinates);
    document.getElementById('searchByAddress').addEventListener('click', searchByAddress);
    document.getElementById('searchByStop').addEventListener('click', searchByStop);
    document.getElementById('searchMobiliarioByPlace').addEventListener('click', searchMobiliarioByPlace);
    document.getElementById('searchMobiliarioByCoordinates').addEventListener('click', searchMobiliarioByCoordinates);
    document.getElementById('searchMobiliarioByAddress').addEventListener('click', searchMobiliarioByAddress);
    document.getElementById('searchByZone').addEventListener('click', searchByZone);
    document.getElementById('useCurrentLocation').addEventListener('click', useCurrentLocation);
    document.getElementById('cancelSearch').addEventListener('click', cancelSearch);
    
    // Event listeners para zonas personalizadas
    document.getElementById('createNewZone').addEventListener('click', openZoneModal);
    document.getElementById('editZone').addEventListener('click', editZone);
    document.getElementById('deleteZone').addEventListener('click', deleteZone);
    document.getElementById('zoneSelect').addEventListener('change', onZoneSelect);
    document.getElementById('startDrawing').addEventListener('click', function() {
        console.log('🖱️ Click en botón Iniciar Dibujo detectado');
        startZoneDrawing();
    });
    document.getElementById('finishDrawing').addEventListener('click', finishZoneDrawing);
    document.getElementById('clearDrawing').addEventListener('click', clearZoneDrawing);
    document.getElementById('saveZone').addEventListener('click', saveZone);
    document.getElementById('cancelZone').addEventListener('click', closeZoneModal);
    document.getElementById('closeZoneModal').addEventListener('click', closeZoneModal);
    
    // Event listeners para cambio de tipo de búsqueda
    document.querySelectorAll('input[name="searchType"]').forEach(radio => {
        radio.addEventListener('change', switchSearchType);
    });
    
    // Configurar búsqueda por clic en el mapa (deshabilitado para evitar conflictos)
    // setupMapClickSearch();
    
    console.log('Aplicación GIS Web App cargada correctamente');
});

// Funciones de utilidad
function showNotification(message, type = 'info') {
    console.log('🔔 Mostrando notificación...');
    console.log('📍 Mensaje:', message);
    console.log('📍 Tipo:', type);
    
    const statusDiv = document.getElementById('status');
    if (!statusDiv) {
        console.error('❌ Elemento de estado no encontrado');
        return;
    }
    
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    console.log('✅ Notificación mostrada');
    
    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
        console.log('✅ Notificación ocultada');
    }, 5000);
    
    console.log('✅ Notificación mostrada correctamente');
}

// ==================== FUNCIONES DE BÚSQUEDA ====================

// Cargar tipos de lugares disponibles
async function loadPlaceTypes() {
    console.log('📂 Cargando tipos de lugares...');
    
    try {
        const response = await fetch('/api/tipos-lugares');
        const data = await response.json();
        
        console.log('✅ Respuesta recibida:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const select = document.getElementById('placeType');
        if (!select) {
            console.error('❌ Selector de tipos de lugares no encontrado');
            return;
        }
        
        select.innerHTML = '<option value="">Seleccionar tipo...</option>';
        console.log('✅ Opciones limpiadas');
        
        Object.entries(data.tipos_lugares).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value;
            select.appendChild(option);
            console.log(`✅ Tipo agregado: ${key} - ${value}`);
        });
        
        console.log('✅ Tipos de lugares cargados correctamente');
        console.log('Tipos de lugares cargados:', data.total_tipos);
    } catch (error) {
        console.error('❌ Error cargando tipos de lugares:', error);
        showNotification('Error cargando tipos de lugares', 'error');
    }
}

// Cambiar tipo de búsqueda
function switchSearchType() {
    console.log('🔄 Cambiando tipo de búsqueda...');
    
    const searchType = document.querySelector('input[name="searchType"]:checked').value;
    console.log('📍 Tipo de búsqueda seleccionado:', searchType);
    
    // Ocultar todos los paneles
    document.querySelectorAll('.search-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    console.log('✅ Paneles ocultados');
    
    // Mostrar el panel correspondiente
    const panelId = searchType + 'Search';
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.add('active');
        console.log(`✅ Panel ${panelId} mostrado`);
    } else {
        console.error(`❌ Panel ${panelId} no encontrado`);
    }
    
    currentSearchType = searchType;
    console.log('✅ Tipo de búsqueda cambiado correctamente');
}

// Buscar recursos cerca de un tipo de lugar
async function searchByPlace() {
    console.log('🔍 Buscando recursos cerca de un tipo de lugar...');
    
    const placeType = document.getElementById('placeType').value;
    const radius = parseFloat(document.getElementById('placeRadius').value);
    
    console.log('📍 Tipo de lugar:', placeType);
    console.log('📍 Radio:', radius);
    
    if (!placeType) {
        console.log('❌ No hay tipo de lugar seleccionado');
        showNotification('Por favor selecciona un tipo de lugar', 'error');
        return;
    }
    
    if (!radius || radius <= 0 || radius > 50) {
        console.log('❌ Radio inválido');
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }
    
    console.log('✅ Validaciones pasadas, iniciando búsqueda...');
    
    // Verificar si hay ubicación guardada
    const savedLocation = getSavedLocation();
    if (savedLocation) {
        // Si hay ubicación guardada, preguntar al usuario qué quiere hacer
        // const useSaved = confirm(
        //     `¿Quieres usar tu ubicación guardada?\n\n` +
        //     `Ubicación guardada: ${savedLocation.lat.toFixed(4)}, ${savedLocation.lon.toFixed(4)}\n\n` +
        //     `• Aceptar: Usar ubicación guardada\n` +
        //     `• Cancelar: Seleccionar nueva ubicación en el mapa`
        // );
        const useSaved = savedLocation.lat.toFixed(4)!=null;
        
        if (useSaved) {
            // Usar ubicación guardada directamente
            try {
                showNotification(`Buscando ${placeType} en un radio de ${radius} km usando ubicación guardada...`, 'info');
                
                const url = addFechasToUrl(`/api/recursos-cerca-lugares?lat=${savedLocation.lat}&lon=${savedLocation.lon}&tipo_lugar=${placeType}&radio=${radius}`);
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                displaySearchResults(data, 'place', { lat: savedLocation.lat, lon: savedLocation.lon, radius });
                return;
                
            } catch (error) {
                console.error('Error en búsqueda por lugar con ubicación guardada:', error);
                showNotification(`Error: ${error.message}`, 'error');
                return;
            }
        }
    }
    
    // Si no hay ubicación guardada o el usuario eligió seleccionar nueva ubicación
    showNotification('🎯 Haz clic en el mapa para seleccionar el punto de búsqueda', 'info');
    
    // Agregar indicador visual al cursor
    map.getContainer().style.cursor = 'crosshair';
    
    // Mostrar botón cancelar
    document.getElementById('cancelSearch').style.display = 'inline-block';
    
    // Configurar listener temporal para clic en el mapa
    const clickHandler = async function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        // Remover el listener temporal y restaurar cursor
        map.off('click', clickHandler);
        map.getContainer().style.cursor = '';
        document.getElementById('cancelSearch').style.display = 'none';
        currentClickHandler = null;
        
        try {
            showNotification(`Buscando ${placeType} en un radio de ${radius} km...`, 'info');
            
            const url = addFechasToUrl(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=${placeType}&radio=${radius}`);
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            displaySearchResults(data, 'place', { lat, lon, radius });
            console.log('✅ Resultados mostrados');
            
        } catch (error) {
            console.error('❌ Error en búsqueda por lugar:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    };
    
    // Guardar referencia al handler y agregar listener temporal
    currentClickHandler = clickHandler;
    map.on('click', clickHandler);
    console.log('✅ Listener de click configurado');
    
    console.log('✅ Búsqueda por lugar configurada correctamente');
}

// Buscar recursos cerca de coordenadas específicas
async function searchByCoordinates() {
    console.log('🔍 Buscando recursos cerca de coordenadas específicas...');
    
    const lat = parseFloat(document.getElementById('coordLat').value);
    const lon = parseFloat(document.getElementById('coordLon').value);
    const radius = parseFloat(document.getElementById('coordRadius').value);
    
    console.log('📍 Coordenadas:', lat, lon);
    console.log('📍 Radio:', radius);
    
    if (isNaN(lat) || isNaN(lon)) {
        console.log('❌ Coordenadas inválidas');
        showNotification('Por favor introduce coordenadas válidas', 'error');
        return;
    }
    
    if (!radius || radius <= 0 || radius > 50) {
        console.log('❌ Radio inválido');
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }
    
    console.log('✅ Validaciones pasadas, iniciando búsqueda...');
    
    try {
        showNotification(`Buscando recursos en un radio de ${radius} km...`, 'info');
        
        const url = addFechasToUrl(`/api/recursos-cerca-coordenadas?lat=${lat}&lon=${lon}&radio=${radius}`);
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        displaySearchResults(data, 'coordinates', { lat, lon, radius });
        console.log('✅ Resultados mostrados');
        
    } catch (error) {
        console.error('❌ Error en búsqueda por coordenadas:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
    
    console.log('✅ Búsqueda por coordenadas completada');
}

// Buscar recursos cerca de una dirección
async function searchByAddress() {
    console.log('🔍 Buscando recursos cerca de una dirección...');
    
    const address = document.getElementById('addressInput').value.trim();
    const radius = parseFloat(document.getElementById('addressRadius').value);
    
    if (!address) {
        showNotification('Por favor introduce una dirección', 'error');
        return;
    }
    
    if (!radius || radius <= 0 || radius > 50) {
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }
    
    try {
        showNotification('Geocodificando dirección...', 'info');

        const geoUrl = `/api/geocodificar-direccion?direccion=${encodeURIComponent(address)}`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoResponse.ok || geoData.error) {
            throw new Error(geoData.error || 'No se pudo geocodificar la dirección');
        }

        if (geoData.multiple && geoData.resultados && geoData.resultados.length > 1) {
            showAddressPickerModal(geoData.resultados, address, radius, executeAddressSearch);
            return;
        }

        const seleccion = geoData.resultados[0];
        await executeAddressSearch(address, radius, seleccion.lat, seleccion.lon, seleccion.direccion);
    } catch (error) {
        console.error('❌ Error en búsqueda por dirección:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function executeAddressSearch(originalAddress, radius, lat, lon, formattedAddress) {
    showNotification(`Buscando recursos en un radio de ${radius} km...`, 'info');

    let url = `/api/recursos-cerca-direccion?direccion=${encodeURIComponent(originalAddress)}&radio=${radius}&lat=${lat}&lon=${lon}`;
    if (formattedAddress) {
        url += `&direccion_formateada=${encodeURIComponent(formattedAddress)}`;
    }
    url = addFechasToUrl(url);

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    displaySearchResults(data, 'address', {
        lat: data.coordenadas_encontradas.lat,
        lon: data.coordenadas_encontradas.lon,
        radius,
        address: data.direccion_formateada || formattedAddress || data.direccion_buscada
    });
}

function closeAddressPickerModal() {
    const modal = document.getElementById('addressPickerModal');
    if (modal) modal.style.display = 'none';
}

function showAddressPickerModal(resultados, originalAddress, radius, onSelect) {
    const modal = document.getElementById('addressPickerModal');
    const intro = document.getElementById('addressPickerIntro');
    const list = document.getElementById('addressPickerList');
    if (!modal || !intro || !list) return;

    const selectHandler = onSelect || executeAddressSearch;
    intro.textContent = `Se han encontrado ${resultados.length} coincidencias para «${originalAddress}». Elige la correcta:`;
    list.innerHTML = '';

    resultados.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'address-picker-item';
        btn.innerHTML = `
            <div class="address-picker-item-title">${item.direccion || 'Sin descripción'}</div>
            <div class="address-picker-item-coords">${Number(item.lat).toFixed(6)}, ${Number(item.lon).toFixed(6)}</div>
        `;
        btn.addEventListener('click', async () => {
            closeAddressPickerModal();
            try {
                await selectHandler(originalAddress, radius, item.lat, item.lon, item.direccion);
            } catch (error) {
                console.error('❌ Error tras elegir dirección:', error);
                showNotification(`Error: ${error.message}`, 'error');
            }
        });
        list.appendChild(btn);
    });

    modal.style.display = 'flex';
}

function initAddressPickerModal() {
    const closeBtn = document.getElementById('closeAddressPickerModal');
    const cancelBtn = document.getElementById('cancelAddressPicker');
    const modal = document.getElementById('addressPickerModal');

    if (closeBtn) closeBtn.addEventListener('click', closeAddressPickerModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddressPickerModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAddressPickerModal();
        });
    }
}

async function searchMobiliarioNearPoint(lat, lon, radius, searchType, extraParams = {}) {
    showNotification(`Buscando mobiliario en un radio de ${radius} km...`, 'info');

    const url = addFechasToUrl(`/api/mobiliario-cerca-coordenadas?lat=${lat}&lon=${lon}&radio=${radius}`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    displayMobiliarioSearchResults(data, searchType, { lat, lon, radius, ...extraParams });
}

async function searchMobiliarioByPlace() {
    const radius = parseFloat(document.getElementById('placeRadius').value);

    if (!radius || radius <= 0 || radius > 50) {
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }

    const savedLocation = getSavedLocation();
    if (savedLocation) {
        try {
            await searchMobiliarioNearPoint(savedLocation.lat, savedLocation.lon, radius, 'place');
        } catch (error) {
            console.error('Error en búsqueda de mobiliario por lugar:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
        return;
    }

    showNotification('🎯 Haz clic en el mapa para seleccionar el punto de búsqueda de mobiliario', 'info');
    map.getContainer().style.cursor = 'crosshair';
    document.getElementById('cancelSearch').style.display = 'inline-block';

    const clickHandler = async function(e) {
        map.off('click', clickHandler);
        map.getContainer().style.cursor = '';
        document.getElementById('cancelSearch').style.display = 'none';
        currentClickHandler = null;

        try {
            await searchMobiliarioNearPoint(e.latlng.lat, e.latlng.lng, radius, 'place');
        } catch (error) {
            console.error('Error en búsqueda de mobiliario por lugar:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    };

    currentClickHandler = clickHandler;
    map.on('click', clickHandler);
}

async function searchMobiliarioByCoordinates() {
    const lat = parseFloat(document.getElementById('coordLat').value);
    const lon = parseFloat(document.getElementById('coordLon').value);
    const radius = parseFloat(document.getElementById('coordRadius').value);

    if (isNaN(lat) || isNaN(lon)) {
        showNotification('Por favor introduce coordenadas válidas', 'error');
        return;
    }

    if (!radius || radius <= 0 || radius > 50) {
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }

    try {
        await searchMobiliarioNearPoint(lat, lon, radius, 'coordinates');
    } catch (error) {
        console.error('Error en búsqueda de mobiliario por coordenadas:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function searchMobiliarioByAddress() {
    const address = document.getElementById('addressInput').value.trim();
    const radius = parseFloat(document.getElementById('addressRadius').value);

    if (!address) {
        showNotification('Por favor introduce una dirección', 'error');
        return;
    }

    if (!radius || radius <= 0 || radius > 50) {
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }

    try {
        showNotification('Geocodificando dirección...', 'info');

        const geoUrl = `/api/geocodificar-direccion?direccion=${encodeURIComponent(address)}`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoResponse.ok || geoData.error) {
            throw new Error(geoData.error || 'No se pudo geocodificar la dirección');
        }

        if (geoData.multiple && geoData.resultados && geoData.resultados.length > 1) {
            showAddressPickerModal(geoData.resultados, address, radius, executeMobiliarioAddressSearch);
            return;
        }

        const seleccion = geoData.resultados[0];
        await executeMobiliarioAddressSearch(address, radius, seleccion.lat, seleccion.lon, seleccion.direccion);
    } catch (error) {
        console.error('Error en búsqueda de mobiliario por dirección:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

async function executeMobiliarioAddressSearch(originalAddress, radius, lat, lon, formattedAddress) {
    showNotification(`Buscando mobiliario en un radio de ${radius} km...`, 'info');

    let url = `/api/mobiliario-cerca-direccion?direccion=${encodeURIComponent(originalAddress)}&radio=${radius}&lat=${lat}&lon=${lon}`;
    if (formattedAddress) {
        url += `&direccion_formateada=${encodeURIComponent(formattedAddress)}`;
    }
    url = addFechasToUrl(url);

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    displayMobiliarioSearchResults(data, 'address', {
        lat: data.coordenadas_encontradas.lat,
        lon: data.coordenadas_encontradas.lon,
        radius,
        address: data.direccion_formateada || formattedAddress || data.direccion_buscada
    });
}

async function searchByStop() {
    const numero = document.getElementById('stopNumberInput').value.trim();

    if (!numero) {
        showNotification('Indique el número de parada', 'error');
        return;
    }

    try {
        showNotification(`Buscando parada ${numero}...`, 'info');

        const url = addFechasToUrl(`/api/parada?numero=${encodeURIComponent(numero)}`);
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || 'Parada no encontrada');
        }

        if (data.multiple && data.paradas && data.paradas.length > 1) {
            showParadaPickerModal(data.paradas, numero);
            return;
        }

        mostrarParadaEnMapa(data.paradas[0]);
    } catch (error) {
        console.error('Error buscando parada:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function showParadaPickerModal(paradas, numeroBuscado) {
    const modal = document.getElementById('addressPickerModal');
    const intro = document.getElementById('addressPickerIntro');
    const list = document.getElementById('addressPickerList');
    if (!modal || !intro || !list) return;

    intro.textContent = `Se encontraron ${paradas.length} paradas para «${numeroBuscado}». Elige una:`;
    list.innerHTML = '';

    paradas.forEach((parada) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'address-picker-item';
        const coords = (parada.PuntoY && parada.PuntoX)
            ? `${Number(parada.PuntoY).toFixed(6)}, ${Number(parada.PuntoX).toFixed(6)}`
            : 'Sin coordenadas';
        btn.innerHTML = `
            <div class="address-picker-item-title">Nº ${parada['Nº Emplazamiento']} — ${parada.Descripción || 'Sin descripción'}</div>
            <div class="address-picker-item-coords">${parada.Dirección || ''} ${coords}</div>
        `;
        btn.addEventListener('click', () => {
            closeAddressPickerModal();
            mostrarParadaEnMapa(parada);
        });
        list.appendChild(btn);
    });

    modal.style.display = 'flex';
}

function mostrarParadaEnMapa(parada) {
    if (!parada || !parada.PuntoX || !parada.PuntoY) {
        showNotification('La parada no tiene coordenadas válidas', 'error');
        return;
    }

    clearSearchResults();
    searchLayer = L.layerGroup();

    const marker = crearMarcadorMobiliario(parada);
    if (!marker) {
        showNotification('No se pudo mostrar la parada en el mapa', 'error');
        return;
    }

    searchLayer.addLayer(marker);
    searchLayer.addTo(map);
    map.setView([parada.PuntoY, parada.PuntoX], 17);
    marker.openPopup();

    showNotification(`Parada ${parada['Nº Emplazamiento']} localizada`, 'success');
}

// Usar ubicación actual
function useCurrentLocation() {
    console.log('📍 Obteniendo ubicación actual...');
    
    if (!navigator.geolocation) {
        console.log('❌ Geolocalización no soportada');
        showNotification('Geolocalización no soportada por este navegador', 'error');
        return;
    }
    
    showNotification('Obteniendo ubicación actual...', 'info');
    console.log('✅ Solicitud de ubicación enviada');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            console.log('✅ Ubicación obtenida:', lat, lon);
            
            // Guardar la ubicación en localStorage
            const locationData = {
                lat: lat,
                lon: lon,
                timestamp: Date.now()
            };
            
            console.log('💾 Guardando ubicación en localStorage:', locationData);
            localStorage.setItem('lastLocation', JSON.stringify(locationData));
            
            // Verificar que se guardó correctamente
            const saved = localStorage.getItem('lastLocation');
            console.log('✅ Verificación de guardado:', saved);
            console.log('✅ Datos parseados de verificación:', JSON.parse(saved));
            
            // Actualizar los campos de coordenadas
            const latInput = document.getElementById('coordLat');
            const lonInput = document.getElementById('coordLon');
            
            if (latInput) latInput.value = lat.toFixed(6);
            if (lonInput) lonInput.value = lon.toFixed(6);
            
            console.log('✅ Campos de coordenadas actualizados');
            document.getElementById('coordLon').value = lon.toFixed(6);
            
            // Centrar el mapa en la ubicación actual
            map.setView([lat, lon], 15);
            console.log('✅ Mapa centrado en la ubicación actual');
            
            // Actualizar el botón para mostrar que ahora hay una ubicación guardada
            updateLocationButton();
            console.log('✅ Botón de ubicación actualizado');
            
            // Actualizar también los botones de ubicación guardada
            updateSavedLocationButtons();
            console.log('✅ Botones de ubicación guardada actualizados');
            
            showNotification('Ubicación actual obtenida y guardada', 'success');
            console.log('✅ Ubicación actual obtenida y guardada correctamente');
        },
        (error) => {
            console.error('❌ Error obteniendo ubicación:', error);
            showNotification('Error obteniendo ubicación actual', 'error');
            console.log('❌ Error en geolocalización');
        }
    );
}

// Usar ubicación guardada
function useSavedLocation() {
    console.log('📍 Usando ubicación guardada...');
    
    const savedLocation = getSavedLocation();
    console.log('📍 Ubicación guardada encontrada:', savedLocation);
    
    if (!savedLocation) {
        console.log('❌ No hay ubicación guardada');
        showNotification('No hay ubicación guardada. Usa "Obtener Ubicación Actual" primero.', 'error');
        return;
    }
    
    console.log('✅ Ubicación guardada válida, actualizando campos...');
    
    // Actualizar los campos de coordenadas
    const latInput = document.getElementById('coordLat');
    const lonInput = document.getElementById('coordLon');
    
    if (latInput) latInput.value = savedLocation.lat.toFixed(6);
    if (lonInput) lonInput.value = savedLocation.lon.toFixed(6);
    
    console.log('✅ Campos de coordenadas actualizados');
    
    // Centrar el mapa en la ubicación guardada
    map.setView([savedLocation.lat, savedLocation.lon], 15);
    console.log('✅ Mapa centrado en la ubicación guardada');
    
    showNotification('Ubicación guardada restaurada', 'success');
    console.log('✅ Ubicación guardada restaurada correctamente');
}

// Obtener ubicación guardada del localStorage
function getSavedLocation() {
    try {
        console.log('🔍 Buscando ubicación guardada en localStorage...');
        const saved = localStorage.getItem('lastLocation');
        console.log('📦 Datos raw del localStorage:', saved);
        
        if (!saved) {
            console.log('❌ No hay datos en localStorage con clave "lastLocation"');
            return null;
        }
        
        const locationData = JSON.parse(saved);
        console.log('📊 Datos parseados:', locationData);
        
        // Verificar que la ubicación no sea muy antigua (24 horas)
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
        const now = Date.now();
        const age = now - locationData.timestamp;
        
        console.log('⏰ Verificando edad de la ubicación:');
        console.log('  - Timestamp actual:', now);
        console.log('  - Timestamp guardado:', locationData.timestamp);
        console.log('  - Edad en ms:', age);
        console.log('  - Edad en horas:', age / (1000 * 60 * 60));
        console.log('  - Máxima edad permitida (24h):', maxAge);
        
        if (age > maxAge) {
            console.log('⏰ Ubicación demasiado antigua, eliminando...');
            localStorage.removeItem('lastLocation');
            return null;
        }
        
        console.log('✅ Ubicación guardada válida:', locationData);
        return locationData;
    } catch (error) {
        console.error('❌ Error leyendo ubicación guardada:', error);
        console.error('📦 Datos que causaron el error:', saved);
        return null;
    }
}

// Actualizar el botón de ubicación según si hay una ubicación guardada
function updateLocationButton() {
    console.log('🔄 Actualizando botón de ubicación...');
    
    const button = document.getElementById('useCurrentLocation');
    const statusDiv = document.getElementById('locationStatus');
    const statusText = document.getElementById('locationStatusText');
    const savedLocation = getSavedLocation();
    
    console.log('📍 Ubicación guardada:', savedLocation);
    console.log('📍 Botón de ubicación guardada:', savedLocationbutton);
    
    if (savedLocationbutton==true) {
        savedLocation=null;
        console.log('✅ Ubicación guardada reseteada por botón');
    }
    
    if (savedLocation) {
        button.textContent = '📍 Borrar Ubicación Guardada';
        button.title = `Ubicación guardada: ${savedLocation.lat.toFixed(4)}, ${savedLocation.lon.toFixed(4)}`;
        button.onclick = useSavedLocation;
        savedLocationbutton = true;
        console.log('✅ Botón configurado para borrar ubicación guardada');
        
        // Mostrar indicador de ubicación guardada
        if (statusDiv && statusText) {
            statusText.textContent = `📍 Ubicación guardada: ${savedLocation.lat.toFixed(4)}, ${savedLocation.lon.toFixed(4)}`;
            statusDiv.style.display = 'block';
            console.log('✅ Indicador de ubicación guardada mostrado');
        }
    } else {
        button.textContent = '📍 Obtener Ubicación Actual';
        button.title = 'Obtener tu ubicación actual usando GPS';
        button.onclick = useCurrentLocation;
        savedLocationbutton = false;
        // Ocultar indicador de ubicación guardada
        if (statusDiv) {
            statusDiv.style.display = 'none';
            console.log('✅ Indicador de ubicación guardada ocultado');
        }
    }
    
    // Actualizar botones de ubicación guardada en todos los paneles
    updateSavedLocationButtons();
    console.log('✅ Botón de ubicación actualizado correctamente');
}

// Actualizar botones de ubicación guardada en todos los paneles
function updateSavedLocationButtons() {
    const savedLocation = getSavedLocation();
    const buttons = [
        'useSavedLocationPlace',
        'useSavedLocationAddress',
        'useSavedLocationZone'
    ];
    
    console.log('🔄 Actualizando botones de ubicación guardada...');
    console.log('📍 Ubicación guardada:', savedLocation);
    console.log('📍 Botones a actualizar:', buttons);
    
    buttons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        console.log(`🔍 Botón ${buttonId}:`, button);
        
        if (button) {
            // Limpiar estilos anteriores
            button.style.display = '';
            button.style.opacity = '';
            button.style.pointerEvents = '';
            console.log('✅ Estilos anteriores limpiados');
            
            if (savedLocation) {
                // Botón habilitado
                button.style.display = 'inline-block';
                button.style.opacity = '1';
                button.style.pointerEvents = 'auto';
                button.title = `Ubicación guardada: ${savedLocation.lat.toFixed(4)}, ${savedLocation.lon.toFixed(4)}`;
                button.onclick = () => useSavedLocationForSearch();
                console.log(`✅ Botón ${buttonId} HABILITADO`);
            } else {
                // Botón deshabilitado
                button.style.display = 'inline-block';
                button.style.opacity = '0.5';
                button.style.pointerEvents = 'none';
                button.title = 'No hay ubicación guardada. Usa "Obtener Ubicación Actual" primero.';
                button.onclick = null;
                console.log(`❌ Botón ${buttonId} DESHABILITADO`);
            }
        } else {
            console.warn(`⚠️ Botón ${buttonId} no encontrado en el DOM`);
        }
    });
    
    console.log('✅ Botones de ubicación guardada actualizados correctamente');
}

// Usar ubicación guardada para búsqueda (funciona con cualquier tipo de búsqueda)
function useSavedLocationForSearch() {
    console.log('🔍 useSavedLocationForSearch() llamada');
    const savedLocation = getSavedLocation();
    console.log('📍 Ubicación guardada encontrada:', savedLocation);
    
    if (!savedLocation) {
        console.log('❌ No hay ubicación guardada, mostrando error');
        showNotification('No hay ubicación guardada. Usa "Obtener Ubicación Actual" primero.', 'error');
        return;
    }
    
    console.log('✅ Procediendo con búsqueda usando ubicación guardada');
    
    // Obtener el tipo de búsqueda actual
    const searchType = document.querySelector('input[name="searchType"]:checked').value;
    console.log('📍 Tipo de búsqueda actual:', searchType);
    
    if (searchType === 'place') {
        // Para búsqueda por lugar, mostrar notificación para hacer clic en el mapa
        showNotification('🎯 Haz clic en el mapa para seleccionar el punto de búsqueda', 'info');
        
        // Configurar listener temporal para clic en el mapa
        const clickHandler = async function(e) {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;
            
            // Remover el listener temporal y restaurar cursor
            map.off('click', clickHandler);
            map.getContainer().style.cursor = '';
            document.getElementById('cancelSearch').style.display = 'none';
            currentClickHandler = null;
            
            // Realizar la búsqueda
            await performPlaceSearch(lat, lon);
        };
        
        // Mostrar botón cancelar
        document.getElementById('cancelSearch').style.display = 'inline-block';
        
        // Agregar indicador visual al cursor
        map.getContainer().style.cursor = 'crosshair';
        
        // Guardar referencia al handler y agregar listener temporal
        currentClickHandler = clickHandler;
        map.on('click', clickHandler);
        
    } else if (searchType === 'coordinates') {
        // Para búsqueda por coordenadas, llenar los campos
        document.getElementById('coordLat').value = savedLocation.lat.toFixed(6);
        document.getElementById('coordLon').value = savedLocation.lon.toFixed(6);
        showNotification('Ubicación guardada restaurada en coordenadas', 'success');
        
    } else if (searchType === 'address') {
        // Para búsqueda por dirección, usar las coordenadas como dirección
        useLocationAsAddress(savedLocation.lat, savedLocation.lon);
    }
}

// Realizar búsqueda por lugar con coordenadas específicas
async function performPlaceSearch(lat, lon) {
    const placeType = document.getElementById('placeType').value;
    const radius = parseFloat(document.getElementById('placeRadius').value);
    
    if (!placeType) {
        showNotification('Por favor selecciona un tipo de lugar', 'error');
        return;
    }
    
    if (!radius || radius <= 0 || radius > 50) {
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }
    
    try {
        showNotification(`Buscando ${placeType} en un radio de ${radius} km...`, 'info');
        
        const url = addFechasToUrl(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=${placeType}&radio=${radius}`);
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        displaySearchResults(data, 'place', { lat, lon, radius });
        
    } catch (error) {
        console.error('Error en búsqueda por lugar:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Usar ubicación guardada como dirección
function useLocationAsAddress(lat, lon) {
    // Usar las coordenadas como dirección
    document.getElementById('addressInput').value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    showNotification('Ubicación guardada restaurada como dirección', 'success');
}

// Seleccionar coordenadas desde el mapa
function selectCoordinatesFromMap() {
    // Cambiar cursor a crosshair
    map.getContainer().style.cursor = 'crosshair';
    
    // Mostrar notificación
    showNotification('Haz clic en el mapa para seleccionar las coordenadas', 'info');
    
    // Crear botón de cancelar
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar Selección';
    cancelButton.className = 'btn btn-danger btn-sm';
    cancelButton.style.marginLeft = '10px';
    cancelButton.onclick = function() {
        cancelCoordinateSelection();
    };
    
    // Agregar botón al panel de coordenadas
    const coordPanel = document.getElementById('coordinatesSearch');
    const existingCancel = coordPanel.querySelector('.cancel-coord-btn');
    if (existingCancel) {
        existingCancel.remove();
    }
    cancelButton.className += ' cancel-coord-btn';
    coordPanel.appendChild(cancelButton);
    
    // Crear manejador de clic temporal
    const clickHandler = function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        // Llenar los campos
        document.getElementById('coordLat').value = lat.toFixed(6);
        document.getElementById('coordLon').value = lon.toFixed(6);
        
        // Mostrar notificación
        showNotification(`Coordenadas seleccionadas: ${lat.toFixed(6)}, ${lon.toFixed(6)}`, 'success');
        
        // Limpiar
        cancelCoordinateSelection();
    };
    
    // Guardar referencia para poder cancelar
    currentClickHandler = clickHandler;
    
    // Agregar manejador de clic
    map.on('click', clickHandler);
}

// Cancelar selección de coordenadas
function cancelCoordinateSelection() {
    // Restaurar cursor
    map.getContainer().style.cursor = '';
    
    // Remover manejador de clic
    if (currentClickHandler) {
        map.off('click', currentClickHandler);
        currentClickHandler = null;
    }
    
    // Remover botón de cancelar
    const cancelButton = document.querySelector('.cancel-coord-btn');
    if (cancelButton) {
        cancelButton.remove();
    }
    
    showNotification('Selección de coordenadas cancelada', 'info');
}

// Limpiar coordenadas
function clearCoordinates() {
    document.getElementById('coordLat').value = '';
    document.getElementById('coordLon').value = '';
    
    // También limpiar la ubicación guardada
    localStorage.removeItem('lastLocation');
    updateLocationButton();
    
    showNotification('Coordenadas limpiadas', 'info');
}

// Mostrar resultados de búsqueda en el mapa
function displaySearchResults(data, searchType, searchParams) {
    console.log('📊 Mostrando resultados de búsqueda...');
    console.log('📍 Resultados encontrados:', data.length);
    console.log('📍 Tipo de búsqueda:', searchType);
    console.log('📍 Parámetros de búsqueda:', searchParams);
    
    // Limpiar búsquedas anteriores
    clearSearchResults();
    console.log('✅ Búsquedas anteriores limpiadas');
    
    currentSearchData = data;
    currentSearchType = searchType;
    console.log('✅ Datos de búsqueda actualizados');
    
    // Crear capas para los resultados
    searchLayer = L.layerGroup();
    placesLayer = L.layerGroup();
    console.log('✅ Capas de resultados creadas');
    
    const { lat, lon, radius } = searchParams;
    console.log('📍 Coordenadas de búsqueda:', lat, lon);
    console.log('📍 Radio:', radius);
    
    // Agregar marcador del punto de búsqueda
    const searchIcon = L.divIcon({
        className: 'search-marker',
        html: '🎯',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    const searchMarker = L.marker([lat, lon], { icon: searchIcon });
    searchMarker.bindPopup(`
        <div style="text-align: center;">
            <h4>🎯 Punto de Búsqueda</h4>
            <p><strong>Tipo:</strong> ${searchType === 'place' ? 'Lugar' : searchType === 'coordinates' ? 'Coordenadas' : 'Dirección'}</p>
            <p><strong>Coordenadas:</strong> ${lat.toFixed(6)}, ${lon.toFixed(6)}</p>
            <p><strong>Radio:</strong> ${radius} km</p>
            ${searchParams.address ? `<p><strong>Dirección:</strong> ${searchParams.address}</p>` : ''}
        </div>
    `);
    searchLayer.addLayer(searchMarker);
    
    // Agregar círculo de radio
    radiusCircle = L.circle([lat, lon], {
        radius: radius * 1000, // Convertir km a metros
        color: '#ff5722',
        weight: 2,
        dashArray: '5, 5',
        opacity: 0.7,
        fillOpacity: 0.1,
        fillColor: '#ff5722'
    });
    searchLayer.addLayer(radiusCircle);
    
    // Mostrar lugares encontrados (si los hay)
    if (data.lugares && data.lugares.length > 0) {
        data.lugares.forEach(lugar => {
            const placeIcon = L.divIcon({
                className: 'place-marker',
                html: '📍',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            const placeMarker = L.marker([lugar.lat, lugar.lon], { icon: placeIcon });
            placeMarker.bindPopup(`
                <div>
                    <h4>📍 ${lugar.nombre}</h4>
                    <p><strong>Tipo:</strong> ${data.descripcion || lugar.tipo}</p>
                    <p><strong>Dirección:</strong> ${lugar.vicinity || 'No disponible'}</p>
                    <p><strong>Rating:</strong> ${lugar.rating || 'N/A'}</p>
                    <p><strong>Distancia:</strong> ${lugar.distancia_km.toFixed(2)} km</p>
                </div>
            `);
            placesLayer.addLayer(placeMarker);
        });
    }
    
    // Mostrar recursos encontrados
    if (data.recursos && data.recursos.length > 0) {
        data.recursos.forEach(recurso => {
            // Usar el mismo estilo que los recursos normales
            let color = '#44ff44'; // Verde por defecto
            if (recurso.tiene_incidencia && recurso.total_incidencias > 0) {
                color = '#ff4444'; // Rojo si tiene incidencias
            } else if (recurso.total_campanas > 0) {
                color = '#ff8800'; // Naranja si tiene campañas
            }
            
            const marker = L.circleMarker([recurso.PuntoY, recurso.PuntoX], {
                radius: 10, // Un poco más grande para destacar
                fillColor: color,
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8
            });
            
            // Usar función común para crear el popup
            crearPopupRecurso(marker, recurso);
            
            searchLayer.addLayer(marker);
        });
    }
    
    // Actualizar contador de seleccionados después de añadir recursos de búsqueda
    updateContadorSeleccionados();
    
    // Agregar capas al mapa
    searchLayer.addTo(map);
    if (placesLayer.getLayers().length > 0) {
        placesLayer.addTo(map);
    }
    
    // Ajustar vista del mapa para mostrar todos los resultados
    const allLayers = [];
    
    // Agregar capas de búsqueda si existen
    if (searchLayer && searchLayer.getLayers) {
        allLayers.push(searchLayer);
    }
    if (placesLayer && placesLayer.getLayers) {
        allLayers.push(placesLayer);
    }
    
    if (allLayers.length > 0) {
        const group = new L.featureGroup(allLayers);
        if (group.getLayers().length > 0) {
            try {
                const bounds = group.getBounds();
                if (bounds && bounds.isValid && bounds.isValid()) {
                    map.fitBounds(bounds.pad(0.1));
                }
            } catch (error) {
                console.warn('Error ajustando vista del mapa:', error);
                // Si hay error, centrar en el punto de búsqueda
                map.setView([lat, lon], 13);
            }
        }
    } else {
        // Si no hay capas, centrar en el punto de búsqueda
        map.setView([lat, lon], 13);
    }
    
    // Mostrar resumen
    const lugaresCount = data.lugares ? data.lugares.length : 0;
    const recursosCount = data.recursos ? data.recursos.length : 0;
    
    console.log('📊 Resumen de búsqueda:');
    console.log('  - Lugares:', lugaresCount);
    console.log('  - Recursos:', recursosCount);
    
    showNotification(
        `✓ Búsqueda completada: ${lugaresCount} lugares, ${recursosCount} recursos encontrados`,
        'success'
    );
    console.log('✅ Resumen mostrado');
    
    console.log('✅ Resultados de búsqueda mostrados correctamente');
}

function displayMobiliarioSearchResults(data, searchType, searchParams) {
    clearSearchResults();

    currentSearchData = data;
    currentSearchType = `mobiliario_${searchType}`;
    searchLayer = L.layerGroup();

    const { lat, lon, radius } = searchParams;

    const searchIcon = L.divIcon({
        className: 'search-marker',
        html: '🎯',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    const tipoLabel = searchType === 'place' ? 'Lugar' : searchType === 'coordinates' ? 'Coordenadas' : 'Dirección';
    const searchMarker = L.marker([lat, lon], { icon: searchIcon });
    searchMarker.bindPopup(`
        <div style="text-align: center;">
            <h4>🎯 Punto de Búsqueda (Mobiliario)</h4>
            <p><strong>Tipo:</strong> ${tipoLabel}</p>
            <p><strong>Coordenadas:</strong> ${lat.toFixed(6)}, ${lon.toFixed(6)}</p>
            <p><strong>Radio:</strong> ${radius} km</p>
            ${searchParams.address ? `<p><strong>Dirección:</strong> ${searchParams.address}</p>` : ''}
        </div>
    `);
    searchLayer.addLayer(searchMarker);

    radiusCircle = L.circle([lat, lon], {
        radius: radius * 1000,
        color: '#2196f3',
        weight: 2,
        dashArray: '5, 5',
        opacity: 0.7,
        fillOpacity: 0.1,
        fillColor: '#2196f3'
    });
    searchLayer.addLayer(radiusCircle);

    const mobiliario = data.mobiliario || [];
    mobiliario.forEach((item) => {
        const marker = crearMarcadorMobiliario(item, item.distancia_km);
        if (marker) searchLayer.addLayer(marker);
    });

    searchLayer.addTo(map);

    if (searchLayer.getLayers().length > 0) {
        try {
            const bounds = searchLayer.getBounds();
            if (bounds && bounds.isValid && bounds.isValid()) {
                map.fitBounds(bounds.pad(0.1));
            }
        } catch (error) {
            console.warn('Error ajustando vista del mapa:', error);
            map.setView([lat, lon], 13);
        }
    } else {
        map.setView([lat, lon], 13);
    }

    showNotification(
        `✓ Mobiliario: ${mobiliario.length} parada(s) encontrada(s) en ${radius} km`,
        'success'
    );
}

// Limpiar resultados de búsqueda
function clearSearchResults() {
    console.log('🗑️ Limpiando resultados de búsqueda...');
    
    if (searchLayer) {
        try {
            map.removeLayer(searchLayer);
            console.log('✅ Capa de búsqueda limpiada');
        } catch (error) {
            console.warn('⚠️ Error removiendo capa de búsqueda:', error);
        }
        searchLayer = null;
    }
    if (placesLayer) {
        try {
            map.removeLayer(placesLayer);
            console.log('✅ Capa de lugares limpiada');
        } catch (error) {
            console.warn('⚠️ Error removiendo capa de lugares:', error);
        }
        placesLayer = null;
    }
    if (radiusCircle) {
        try {
            map.removeLayer(radiusCircle);
            console.log('✅ Círculo de radio limpiado');
        } catch (error) {
            console.warn('Error removiendo círculo de radio:', error);
        }
        radiusCircle = null;
    }
    currentSearchData = null;
    currentSearchType = null;
    
    console.log('✅ Resultados de búsqueda limpiados completamente');
}

// Cancelar búsqueda por clic
function cancelSearch() {
    if (currentClickHandler) {
        map.off('click', currentClickHandler);
        currentClickHandler = null;
    }
    
    // Restaurar estado normal
    map.getContainer().style.cursor = '';
    document.getElementById('cancelSearch').style.display = 'none';
    showNotification('Búsqueda cancelada', 'info');
}

// Búsqueda por clic en el mapa
function setupMapClickSearch() {
    map.on('click', async function(e) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        // Preguntar al usuario qué tipo de búsqueda quiere hacer
        const searchType = prompt(
            '¿Qué tipo de búsqueda quieres hacer?\n\n' +
            '1 - Buscar recursos cerca de este punto\n' +
            '2 - Buscar recursos cerca de hospitales en esta zona\n' +
            '3 - Buscar recursos cerca de farmacias en esta zona\n' +
            '4 - Buscar recursos cerca de gasolineras en esta zona\n' +
            '5 - Cancelar\n\n' +
            'Introduce el número (1-5):'
        );
        
        if (!searchType || searchType === '5') {
            return;
        }
        
        const radius = prompt('Introduce el radio de búsqueda en km (entre 0.1 y 50, por defecto 5):', '5');
        const searchRadius = parseFloat(radius);
        
        if (isNaN(searchRadius) || searchRadius <= 0 || searchRadius > 50) {
            showNotification('Radio no válido. Debe estar entre 0.1 y 50 km', 'error');
            return;
        }
        
        try {
            showNotification(`Realizando búsqueda en un radio de ${searchRadius} km...`, 'info');
            
            let response;
            let data;
            
            switch (searchType) {
                case '1':
                    // Búsqueda por coordenadas
                    response = await fetch(addFechasToUrl(`/api/recursos-cerca-coordenadas?lat=${lat}&lon=${lon}&radio=${searchRadius}`));
                    data = await response.json();
                    displaySearchResults(data, 'coordinates', { lat, lon, radius: searchRadius });
                    break;
                    
                case '2':
                    // Búsqueda por hospitales
                    response = await fetch(addFechasToUrl(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=hospital&radio=${searchRadius}`));
                    data = await response.json();
                    displaySearchResults(data, 'place', { lat, lon, radius: searchRadius });
                    break;
                    
                case '3':
                    // Búsqueda por farmacias
                    response = await fetch(addFechasToUrl(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=pharmacy&radio=${searchRadius}`));
                    data = await response.json();
                    displaySearchResults(data, 'place', { lat, lon, radius: searchRadius });
                    break;
                    
                case '4':
                    // Búsqueda por gasolineras
                    response = await fetch(addFechasToUrl(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=gas_station&radio=${searchRadius}`));
                    data = await response.json();
                    displaySearchResults(data, 'place', { lat, lon, radius: searchRadius });
                    break;
                    
                default:
                    showNotification('Opción no válida', 'error');
                    return;
            }
            
            if (data.error) {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('Error en búsqueda por clic:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    });
}

// Función de depuración para verificar el estado del localStorage
function debugLocationStorage() {
    console.log('🔍 === DEBUG: Estado del localStorage ===');
    console.log('📦 Clave "lastLocation":', localStorage.getItem('lastLocation'));
    console.log('📊 Función getSavedLocation():', getSavedLocation());
    console.log('🔧 Todos los elementos del localStorage:');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        console.log(`  - ${key}:`, localStorage.getItem(key));
    }
    console.log('=== FIN DEBUG ===');
}

// Función de prueba para simular una ubicación guardada
function testSavedLocation() {
    console.log('🧪 === PRUEBA: Simulando ubicación guardada ===');
    
    // Simular una ubicación guardada
    const testLocation = {
        lat: 39.5696,
        lon: 2.6502,
        timestamp: Date.now()
    };
    
    console.log('💾 Guardando ubicación de prueba:', testLocation);
    localStorage.setItem('lastLocation', JSON.stringify(testLocation));
    
    // Verificar que se guardó
    const saved = localStorage.getItem('lastLocation');
    console.log('✅ Verificación de guardado:', saved);
    
    // Actualizar los botones
    console.log('🔄 Actualizando botones...');
    updateSavedLocationButtons();
    
    // Probar la función getSavedLocation
    const retrieved = getSavedLocation();
    console.log('📍 Ubicación recuperada:', retrieved);
    
    console.log('=== FIN PRUEBA ===');
}

// ==================== FUNCIONES DE ZONAS PERSONALIZADAS ====================

// Cargar zonas personalizadas desde localStorage
function loadCustomZones() {
    try {
        const saved = localStorage.getItem('customZones');
        if (saved) {
            customZones = JSON.parse(saved);
            console.log('📍 Zonas personalizadas cargadas:', customZones.length);
        } else {
            customZones = [];
            console.log('📍 No hay zonas personalizadas guardadas');
        }
    } catch (error) {
        console.error('❌ Error cargando zonas personalizadas:', error);
        customZones = [];
    }
}

// Guardar zonas personalizadas en localStorage
function saveCustomZones() {
    try {
        localStorage.setItem('customZones', JSON.stringify(customZones));
        console.log('💾 Zonas personalizadas guardadas:', customZones.length);
    } catch (error) {
        console.error('❌ Error guardando zonas personalizadas:', error);
    }
}

// Actualizar el selector de zonas
function updateZoneSelector() {
    console.log('🔄 Actualizando selector de zonas...');
    console.log('📍 Zonas disponibles:', customZones.length);
    
    const select = document.getElementById('zoneSelect');
    if (!select) {
        console.error('❌ Selector de zonas no encontrado');
        return;
    }
    
    // Limpiar opciones existentes
    select.innerHTML = '<option value="">Seleccionar zona...</option>';
    console.log('✅ Opciones limpiadas');
    
    // Agregar zonas
    customZones.forEach((zone, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = zone.name;
        select.appendChild(option);
        console.log(`✅ Zona agregada: ${zone.name} (índice: ${index})`);
    });
    
    // Actualizar botones de edición/eliminación
    updateZoneButtons();
    console.log('✅ Selector actualizado correctamente');
}

// Actualizar botones de edición/eliminación de zonas
function updateZoneButtons() {
    const editBtn = document.getElementById('editZone');
    const deleteBtn = document.getElementById('deleteZone');
    const select = document.getElementById('zoneSelect');
    
    if (editBtn && deleteBtn && select) {
        const hasSelection = select.value !== '';
        editBtn.disabled = !hasSelection;
        deleteBtn.disabled = !hasSelection;
    }
}

// Abrir modal para crear/editar zona
function openZoneModal() {
    console.log('📋 Abriendo modal de zona...');
    
    const modal = document.getElementById('zoneModal');
    const title = document.getElementById('zoneModalTitle');
    const nameInput = document.getElementById('zoneName');
    const descInput = document.getElementById('zoneDescription');
    
    console.log('🔍 Elementos del modal:');
    console.log('  - modal:', modal);
    console.log('  - title:', title);
    console.log('  - nameInput:', nameInput);
    console.log('  - descInput:', descInput);
    
    if (modal && title && nameInput && descInput) {
        currentZone = null;
        title.textContent = 'Crear Nueva Zona';
        nameInput.value = '';
        descInput.value = '';
        
        console.log('✅ Modal configurado correctamente');
        
        // Solo limpiar dibujo si no hay puntos dibujados
        if (zonePoints.length === 0) {
            clearZoneDrawing();
            console.log('✅ Dibujo anterior limpiado (no había puntos)');
        } else {
            console.log('✅ Manteniendo puntos dibujados:', zonePoints.length);
        }
        
        modal.style.display = 'flex';
    }
}

// Cerrar modal de zona
function closeZoneModal() {
    console.log('❌ Cerrando modal de zona...');
    
    const modal = document.getElementById('zoneModal');
    if (modal) {
        modal.style.display = 'none';
        console.log('✅ Modal ocultado');
        
        clearZoneDrawing();
        console.log('✅ Dibujo limpiado');
        
        currentZone = null;
        console.log('✅ Zona actual reseteada');
    } else {
        console.error('❌ Modal de zona no encontrado');
    }
    
    console.log('✅ Modal cerrado correctamente');
}

// Editar zona seleccionada
function editZone() {
    console.log('✏️ Editando zona...');
    
    const select = document.getElementById('zoneSelect');
    if (!select || select.value === '') {
        console.log('⚠️ No hay zona seleccionada para editar');
        return;
    }
    
    const zoneIndex = parseInt(select.value);
    const zone = customZones[zoneIndex];
    
    console.log('📍 Zona a editar:', zone);
    console.log('📍 Índice:', zoneIndex);
    
    if (zone) {
        currentZone = zoneIndex;
        console.log('✅ Zona actual establecida');
        
        const modal = document.getElementById('zoneModal');
        const title = document.getElementById('zoneModalTitle');
        const nameInput = document.getElementById('zoneName');
        const descInput = document.getElementById('zoneDescription');
        
        console.log('🔍 Elementos del modal:');
        console.log('  - modal:', modal);
        console.log('  - title:', title);
        console.log('  - nameInput:', nameInput);
        console.log('  - descInput:', descInput);
        
        if (modal && title && nameInput && descInput) {
            title.textContent = 'Editar Zona';
            nameInput.value = zone.name;
            descInput.value = zone.description || '';
            
            console.log('✅ Modal configurado para edición');
            
            // Mostrar la zona en el mapa
            showZoneOnMap(zone);
            console.log('✅ Zona mostrada en el mapa');
            
            modal.style.display = 'flex';
            console.log('✅ Modal mostrado');
        } else {
            console.error('❌ No se encontraron todos los elementos del modal');
        }
    } else {
        console.error('❌ Zona no encontrada');
    }
    
    console.log('✅ Edición de zona iniciada');
}

// Eliminar zona seleccionada
function deleteZone() {
    console.log('🗑️ Eliminando zona...');
    
    const select = document.getElementById('zoneSelect');
    if (!select || select.value === '') {
        console.log('⚠️ No hay zona seleccionada para eliminar');
        return;
    }
    
    const zoneIndex = parseInt(select.value);
    const zone = customZones[zoneIndex];
    
    console.log('📍 Zona a eliminar:', zone);
    console.log('📍 Índice:', zoneIndex);
    
    if (zone && confirm(`¿Estás seguro de que quieres eliminar la zona "${zone.name}"?`)) {
        console.log('✅ Confirmación recibida, eliminando zona...');
        
        customZones.splice(zoneIndex, 1);
        console.log('✅ Zona eliminada de la lista');
        
        saveCustomZones();
        console.log('✅ Zona eliminada de localStorage');
        
        updateZoneSelector();
        console.log('✅ Selector actualizado');
        
        removeZoneFromMap(zone);
        console.log('✅ Zona removida del mapa');
        
        showNotification(`Zona "${zone.name}" eliminada`, 'success');
        console.log('✅ Zona eliminada correctamente');
    } else {
        console.log('⚠️ Eliminación cancelada por el usuario');
    }
}

// Manejar selección de zona
function onZoneSelect() {
    console.log('🎯 Seleccionando zona...');
    
    updateZoneButtons();
    console.log('✅ Botones actualizados');
    
    const select = document.getElementById('zoneSelect');
    if (select && select.value !== '') {
        const zoneIndex = parseInt(select.value);
        const zone = customZones[zoneIndex];
        
        console.log('📍 Zona seleccionada:', zone);
        console.log('📍 Índice:', zoneIndex);
        
        if (zone) {
            showZoneOnMap(zone);
            console.log('✅ Zona mostrada en el mapa');
        } else {
            console.error('❌ Zona no encontrada');
        }
    } else {
        console.log('⚠️ No hay zona seleccionada, limpiando mapa');
        clearZoneFromMap();
    }
}

// Iniciar dibujo de zona
function startZoneDrawing() {
    console.log('🎨 Iniciando dibujo de zona...');
    
    if (isDrawingZone) {
        console.log('⚠️ Ya se está dibujando una zona');
        return;
    }
    
    // Verificar que el mapa esté disponible
    if (!map) {
        console.error('❌ Mapa no disponible');
        showNotification('Error: Mapa no disponible', 'error');
        return;
    }
    
    isDrawingZone = true;
    zonePoints = [];
    
    console.log('✅ Estado de dibujo activado');
    
    // Actualizar botones
    const startBtn = document.getElementById('startDrawing');
    const finishBtn = document.getElementById('finishDrawing');
    const clearBtn = document.getElementById('clearDrawing');
    
    console.log('🔍 Botones encontrados:');
    console.log('  - startBtn:', startBtn);
    console.log('  - finishBtn:', finishBtn);
    console.log('  - clearBtn:', clearBtn);
    
    if (startBtn) {
        startBtn.disabled = true;
        console.log('✅ Botón Iniciar deshabilitado');
    }
    if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.style.display = 'inline-block';
        console.log('✅ Botón Finalizar habilitado y visible');
    }
    if (clearBtn) {
        clearBtn.disabled = false;
        clearBtn.style.display = 'inline-block';
        console.log('✅ Botón Limpiar habilitado y visible');
    }
    
    console.log('✅ Botones actualizados');
    
    // Cambiar cursor
    map.getContainer().style.cursor = 'crosshair';
    console.log('✅ Cursor cambiado a crosshair');
    
    // Cerrar el modal para permitir clicks en el mapa (sin limpiar el dibujo)
    const modal = document.getElementById('zoneModal');
    if (modal) {
        modal.style.display = 'none';
        console.log('✅ Modal cerrado para permitir dibujo');
    }
    
    // Mostrar notificación con instrucciones
    showNotification('Modal cerrado. Haz clic en el mapa para dibujar la zona. Doble clic para finalizar. Usa "Crear Nueva Zona" para volver al modal.', 'info');
    
    // Mostrar botones de control en la interfaz principal
    showDrawingControls();
    
    // Configurar listener de clic
    const clickHandler = (e) => {
        console.log('🖱️ Click detectado en el mapa');
        console.log('📍 Evento:', e);
        console.log('📍 LatLng:', e.latlng);
        console.log('📍 isDrawingZone:', isDrawingZone);
        
        if (!isDrawingZone) {
            console.log('⚠️ Dibujo no activo, ignorando click');
            return;
        }
        
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        console.log(`📍 Agregando punto: ${lat}, ${lon}`);
        zonePoints.push([lat, lon]);
        updateZoneDrawing();
        
        console.log(`✅ Punto agregado. Total puntos: ${zonePoints.length}`);
    };
    
    const dblClickHandler = (e) => {
        console.log('🖱️ Doble click detectado en el mapa');
        console.log('📍 isDrawingZone:', isDrawingZone);
        if (!isDrawingZone) {
            console.log('⚠️ Dibujo no activo, ignorando doble click');
            return;
        }
        console.log('✅ Finalizando dibujo por doble click');
        finishZoneDrawing();
    };
    
    // Remover listeners anteriores si existen
    if (currentClickHandler) {
        map.off('click', currentClickHandler);
    }
    if (map._zoneDblClickHandler) {
        map.off('dblclick', map._zoneDblClickHandler);
    }
    
    // Verificar que el mapa esté listo
    if (!map || !map.getContainer()) {
        console.error('❌ Mapa no está listo para recibir eventos');
        showNotification('Error: Mapa no está listo', 'error');
        return;
    }
    
    // Agregar nuevos listeners
    map.on('click', clickHandler);
    map.on('dblclick', dblClickHandler);
    
    console.log('✅ Listeners de click configurados');
    console.log('📍 Mapa container:', map.getContainer());
    console.log('📍 Mapa ready:', map._loaded);
    
    // Guardar handlers para poder removerlos
    currentClickHandler = clickHandler;
    map._zoneDblClickHandler = dblClickHandler;
    
    console.log('🎨 Dibujo de zona iniciado correctamente');
    
    // Test directo del mapa
    console.log('🧪 Probando click directo en el mapa...');
    map.on('click', function(e) {
        console.log('🧪 TEST: Click detectado en el mapa!', e.latlng);
    });
}

// Mostrar controles de dibujo en la interfaz principal
function showDrawingControls() {
    console.log('🎛️ Mostrando controles de dibujo...');
    
    // Crear o actualizar controles de dibujo
    let controlsDiv = document.getElementById('drawingControls');
    if (!controlsDiv) {
        controlsDiv = document.createElement('div');
        controlsDiv.id = 'drawingControls';
        controlsDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            border: 2px solid #007bff;
        `;
        document.body.appendChild(controlsDiv);
    }
    
    controlsDiv.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #007bff;">🎨 Dibujando Zona</h4>
        <p style="margin: 0 0 10px 0; font-size: 14px;">Haz clic en el mapa para agregar puntos</p>
        <div style="display: flex; gap: 10px;">
            <button id="finishDrawingBtn" class="btn btn-success" style="padding: 8px 16px;">
                ✔ Finalizar Dibujo
            </button>
            <button id="clearDrawingBtn" class="btn btn-warning" style="padding: 8px 16px;">
                🗑️ Limpiar
            </button>
        </div>
    `;
    
    // Agregar event listeners
    document.getElementById('finishDrawingBtn').onclick = () => {
        console.log('🖱️ Click en Finalizar desde controles');
        finishZoneDrawing();
    };
    
    document.getElementById('clearDrawingBtn').onclick = () => {
        console.log('🖱️ Click en Limpiar desde controles');
        clearZoneDrawing();
        hideDrawingControls();
    };
    
    console.log('✅ Controles de dibujo mostrados');
}

// Ocultar controles de dibujo
function hideDrawingControls() {
    const controlsDiv = document.getElementById('drawingControls');
    if (controlsDiv) {
        controlsDiv.remove();
        console.log('✅ Controles de dibujo ocultados');
    }
}

// Cargar los puntos dibujados en el modal
function loadDrawnPointsInModal() {
    console.log('🔄 Cargando puntos dibujados en el modal...');
    console.log('📍 Puntos a cargar:', zonePoints);
    
    if (zonePoints.length > 0) {
        // Mostrar la zona dibujada en el mapa
        updateZoneDrawing();
        console.log('✅ Zona dibujada mostrada en el mapa');
        
        // Actualizar información de la zona
        updateZoneInfo();
        console.log('✅ Información de zona actualizada');
        
        // Habilitar botón de guardar
        const saveBtn = document.getElementById('saveZone');
        if (saveBtn) {
            saveBtn.disabled = false;
            console.log('✅ Botón guardar habilitado');
        }
    } else {
        console.log('⚠️ No hay puntos para cargar');
    }
}

// Finalizar dibujo de zona
function finishZoneDrawing() {
    console.log('🏁 Finalizando dibujo de zona...');
    console.log('📍 Puntos actuales:', zonePoints.length);
    
    if (!isDrawingZone || zonePoints.length < 2) {
        console.log('❌ No se puede finalizar: menos de 2 puntos');
        showNotification('Necesitas al menos 2 puntos para crear una zona', 'error');
        return;
    }
    
    isDrawingZone = false;
    console.log('✅ Estado de dibujo desactivado');
    
    // Actualizar botones
    const startBtn = document.getElementById('startDrawing');
    const finishBtn = document.getElementById('finishDrawing');
    const clearBtn = document.getElementById('clearDrawing');
    const saveBtn = document.getElementById('saveZone');
    
    if (startBtn) startBtn.disabled = false;
    if (finishBtn) finishBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = false;
    if (saveBtn) saveBtn.disabled = false;
    
    console.log('✅ Botones actualizados');
    
    // Restaurar cursor
    if (map) {
        map.getContainer().style.cursor = '';
        console.log('✅ Cursor restaurado');
    }
    
    // Remover listeners
    if (currentClickHandler) {
        map.off('click', currentClickHandler);
        currentClickHandler = null;
        console.log('✅ Listener de click removido');
    }
    if (map._zoneDblClickHandler) {
        map.off('dblclick', map._zoneDblClickHandler);
        map._zoneDblClickHandler = null;
        console.log('✅ Listener de doble click removido');
    }
    
    showNotification('Zona dibujada. Abriendo modal para guardar...', 'success');
    console.log('✅ Dibujo de zona finalizado correctamente');
    
    // Ocultar controles de dibujo
    hideDrawingControls();
    
    // Volver a abrir el modal para guardar la zona
    setTimeout(() => {
        openZoneModal();
        // Cargar los puntos dibujados en el modal
        loadDrawnPointsInModal();
    }, 1000);
}

// Limpiar dibujo de zona
function clearZoneDrawing() {
    console.log('🗑️ Limpiando dibujo de zona...');
    
    isDrawingZone = false;
    zonePoints = [];
    
    console.log('✅ Estado de dibujo limpiado');
    
    // Actualizar botones
    const startBtn = document.getElementById('startDrawing');
    const finishBtn = document.getElementById('finishDrawing');
    const clearBtn = document.getElementById('clearDrawing');
    const saveBtn = document.getElementById('saveZone');
    
    if (startBtn) startBtn.disabled = false;
    if (finishBtn) finishBtn.disabled = true;
    if (clearBtn) clearBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    
    console.log('✅ Botones actualizados');
    
    // Restaurar cursor
    if (map) {
        map.getContainer().style.cursor = '';
        console.log('✅ Cursor restaurado');
    }
    
    // Remover listeners
    if (currentClickHandler) {
        map.off('click', currentClickHandler);
        currentClickHandler = null;
        console.log('✅ Listener de click removido');
    }
    if (map._zoneDblClickHandler) {
        map.off('dblclick', map._zoneDblClickHandler);
        map._zoneDblClickHandler = null;
        console.log('✅ Listener de doble click removido');
    }
    
    // Limpiar capa de dibujo
    if (zoneDrawingLayer) {
        map.removeLayer(zoneDrawingLayer);
        zoneDrawingLayer = null;
    }
    
    console.log('✅ Dibujo de zona limpiado completamente');
}

// Actualizar información de la zona
function updateZoneInfo() {
    console.log('📊 Actualizando información de la zona...');
    console.log('📍 Puntos:', zonePoints);
    
    const pointsSpan = document.getElementById('zonePoints');
    const areaSpan = document.getElementById('zoneArea');
    const perimeterSpan = document.getElementById('zonePerimeter');
    
    console.log('🔍 Elementos de información:');
    console.log('  - pointsSpan:', pointsSpan);
    console.log('  - areaSpan:', areaSpan);
    console.log('  - perimeterSpan:', perimeterSpan);
    
    if (pointsSpan) {
        pointsSpan.textContent = `${zonePoints.length} puntos`;
        console.log('✅ Puntos actualizados:', pointsSpan.textContent);
    }
    
    if (zonePoints.length >= 3) {
        console.log('🔺 Calculando área y perímetro...');
        const area = calculatePolygonArea(zonePoints);
        const perimeter = calculatePolygonPerimeter(zonePoints);
        
        console.log('📐 Área calculada:', area);
        console.log('📏 Perímetro calculado:', perimeter);
        
        if (areaSpan) {
            areaSpan.textContent = `${area.toFixed(2)} m²`;
            console.log('✅ Área actualizada:', areaSpan.textContent);
        }
        if (perimeterSpan) {
            perimeterSpan.textContent = `${perimeter.toFixed(2)} m`;
            console.log('✅ Perímetro actualizado:', perimeterSpan.textContent);
        }
    } else {
        console.log('⚠️ Menos de 3 puntos, no se puede calcular área');
        if (areaSpan) {
            areaSpan.textContent = '0 m²';
            console.log('✅ Área reseteada');
        }
        if (perimeterSpan) {
            perimeterSpan.textContent = '0 m';
            console.log('✅ Perímetro reseteado');
        }
    }
    
    console.log('✅ Información de zona actualizada');
}

// Calcular área de polígono
function calculatePolygonArea(points) {
    console.log('📐 Calculando área del polígono...');
    console.log('📍 Puntos:', points);
    
    if (points.length < 3) {
        console.log('⚠️ Menos de 3 puntos, área = 0');
        return 0;
    }
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i][1] * points[j][0];
        area -= points[j][1] * points[i][0];
    }
    
    const result = Math.abs(area) / 2 * 111320 * 111320; // Aproximación para metros cuadrados
    console.log('✅ Área calculada:', result);
    return result;
}

// Calcular perímetro de polígono
function calculatePolygonPerimeter(points) {
    console.log('📏 Calculando perímetro del polígono...');
    console.log('📍 Puntos:', points);
    
    if (points.length < 2) {
        console.log('⚠️ Menos de 2 puntos, perímetro = 0');
        return 0;
    }
    
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        const lat1 = points[i][0];
        const lon1 = points[i][1];
        const lat2 = points[j][0];
        const lon2 = points[j][1];
        
        // Fórmula de Haversine para calcular distancia
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        perimeter += distance;
    }
    
    console.log('✅ Perímetro calculado:', perimeter);
    return perimeter;
}

// Actualizar visualización del dibujo de zona
function updateZoneDrawing() {
    console.log('🎨 Actualizando visualización del dibujo...');
    console.log('📍 Puntos actuales:', zonePoints);
    
    if (zonePoints.length === 0) {
        console.log('⚠️ No hay puntos para dibujar');
        return;
    }
    
    // Verificar que el mapa esté disponible
    if (!map) {
        console.error('❌ Mapa no disponible para dibujar');
        return;
    }
    
    // Limpiar capa anterior
    if (zoneDrawingLayer) {
        console.log('🗑️ Limpiando capa anterior');
        map.removeLayer(zoneDrawingLayer);
    }
    
    // Crear nueva capa
    zoneDrawingLayer = L.layerGroup();
    console.log('✅ Nueva capa de dibujo creada');
    
    // Agregar puntos
    zonePoints.forEach((point, index) => {
        console.log(`📍 Agregando punto ${index + 1}:`, point);
        const marker = L.circleMarker(point, {
            radius: 6,
            fillColor: '#e74c3c',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });
        zoneDrawingLayer.addLayer(marker);
    });
    
    // Agregar líneas si hay más de un punto
    if (zonePoints.length > 1) {
        console.log('📏 Agregando líneas entre puntos');
        const polyline = L.polyline(zonePoints, {
            color: '#e74c3c',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 5'
        });
        zoneDrawingLayer.addLayer(polyline);
    }
    
    // Agregar polígono si hay al menos 3 puntos
    if (zonePoints.length >= 3) {
        console.log('🔺 Agregando polígono');
        const polygon = L.polygon(zonePoints, {
            color: '#e74c3c',
            weight: 2,
            opacity: 0.8,
            fillColor: '#e74c3c',
            fillOpacity: 0.2,
            dashArray: '5, 5'
        });
        zoneDrawingLayer.addLayer(polygon);
    }
    
    // Agregar la capa al mapa
    zoneDrawingLayer.addTo(map);
    console.log('✅ Capa de dibujo agregada al mapa');
}

// Guardar zona
function saveZone() {
    console.log('💾 Guardando zona...');
    console.log('📍 Puntos:', zonePoints);
    
    const nameInput = document.getElementById('zoneName');
    const descInput = document.getElementById('zoneDescription');
    const typeInput = document.querySelector('input[name="zoneType"]:checked');
    
    console.log('🔍 Elementos del formulario:');
    console.log('  - nameInput:', nameInput);
    console.log('  - descInput:', descInput);
    console.log('  - typeInput:', typeInput);
    
    if (!nameInput || !descInput || !typeInput) {
        console.error('❌ No se encontraron todos los campos del formulario');
        return;
    }
    
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const type = typeInput.value;
    
    console.log('📝 Datos del formulario:');
    console.log('  - name:', name);
    console.log('  - description:', description);
    console.log('  - type:', type);
    
    if (!name) {
        console.log('❌ Nombre vacío');
        showNotification('Por favor introduce un nombre para la zona', 'error');
        return;
    }
    
    if (zonePoints.length < 2) {
        console.log('❌ Menos de 2 puntos');
        showNotification('Necesitas dibujar una zona primero', 'error');
        return;
    }
    
    console.log('✅ Validaciones pasadas, creando zona...');
    
    // Crear objeto de zona
    const zone = {
        id: currentZone !== null ? customZones[currentZone].id : Date.now().toString(),
        name: name,
        description: description,
        type: type,
        points: [...zonePoints],
        createdAt: currentZone !== null ? customZones[currentZone].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    console.log('✅ Zona creada:', zone);
    
    // Guardar o actualizar zona
    if (currentZone !== null) {
        customZones[currentZone] = zone;
        console.log('✅ Zona actualizada en la lista');
        showNotification(`Zona "${name}" actualizada`, 'success');
    } else {
        customZones.push(zone);
        console.log('✅ Zona agregada a la lista');
        showNotification(`Zona "${name}" creada`, 'success');
    }
    
    // Guardar en localStorage
    saveCustomZones();
    console.log('✅ Zona guardada en localStorage');
    
    // Actualizar interfaz
    updateZoneSelector();
    console.log('✅ Selector actualizado');
    clearZoneDrawing();
    console.log('✅ Dibujo limpiado');
    closeZoneModal();
    console.log('✅ Modal cerrado');
    
    // Mostrar zona en el mapa
    showZoneOnMap(zone);
    console.log('✅ Zona mostrada en el mapa');
    
    console.log('✅ Zona guardada correctamente');
}

// Mostrar zona en el mapa
function showZoneOnMap(zone) {
    console.log('🗺️ Mostrando zona en el mapa...');
    console.log('📍 Zona:', zone);
    
    // Limpiar zona anterior
    clearZoneFromMap();
    console.log('✅ Zona anterior limpiada');
    
    if (!zone || !zone.points || zone.points.length < 2) {
        console.log('❌ Zona inválida o sin puntos suficientes');
        return;
    }
    
    console.log('✅ Zona válida, creando polígono...');
    
    // Crear capa de zona
    zoneLayer = L.layerGroup();
    
    // Agregar polígono
    const polygon = L.polygon(zone.points, {
        color: zone.type === 'rectangle' ? '#2ecc71' : '#3498db',
        weight: 2,
        opacity: 0.8,
        fillColor: zone.type === 'rectangle' ? '#2ecc71' : '#3498db',
        fillOpacity: 0.2,
        className: zone.type === 'rectangle' ? 'zone-rectangle' : 'zone-polygon'
    });
    
    // Agregar popup con información
    polygon.bindPopup(`
        <div style="text-align: center;">
            <h4>📍 ${zone.name}</h4>
            <p><strong>Tipo:</strong> ${zone.type === 'rectangle' ? 'Rectangular' : 'Poligonal'}</p>
            <p><strong>Puntos:</strong> ${zone.points.length}</p>
            ${zone.description ? `<p><strong>Descripción:</strong> ${zone.description}</p>` : ''}
            <p><strong>Creada:</strong> ${new Date(zone.createdAt).toLocaleDateString()}</p>
        </div>
    `);
    
    zoneLayer.addLayer(polygon);
    zoneLayer.addTo(map);
    console.log('✅ Polígono agregado al mapa');
    
    // Ajustar vista para mostrar la zona
    const group = new L.featureGroup([polygon]);
    if (group.getBounds().isValid()) {
        map.fitBounds(group.getBounds().pad(0.1));
        console.log('✅ Mapa ajustado para mostrar la zona');
    }
    
    console.log('✅ Zona mostrada correctamente en el mapa');
}

// Limpiar zona del mapa
function clearZoneFromMap() {
    console.log('🗑️ Limpiando zona del mapa...');
    
    if (zoneLayer) {
        map.removeLayer(zoneLayer);
        zoneLayer = null;
        console.log('✅ Zona limpiada del mapa');
    } else {
        console.log('⚠️ No hay zona para limpiar');
    }
    
    console.log('✅ Limpieza de zona completada');
}

// Remover zona específica del mapa
function removeZoneFromMap(zone) {
    console.log('🗑️ Removiendo zona específica del mapa...');
    console.log('📍 Zona a remover:', zone);
    
    // Esta función se puede expandir si necesitas remover zonas específicas
    clearZoneFromMap();
    console.log('✅ Zona removida del mapa');
}

// Buscar recursos en zona
async function searchByZone() {
    console.log('🔍 Buscando recursos en zona...');
    
    const select = document.getElementById('zoneSelect');
    const radius = parseFloat(document.getElementById('zoneRadius').value);
    
    console.log('📍 Zona seleccionada:', select?.value);
    console.log('📍 Radio:', radius);
    
    if (!select || select.value === '') {
        console.log('❌ No hay zona seleccionada');
        showNotification('Por favor selecciona una zona', 'error');
        return;
    }
    
    if (!radius || radius <= 0 || radius > 50) {
        console.log('❌ Radio inválido');
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }
    
    const zoneIndex = parseInt(select.value);
    const zone = customZones[zoneIndex];
    
    console.log('📍 Zona encontrada:', zone);
    console.log('📍 Índice:', zoneIndex);
    
    if (!zone || !zone.points || zone.points.length < 2) {
        console.log('❌ Zona no válida');
        showNotification('Zona no válida', 'error');
        return;
    }
    
    console.log('✅ Zona válida, iniciando búsqueda...');
    
    try {
        showNotification(`Buscando recursos en zona "${zone.name}"...`, 'info');
        
        // Obtener todos los recursos
        const url = addFechasToUrl('/api/recursos');
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Filtrar recursos que estén dentro de la zona
        const recursosEnZona = [];
        
        data.datos.forEach(recurso => {
            if (recurso.PuntoX && recurso.PuntoY) {
                const point = [recurso.PuntoY, recurso.PuntoX]; // [lat, lon]
                
                // Verificar si el punto está dentro del polígono
                if (isPointInPolygon(point, zone.points)) {
                    // Calcular distancia al centro de la zona
                    const center = getPolygonCenter(zone.points);
                    const distancia = calcular_distancia_haversine(
                        center[0], center[1],
                        recurso.PuntoY, recurso.PuntoX
                    );
                    
                    recurso.distancia_a_zona_km = round(distancia, 2);
                    recursosEnZona.push(recurso);
                }
            }
        });
        
        // Ordenar por distancia
        recursosEnZona.sort((a, b) => a.distancia_a_zona_km - b.distancia_a_zona_km);
        
        // Mostrar resultados
        displayZoneSearchResults(recursosEnZona, zone, radius);
        console.log('✅ Resultados mostrados');
        
    } catch (error) {
        console.error('❌ Error en búsqueda por zona:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
    
    console.log('✅ Búsqueda en zona completada');
}

// Mostrar resultados de búsqueda por zona
function displayZoneSearchResults(recursos, zone, radius) {
    console.log('📊 Mostrando resultados de búsqueda por zona...');
    console.log('📍 Recursos encontrados:', recursos.length);
    console.log('📍 Zona:', zone);
    console.log('📍 Radio:', radius);
    
    // Limpiar búsquedas anteriores
    clearSearchResults();
    console.log('✅ Búsquedas anteriores limpiadas');
    
    // Crear capas para los resultados
    searchLayer = L.layerGroup();
    console.log('✅ Capa de búsqueda creada');
    
    // Mostrar la zona
    showZoneOnMap(zone);
    console.log('✅ Zona mostrada en el mapa');
    
    // Mostrar recursos encontrados
    if (recursos.length > 0) {
        console.log('✅ Mostrando recursos encontrados...');
        recursos.forEach(recurso => {
            // Usar el mismo estilo que los recursos normales
            let color = '#44ff44'; // Verde por defecto
            if (recurso.tiene_incidencia && recurso.total_incidencias > 0) {
                color = '#ff4444'; // Rojo si tiene incidencias
            } else if (recurso.total_campanas > 0) {
                color = '#ff8800'; // Naranja si tiene campañas
            }
            
            const marker = L.circleMarker([recurso.PuntoY, recurso.PuntoX], {
                radius: 10,
                fillColor: color,
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.8
            });
            
            // Usar función común para crear el popup
            crearPopupRecurso(marker, recurso);
            
            searchLayer.addLayer(marker);
        });
    }
    
    // Actualizar contador de seleccionados después de añadir recursos de zona
    updateContadorSeleccionados();
    
    // Agregar capa al mapa
    searchLayer.addTo(map);
    console.log('✅ Capa de búsqueda agregada al mapa');
    
    // Mostrar resumen
    showNotification(
        `✓ Búsqueda en zona completada: ${recursos.length} recursos encontrados en "${zone.name}"`,
        'success'
    );
    console.log('✅ Resumen mostrado');
    
    console.log('✅ Resultados de búsqueda por zona mostrados correctamente');
}

// Función auxiliar para verificar si un punto está dentro de un polígono
function isPointInPolygon(point, polygon) {
    console.log('🔍 Verificando si punto está dentro del polígono...');
    console.log('📍 Punto:', point);
    console.log('📍 Polígono:', polygon);
    
    const x = point[0], y = point[1];
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    console.log('✅ Punto dentro del polígono:', inside);
    return inside;
}

// Función auxiliar para obtener el centro de un polígono
function getPolygonCenter(points) {
    console.log('📍 Calculando centro del polígono...');
    console.log('📍 Puntos:', points);
    
    let lat = 0, lon = 0;
    points.forEach(point => {
        lat += point[0];
        lon += point[1];
    });
    
    const center = [lat / points.length, lon / points.length];
    console.log('✅ Centro calculado:', center);
    return center;
}

// Función auxiliar para redondear números
function round(num, decimals) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Función auxiliar para calcular distancia entre dos puntos usando la fórmula de Haversine
function calcular_distancia_haversine(lat1, lon1, lat2, lon2) {
    console.log('📏 Calculando distancia Haversine...');
    console.log('📍 Punto 1:', lat1, lon1);
    console.log('📍 Punto 2:', lat2, lon2);
    
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    console.log('✅ Distancia calculada:', distance, 'km');
    return distance;
}

// Función de prueba para verificar el sistema de zonas
function testZoneSystem() {
    console.log('🧪 === PRUEBA: Sistema de Zonas ===');
    
    // Verificar elementos del DOM
    const startBtn = document.getElementById('startDrawing');
    const finishBtn = document.getElementById('finishDrawing');
    const clearBtn = document.getElementById('clearDrawing');
    const saveBtn = document.getElementById('saveZone');
    
    console.log('🔍 Elementos del DOM:');
    console.log('  - startDrawing:', startBtn);
    console.log('  - finishDrawing:', finishBtn);
    console.log('  - clearDrawing:', clearBtn);
    console.log('  - saveZone:', saveBtn);
    
    // Verificar estado de variables
    console.log('📊 Estado de variables:');
    console.log('  - isDrawingZone:', isDrawingZone);
    console.log('  - zonePoints:', zonePoints);
    console.log('  - map:', map);
    
    // Verificar funciones
    console.log('🔧 Funciones:');
    console.log('  - startZoneDrawing:', typeof startZoneDrawing);
    console.log('  - updateZoneDrawing:', typeof updateZoneDrawing);
    console.log('  - finishZoneDrawing:', typeof finishZoneDrawing);
    
    // Probar abrir modal
    console.log('🔄 Probando abrir modal...');
    openZoneModal();
    
    console.log('=== FIN PRUEBA ===');
}

// Exportar funciones para uso global
window.toggleRecursoSeleccionado = toggleRecursoSeleccionado;
window.exportarRecursosExcel = exportarRecursosExcel;

window.GISApp = {
    loadAllGeoData,
    loadRecursos,
    loadMobiliario,
    clearMap,
    showNotification,
    map,
    searchByPlace,
    searchByCoordinates,
    searchByAddress,
    useCurrentLocation,
    useSavedLocation,
    getSavedLocation,
    updateLocationButton,
    updateSavedLocationButtons,
    useSavedLocationForSearch,
    clearSearchResults,
    debugLocationStorage,
    testSavedLocation,
    // Funciones de zonas personalizadas
    loadCustomZones,
    saveCustomZones,
    updateZoneSelector,
    openZoneModal,
    closeZoneModal,
    editZone,
    deleteZone,
    searchByZone,
    showZoneOnMap,
    clearZoneFromMap,
    testZoneSystem
};
