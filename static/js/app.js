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

// Variables para zonas personalizadas
let customZones = [];
let currentZone = null;
let isDrawingZone = false;
let zonePoints = [];
let zoneLayer = null;
let zoneDrawingLayer = null;

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
    // Crear el mapa centrado en España (ajustar según tu ubicación)
    map = L.map('map').setView([40.4168, -3.7038], 6);
    
    // Agregar capa de tiles de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    console.log('Mapa inicializado correctamente');
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
        
        // Cargar recursos y mobiliario en paralelo
        const [recursosResponse, mobiliarioResponse] = await Promise.all([
            fetch('/api/recursos'),
            fetch('/api/mobiliario')
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
    recursosLayer = L.layerGroup();
    
    // Procesar en lotes para mejor rendimiento
    const batchSize = 100;
    const totalItems = data.datos.length;
    
    console.log(`Procesando ${totalItems} recursos en lotes de ${batchSize}...`);
    
    for (let i = 0; i < totalItems; i += batchSize) {
        const batch = data.datos.slice(i, i + batchSize);
        
        batch.forEach(recurso => {
            if (recurso.PuntoX && recurso.PuntoY) {
                // Lógica de colores: Rojo si tiene incidencias, Naranja si tiene campañas, Verde si no tiene nada
                let color = '#44ff44'; // Verde por defecto
                if (recurso.tiene_incidencia && recurso.total_incidencias > 0) {
                    color = '#ff4444'; // Rojo si tiene incidencias
                } else if (recurso.total_campanas > 0) {
                    color = '#ff8800'; // Naranja si tiene campañas pero no incidencias
                }
                
                const marker = L.circleMarker([recurso.PuntoY, recurso.PuntoX], {
                    radius: 8,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            
            // Crear tooltip simple inicial (solo información básica)
            const simpleTooltip = `
                <div style="max-width: 350px; padding: 5px;">
                    <h4>🔧 Recurso: ${recurso.Name || 'Sin nombre'}</h4>
                    <p><strong>Nº:</strong> ${recurso.No_}</p>
                    <p><strong>Estado:</strong> ${recurso.tiene_incidencia && recurso.total_incidencias > 0 ? '🚨 Con incidencias' : recurso.total_campanas > 0 ? '📋 Con campañas' : '✅ Sin problemas'}</p>
                    <p><strong>Total campañas:</strong> ${recurso.total_campanas || 0}</p>
                    <p><strong>Total incidencias:</strong> ${recurso.total_incidencias || 0}</p>
                    <p style="text-align: center; margin-top: 5px; font-size: 12px; color: #666;">
                        <em>Haz clic para ver detalles completos</em>
                    </p>
                </div>
            `;
            
            // Usar tooltip simple inicialmente
            marker.bindPopup(simpleTooltip);
            
            // Crear tooltip completo solo cuando se necesite
            marker.on('click', async function() {
                // Mostrar tooltip de carga
                const loadingTooltip = `
                    <div style="max-width: 300px; padding: 10px; text-align: center;">
                        <h4>🔧 ${recurso.Name || 'Sin nombre'}</h4>
                        <p>Cargando detalles...</p>
                        <div style="border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin: 10px auto;"></div>
                    </div>
                `;
                marker.setPopupContent(loadingTooltip);
                
                try {
                    // Cargar detalles desde el API
                    console.log(`🔍 Cargando detalles para recurso: ${recurso.No_}`);
                    const url = `/api/recursos/${recurso.No_}/detalles`;
                    console.log(`📡 URL de petición: ${url}`);
                    
                    const response = await fetch(url);
                    console.log(`📡 Respuesta recibida:`, response.status, response.statusText);
                    
                    const data = await response.json();
                    console.log(`📊 Datos de detalles recibidos:`, data);
                    
                    let tooltipContent = `
                        <div style="max-width: 400px; max-height: 500px; overflow-y: auto; padding: 5px;">
                            <h4>🔧 Recurso: ${recurso.Name || 'Sin nombre'}</h4>
                            <p><strong>Nº:</strong> ${recurso.No_}</p>
                            <p><strong>Estado:</strong> ${data.total_incidencias > 0 ? '🚨 Con incidencias' : data.total_campanas > 0 ? '📋 Con campañas' : '✅ Sin problemas'}</p>
                            <p><strong>Total campañas:</strong> ${data.total_campanas || 0}</p>
                            <p><strong>Total incidencias:</strong> ${data.total_incidencias || 0}</p>
                    `;
                    
                    if (data.campanas && data.campanas.length > 0) {
                        tooltipContent += `<h5>📋 Campañas (${data.campanas.length}):</h5>`;
                        data.campanas.forEach((campana, index) => {
                            tooltipContent += `<div style="margin-bottom: 8px; padding: 5px; background-color: #f8f9fa; border-left: 3px solid #007bff;">`;
                            tooltipContent += `<strong>Campaña ${index + 1}:</strong><br>`;
                            if (campana.Campaña) {
                                tooltipContent += `<strong>Campaña:</strong> ${campana.Campaña}<br>`;
                            }
                            if (campana.Inicio) {
                                tooltipContent += `<strong>Inicio:</strong> ${formatearFecha(campana.Inicio)}<br>`;
                            }
                            if (campana.Fin) {
                                tooltipContent += `<strong>Fin:</strong> ${formatearFecha(campana.Fin)}<br>`;
                            }
                            if (campana['Nº Incidencia']) {
                                tooltipContent += `<strong>Nº Incidencia:</strong> ${campana['Nº Incidencia']}<br>`;
                            }
                            tooltipContent += `</div>`;
                        });
                    } else {
                        tooltipContent += `<p><em>No hay campañas asociadas</em></p>`;
                    }
                    
                    if (data.incidencias && data.incidencias.length > 0) {
                        tooltipContent += `<h5>🚨 Incidencias (${data.incidencias.length}):</h5>`;
                        
                        // Agrupar incidencias por tipo
                        const incidenciasPorTipo = {};
                        data.incidencias.forEach(incidencia => {
                            const tipo = incidencia.Tipo || 'Sin tipo';
                            if (!incidenciasPorTipo[tipo]) {
                                incidenciasPorTipo[tipo] = [];
                            }
                            incidenciasPorTipo[tipo].push(incidencia);
                        });
                        
                        // Mostrar resumen por tipo
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
                    
                    tooltipContent += `</div>`;
                    marker.setPopupContent(tooltipContent);
                    
                } catch (error) {
                    console.error('Error cargando detalles:', error);
                    console.error('Recurso ID:', recurso.No_);
                    console.error('URL de petición:', `/api/recursos/${recurso.No_}/detalles`);
                    
                    const errorTooltip = `
                        <div style="max-width: 300px; padding: 10px;">
                            <h4>🔧 ${recurso.Name || 'Sin nombre'}</h4>
                            <p><strong>Nº:</strong> ${recurso.No_}</p>
                            <p><strong>Estado:</strong> ${recurso.tiene_incidencia && recurso.total_incidencias > 0 ? '🚨 Con incidencias' : recurso.total_campanas > 0 ? '📋 Con campañas' : '✅ Sin problemas'}</p>
                            <p><strong>Total campañas:</strong> ${recurso.total_campanas || 0}</p>
                            <p><strong>Total incidencias:</strong> ${recurso.total_incidencias || 0}</p>
                            <p style="color: red;"><em>Error cargando detalles</em></p>
                            <p style="color: #666; font-size: 11px;">
                                <strong>Debug:</strong><br>
                                ID: ${recurso.No_}<br>
                                Error: ${error.message || 'Error desconocido'}
                            </p>
                        </div>
                    `;
                    marker.setPopupContent(errorTooltip);
                }
            });
            recursosLayer.addLayer(marker);
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
    
    console.log('Recursos cargados completamente');
    recursosLayer.addTo(map);
}

// Función auxiliar para cargar datos de mobiliario
async function loadMobiliarioData(data) {
    mobiliarioLayer = L.layerGroup();
    
    // Procesar en lotes para mejor rendimiento
    const batchSize = 100;
    const totalItems = data.datos.length;
    
    console.log(`Procesando ${totalItems} elementos de mobiliario en lotes de ${batchSize}...`);
    
    for (let i = 0; i < totalItems; i += batchSize) {
        const batch = data.datos.slice(i, i + batchSize);
        
        batch.forEach(mobiliario => {
            if (mobiliario.PuntoX && mobiliario.PuntoY) {
                // Crear icono de parada de autobús optimizado
                const color = mobiliario.tiene_incidencia ? '#ff8800' : '#4488ff';
                
                const busIcon = L.divIcon({
                    className: 'custom-bus-icon',
                    html: `<div style="
                        background-color: ${color};
                        color: white;
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: bold;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">🚌</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
                
                const marker = L.marker([mobiliario.PuntoY, mobiliario.PuntoX], {
                    icon: busIcon
                });
            
            // Crear tooltip simple inicial (solo información básica)
            const simpleTooltip = `
                <div style="max-width: 350px; padding: 5px;">
                    <h4>🪑 ${mobiliario.Descripción || 'Sin descripción'}</h4>
                    <p><strong>Nº:</strong> ${mobiliario['Nº Emplazamiento']}</p>
                    <p><strong>Estado:</strong> ${mobiliario.tiene_incidencia ? '⚠️ Con incidencias' : '✅ Sin incidencias'}</p>
                    <p><strong>Incidencias:</strong> ${mobiliario.total_incidencias}</p>
                    
                    <!-- Mapa de Ubicación Simple -->
                    <div style="margin: 10px 0; text-align: center;">
                        <h5 style="margin: 5px 0; font-size: 14px;">🌍 Ubicación</h5>
                        <div style="position: relative; width: 320px; height: 150px; border: 1px solid #ccc; border-radius: 5px; overflow: hidden; background: #f0f0f0;">
                            <!-- Intentar Street View primero -->
                            <img 
                                decoding="async" 
                                src="https://maps.googleapis.com/maps/api/streetview?size=320x150&location=${parseFloat(mobiliario.PuntoY).toFixed(6)},${parseFloat(mobiliario.PuntoX).toFixed(6)}&heading=0&pitch=0&fov=90&key=AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno" 
                                style="width: 100%; height: 100%; object-fit: cover;"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                                alt="Street View de la parada de autobús">
                            
                            <!-- Fallback: Mapa normal si no hay Street View -->
                            <div style="display: none; width: 100%; height: 100%;">
                                <iframe 
                                    width="100%" 
                                    height="100%" 
                                    frameborder="0" 
                                    style="border: none;"
                                    src="https://www.google.com/maps/embed/v1/view?center=${parseFloat(mobiliario.PuntoY).toFixed(6)},${parseFloat(mobiliario.PuntoX).toFixed(6)}&zoom=18&maptype=satellite&key=AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno"
                                    allowfullscreen>
                                </iframe>
                            </div>
                            
                            <!-- Overlay con información de la parada -->
                            <div style="position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.7); color: white; padding: 6px; border-radius: 3px; font-size: 11px; max-width: 150px;">
                                <strong>🚌 ${mobiliario['Nº Emplazamiento']}</strong><br>
                                <small>${mobiliario.Descripción || 'Parada'}</small>
                            </div>
                        </div>
                        <p style="font-size: 11px; color: #666; margin-top: 3px;">
                            <a href="https://www.google.com/maps/search/?api=1&query=Parada Bus ${mobiliario['Nº Emplazamiento']} - ${mobiliario.Descripción || mobiliario.Dirección || `${mobiliario.PuntoY},${mobiliario.PuntoX}`} - Palma de Mallorca" 
                               target="_blank" 
                               style="color: #007bff; text-decoration: none;">
                                🔗 Google Maps
                            </a>
                            <span style="margin: 0 8px;">|</span>
                            <a href="https://www.google.com/maps/search/?api=1&query=Parada Bus ${mobiliario['Nº Emplazamiento']} - ${mobiliario.Descripción || mobiliario.Dirección || `${mobiliario.PuntoY},${mobiliario.PuntoX}`} - Palma de Mallorca&t=h" 
                               target="_blank" 
                               style="color: #ff6b35; text-decoration: none;">
                                🚶 Street View
                            </a>
                        </p>
                    </div>
                    
                    <p style="text-align: center; margin-top: 5px; font-size: 12px; color: #666;">
                        <em>Haz clic para ver detalles completos</em>
                    </p>
                </div>
            `;
            
            // Usar tooltip simple inicialmente
            marker.bindPopup(simpleTooltip);
            
            // Crear tooltip completo solo cuando se necesite
            marker.on('click', async function() {
                // Mostrar tooltip de carga
                const loadingTooltip = `
                    <div style="max-width: 300px; padding: 10px; text-align: center;">
                        <h4>🪑 ${mobiliario.Descripción || 'Sin descripción'}</h4>
                        <p>Cargando incidencias...</p>
                        <div style="border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin: 10px auto;"></div>
                    </div>
                `;
                marker.setPopupContent(loadingTooltip);
                
                try {
                    // Cargar incidencias desde el API
                    console.log(`🔍 Cargando incidencias para emplazamiento: ${mobiliario['Nº Emplazamiento']}`);
                    const url = `/api/mobiliario/${mobiliario['Nº Emplazamiento']}/incidencias`;
                    console.log(`📡 URL de petición: ${url}`);
                    
                    const response = await fetch(url);
                    console.log(`📡 Respuesta recibida:`, response.status, response.statusText);
                    
                    const data = await response.json();
                    console.log(`📊 Datos de incidencias recibidos:`, data);
                    
                    let tooltipContent = `
                        <div style="max-width: 400px; max-height: 500px; overflow-y: auto; padding: 5px;">
                            <h4>🪑 Mobiliario: ${mobiliario.Descripción || 'Sin descripción'}</h4>
                            <p><strong>Nº Emplazamiento:</strong> ${mobiliario['Nº Emplazamiento']}</p>
                            <p><strong>Tipo:</strong> ${mobiliario.Tipo || 'N/A'}</p>
                            <p><strong>Tipo Parada:</strong> ${mobiliario['Tipo Parada'] || 'N/A'}</p>
                            <!--<p><strong>Coordenadas:</strong> ${mobiliario.PuntoX}, ${mobiliario.PuntoY}</p>-->
                            ${mobiliario.geocodificado ? '<p><strong>📍 Ubicación:</strong> <em>Geocodificada desde dirección de Mallorca</em></p>' : ''}
                            ${mobiliario.Dirección ? `<p><strong>Dirección (Mallorca):</strong> ${mobiliario.Dirección}</p>` : ''}
                            <p><strong>Estado:</strong> ${mobiliario.tiene_incidencia ? '⚠️ Con incidencias' : '✅ Sin incidencias'}</p>
                            <p><strong>Total incidencias:</strong> ${data.total_incidencias || 0}</p>
                            
                    <!-- Mapa de Ubicación -->
                    <div style="margin: 10px 0; text-align: center;">
                        <h5>🌍 Ubicación en el Mapa</h5>
                        <div style="position: relative; width: 350px; height: 200px; border: 1px solid #ccc; border-radius: 5px; overflow: hidden; background: #f0f0f0;">
                            <!-- Intentar Street View primero -->
                            <img 
                                decoding="async" 
                                src="https://maps.googleapis.com/maps/api/streetview?size=350x200&location=${parseFloat(mobiliario.PuntoY).toFixed(6)},${parseFloat(mobiliario.PuntoX).toFixed(6)}&heading=0&pitch=0&fov=90&key=AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno" 
                                style="width: 100%; height: 100%; object-fit: cover;"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
                                alt="Street View de la parada de autobús">
                            
                            <!-- Fallback: Vista satelital si no hay Street View-->
                            <div style="display: none; width: 100%; height: 100%;">
                                <iframe 
                                    width="100%" 
                                    height="100%" 
                                    frameborder="0" 
                                    style="border: none;"
                                    src="https://www.google.com/maps/embed/v1/view?center=${parseFloat(mobiliario.PuntoY).toFixed(6)},${parseFloat(mobiliario.PuntoX).toFixed(6)}&zoom=18&maptype=satellite&key=AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno"
                                    allowfullscreen>
                                </iframe>
                            </div> 
                            
                            <!-- Overlay con información de la parada -->
                            <!--<div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 8px; border-radius: 4px; font-size: 12px; max-width: 200px;">
                                <strong>🚌 Parada ${mobiliario['Nº Emplazamiento']}</strong><br>
                                ${mobiliario.Descripción || 'Sin descripción'}<br>
                                <small>Coordenadas: ${parseFloat(mobiliario.PuntoY).toFixed(6)}, ${parseFloat(mobiliario.PuntoX).toFixed(6)}</small>
                            </div>-->
                        </div>
                        <p style="font-size: 12px; color: #666; margin-top: 5px;">
                            <a href="https://www.google.com/maps/search/?api=1&query=Parada Bus ${mobiliario['Nº Emplazamiento']} - ${mobiliario.Descripción || '@${parseFloat(mobiliario.PuntoX)-0.001},@${parseFloat(mobiliario.PuntoY)-0.001}'} - Palma de Mallorca" 
                               target="_blank" 
                               style="color: #007bff; text-decoration: none;">
                                🔗 Abrir en Google Maps
                            </a>
                            <span style="margin: 0 10px;">|</span>
                            <a href="https://www.google.com/maps/search/?api=1&query=Parada Bus ${mobiliario['Nº Emplazamiento']} - ${mobiliario.Descripción || mobiliario.Dirección || `${mobiliario.PuntoY},${mobiliario.PuntoX}`} - Palma de Mallorca&t=h" 
                               target="_blank" 
                               style="color: #ff6b35; text-decoration: none;">
                                🚶 Street View
                            </a>
                            <span style="margin: 0 10px;">|</span>
                            <a href="https://www.openstreetmap.org/?mlat=${mobiliario.PuntoY}&mlon=${mobiliario.PuntoX}&zoom=18" 
                               target="_blank" 
                               style="color: #28a745; text-decoration: none;">
                                🗺️ OpenStreetMap
                            </a>
                        </p>
                    </div>
                    `;
                    
                    if (mobiliario.SAE) {
                        tooltipContent += `<p><strong>SAE:</strong> ${mobiliario.SAE}</p>`;
                    }
                    if (mobiliario.Operario) {
                        tooltipContent += `<p><strong>Operario:</strong> ${mobiliario.Operario}</p>`;
                    }
                    if (mobiliario['Zona Limpieza']) {
                        tooltipContent += `<p><strong>Zona Limpieza:</strong> ${mobiliario['Zona Limpieza']}</p>`;
                    }
                    
                    if (data.incidencias && data.incidencias.length > 0) {
                        tooltipContent += `<h5>🚨 Incidencias (${data.incidencias.length}):</h5>`;
                        
                        // Agrupar incidencias por tipo
                        const incidenciasPorTipo = {};
                        data.incidencias.forEach(incidencia => {
                            const tipo = incidencia.Tipo || 'Sin tipo';
                            if (!incidenciasPorTipo[tipo]) {
                                incidenciasPorTipo[tipo] = [];
                            }
                            incidenciasPorTipo[tipo].push(incidencia);
                        });
                        
                        // Mostrar resumen por tipo
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
                    
                    tooltipContent += `</div>`;
                    marker.setPopupContent(tooltipContent);
                    
                } catch (error) {
                    console.error('Error cargando incidencias:', error);
                    console.error('Emplazamiento ID:', mobiliario['Nº Emplazamiento']);
                    console.error('URL de petición:', `/api/mobiliario/${mobiliario['Nº Emplazamiento']}/incidencias`);
                    
                    const errorTooltip = `
                        <div style="max-width: 300px; padding: 10px;">
                            <h4>🪑 ${mobiliario.Descripción || 'Sin descripción'}</h4>
                            <p><strong>Nº Emplazamiento:</strong> ${mobiliario['Nº Emplazamiento']}</p>
                            <p><strong>Estado:</strong> ${mobiliario.tiene_incidencia ? '⚠️ Con incidencias' : '✅ Sin incidencias'}</p>
                            <p><strong>Total incidencias:</strong> ${mobiliario.total_incidencias}</p>
                            <p style="color: red;"><em>Error cargando detalles de incidencias</em></p>
                            <p style="color: #666; font-size: 11px;">
                                <strong>Debug:</strong><br>
                                ID: ${mobiliario['Nº Emplazamiento']}<br>
                                Error: ${error.message || 'Error desconocido'}
                            </p>
                        </div>
                    `;
                    marker.setPopupContent(errorTooltip);
                }
            });
            mobiliarioLayer.addLayer(marker);
        }
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
        
        const response = await fetch('/api/recursos');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Limpiar capa de recursos anterior
        if (recursosLayer) {
            map.removeLayer(recursosLayer);
        }
        
        // Mostrar datos en consola y en el mapa
        console.log('Datos de RecursosGis:', data);
        
        // Cargar datos de recursos
        await loadRecursosData(data);
        
        // Ajustar vista del mapa para mostrar todos los recursos
        if (data.datos.length > 0) {
            const bounds = L.latLngBounds();
            recursosLayer.eachLayer(function(layer) {
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
        
        statusDiv.textContent = `✓ Cargados ${data.total_registros} recursos`;
        statusDiv.className = 'status success';
        
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
        
        const response = await fetch('/api/mobiliario');
        
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
    // Inicializar el mapa cuando se carga la página
    initMap();
    
    // Verificar el estado de la aplicación
    checkHealth();
    
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
    
    // Event listeners para búsqueda
    document.getElementById('searchByPlace').addEventListener('click', searchByPlace);
    document.getElementById('searchByCoordinates').addEventListener('click', searchByCoordinates);
    document.getElementById('searchByAddress').addEventListener('click', searchByAddress);
    document.getElementById('searchByZone').addEventListener('click', searchByZone);
    document.getElementById('useCurrentLocation').addEventListener('click', useCurrentLocation);
    document.getElementById('cancelSearch').addEventListener('click', cancelSearch);
    
    // Event listeners para zonas personalizadas
    document.getElementById('createNewZone').addEventListener('click', openZoneModal);
    document.getElementById('editZone').addEventListener('click', editZone);
    document.getElementById('deleteZone').addEventListener('click', deleteZone);
    document.getElementById('zoneSelect').addEventListener('change', onZoneSelect);
    document.getElementById('startDrawing').addEventListener('click', startZoneDrawing);
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
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
    }, 5000);
}

// ==================== FUNCIONES DE BÚSQUEDA ====================

// Cargar tipos de lugares disponibles
async function loadPlaceTypes() {
    try {
        const response = await fetch('/api/tipos-lugares');
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const select = document.getElementById('placeType');
        select.innerHTML = '<option value="">Seleccionar tipo...</option>';
        
        Object.entries(data.tipos_lugares).forEach(([key, value]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = value;
            select.appendChild(option);
        });
        
        console.log('Tipos de lugares cargados:', data.total_tipos);
    } catch (error) {
        console.error('Error cargando tipos de lugares:', error);
        showNotification('Error cargando tipos de lugares', 'error');
    }
}

// Cambiar tipo de búsqueda
function switchSearchType() {
    const searchType = document.querySelector('input[name="searchType"]:checked').value;
    
    // Ocultar todos los paneles
    document.querySelectorAll('.search-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Mostrar el panel correspondiente
    const panelId = searchType + 'Search';
    document.getElementById(panelId).classList.add('active');
    
    currentSearchType = searchType;
}

// Buscar recursos cerca de un tipo de lugar
async function searchByPlace() {
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
                
                const response = await fetch(`/api/recursos-cerca-lugares?lat=${savedLocation.lat}&lon=${savedLocation.lon}&tipo_lugar=${placeType}&radio=${radius}`);
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
            
            const response = await fetch(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=${placeType}&radio=${radius}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            displaySearchResults(data, 'place', { lat, lon, radius });
            
        } catch (error) {
            console.error('Error en búsqueda por lugar:', error);
            showNotification(`Error: ${error.message}`, 'error');
        }
    };
    
    // Guardar referencia al handler y agregar listener temporal
    currentClickHandler = clickHandler;
    map.on('click', clickHandler);
}

// Buscar recursos cerca de coordenadas específicas
async function searchByCoordinates() {
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
        showNotification(`Buscando recursos en un radio de ${radius} km...`, 'info');
        
        const response = await fetch(`/api/recursos-cerca-coordenadas?lat=${lat}&lon=${lon}&radio=${radius}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        displaySearchResults(data, 'coordinates', { lat, lon, radius });
        
    } catch (error) {
        console.error('Error en búsqueda por coordenadas:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Buscar recursos cerca de una dirección
async function searchByAddress() {
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
        showNotification(`Geocodificando dirección y buscando recursos en un radio de ${radius} km...`, 'info');
        
        const response = await fetch(`/api/recursos-cerca-direccion?direccion=${encodeURIComponent(address)}&radio=${radius}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        displaySearchResults(data, 'address', { 
            lat: data.coordenadas_encontradas.lat, 
            lon: data.coordenadas_encontradas.lon, 
            radius,
            address: data.direccion_buscada
        });
        
    } catch (error) {
        console.error('Error en búsqueda por dirección:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Usar ubicación actual
function useCurrentLocation() {
    if (!navigator.geolocation) {
        showNotification('Geolocalización no soportada por este navegador', 'error');
        return;
    }
    
    showNotification('Obteniendo ubicación actual...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
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
            document.getElementById('coordLat').value = lat.toFixed(6);
            document.getElementById('coordLon').value = lon.toFixed(6);
            
            // Centrar el mapa en la ubicación actual
            map.setView([lat, lon], 15);
            
            // Actualizar el botón para mostrar que ahora hay una ubicación guardada
            updateLocationButton();
            
            // Actualizar también los botones de ubicación guardada
            updateSavedLocationButtons();
            
            showNotification('Ubicación actual obtenida y guardada', 'success');
        },
        (error) => {
            console.error('Error obteniendo ubicación:', error);
            showNotification('Error obteniendo ubicación actual', 'error');
        }
    );
}

// Usar ubicación guardada
function useSavedLocation() {
    const savedLocation = getSavedLocation();
    if (!savedLocation) {
        showNotification('No hay ubicación guardada. Usa "Obtener Ubicación Actual" primero.', 'error');
        return;
    }
    
    // Actualizar los campos de coordenadas
    document.getElementById('coordLat').value = savedLocation.lat.toFixed(6);
    document.getElementById('coordLon').value = savedLocation.lon.toFixed(6);
    
    // Centrar el mapa en la ubicación guardada
    map.setView([savedLocation.lat, savedLocation.lon], 15);
    
    showNotification('Ubicación guardada restaurada', 'success');
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
    const button = document.getElementById('useCurrentLocation');
    const statusDiv = document.getElementById('locationStatus');
    const statusText = document.getElementById('locationStatusText');
    const savedLocation = getSavedLocation();
    if (savedLocationbutton==true) {
        savedLocation=null;
    }
    
    if (savedLocation) {
        button.textContent = '📍 Borrar Ubicación Guardada';
        button.title = `Ubicación guardada: ${savedLocation.lat.toFixed(4)}, ${savedLocation.lon.toFixed(4)}`;
        button.onclick = useSavedLocation;
        savedLocationbutton = true;
        // Mostrar indicador de ubicación guardada
        if (statusDiv && statusText) {
            statusText.textContent = `📍 Ubicación guardada: ${savedLocation.lat.toFixed(4)}, ${savedLocation.lon.toFixed(4)}`;
            statusDiv.style.display = 'block';
        }
    } else {
        button.textContent = '📍 Obtener Ubicación Actual';
        button.title = 'Obtener tu ubicación actual usando GPS';
        button.onclick = useCurrentLocation;
        savedLocationbutton = false;
        // Ocultar indicador de ubicación guardada
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    }
    
    // Actualizar botones de ubicación guardada en todos los paneles
    updateSavedLocationButtons();
}

// Actualizar botones de ubicación guardada en todos los paneles
function updateSavedLocationButtons() {
    const savedLocation = getSavedLocation();
    const buttons = [
        'useSavedLocationPlace',
        'useSavedLocationAddress',
        'useSavedLocationZone'
    ];
    
    console.log('Actualizando botones de ubicación guardada...', savedLocation);
    
    buttons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        console.log(`Botón ${buttonId}:`, button);
        
        if (button) {
            // Limpiar estilos anteriores
            button.style.display = '';
            button.style.opacity = '';
            button.style.pointerEvents = '';
            
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
        
        const response = await fetch(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=${placeType}&radio=${radius}`);
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
    // Limpiar búsquedas anteriores
    clearSearchResults();
    
    currentSearchData = data;
    currentSearchType = searchType;
    
    // Crear capas para los resultados
    searchLayer = L.layerGroup();
    placesLayer = L.layerGroup();
    
    const { lat, lon, radius } = searchParams;
    
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
            
            const distancia = recurso.distancia_a_lugar_km || recurso.distancia_a_direccion_km || recurso.distancia_km || 0;
            
            marker.bindPopup(`
                <div style="max-width: 300px;">
                    <h4>🔧 ${recurso.Name || 'Sin nombre'}</h4>
                    <p><strong>Nº:</strong> ${recurso.No_}</p>
                    <p><strong>Distancia:</strong> ${distancia.toFixed(2)} km</p>
                    <p><strong>Estado:</strong> ${recurso.tiene_incidencia && recurso.total_incidencias > 0 ? '🚨 Con incidencias' : recurso.total_campanas > 0 ? '📋 Con campañas' : '✅ Sin problemas'}</p>
                    <p><strong>Campañas:</strong> ${recurso.total_campanas || 0}</p>
                    <p><strong>Incidencias:</strong> ${recurso.total_incidencias || 0}</p>
                </div>
            `);
            
            searchLayer.addLayer(marker);
        });
    }
    
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
    
    showNotification(
        `✓ Búsqueda completada: ${lugaresCount} lugares, ${recursosCount} recursos encontrados`,
        'success'
    );
}

// Limpiar resultados de búsqueda
function clearSearchResults() {
    if (searchLayer) {
        try {
            map.removeLayer(searchLayer);
        } catch (error) {
            console.warn('Error removiendo capa de búsqueda:', error);
        }
        searchLayer = null;
    }
    if (placesLayer) {
        try {
            map.removeLayer(placesLayer);
        } catch (error) {
            console.warn('Error removiendo capa de lugares:', error);
        }
        placesLayer = null;
    }
    if (radiusCircle) {
        try {
            map.removeLayer(radiusCircle);
        } catch (error) {
            console.warn('Error removiendo círculo de radio:', error);
        }
        radiusCircle = null;
    }
    currentSearchData = null;
    currentSearchType = null;
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
                    response = await fetch(`/api/recursos-cerca-coordenadas?lat=${lat}&lon=${lon}&radio=${searchRadius}`);
                    data = await response.json();
                    displaySearchResults(data, 'coordinates', { lat, lon, radius: searchRadius });
                    break;
                    
                case '2':
                    // Búsqueda por hospitales
                    response = await fetch(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=hospital&radio=${searchRadius}`);
                    data = await response.json();
                    displaySearchResults(data, 'place', { lat, lon, radius: searchRadius });
                    break;
                    
                case '3':
                    // Búsqueda por farmacias
                    response = await fetch(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=pharmacy&radio=${searchRadius}`);
                    data = await response.json();
                    displaySearchResults(data, 'place', { lat, lon, radius: searchRadius });
                    break;
                    
                case '4':
                    // Búsqueda por gasolineras
                    response = await fetch(`/api/recursos-cerca-lugares?lat=${lat}&lon=${lon}&tipo_lugar=gas_station&radio=${searchRadius}`);
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
    const select = document.getElementById('zoneSelect');
    if (!select) return;
    
    // Limpiar opciones existentes
    select.innerHTML = '<option value="">Seleccionar zona...</option>';
    
    // Agregar zonas
    customZones.forEach((zone, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = zone.name;
        select.appendChild(option);
    });
    
    // Actualizar botones de edición/eliminación
    updateZoneButtons();
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
    const modal = document.getElementById('zoneModal');
    const title = document.getElementById('zoneModalTitle');
    const nameInput = document.getElementById('zoneName');
    const descInput = document.getElementById('zoneDescription');
    
    if (modal && title && nameInput && descInput) {
        currentZone = null;
        title.textContent = 'Crear Nueva Zona';
        nameInput.value = '';
        descInput.value = '';
        
        // Limpiar dibujo anterior
        clearZoneDrawing();
        
        modal.style.display = 'flex';
    }
}

// Cerrar modal de zona
function closeZoneModal() {
    const modal = document.getElementById('zoneModal');
    if (modal) {
        modal.style.display = 'none';
        clearZoneDrawing();
        currentZone = null;
    }
}

// Editar zona seleccionada
function editZone() {
    const select = document.getElementById('zoneSelect');
    if (!select || select.value === '') return;
    
    const zoneIndex = parseInt(select.value);
    const zone = customZones[zoneIndex];
    
    if (zone) {
        currentZone = zoneIndex;
        const modal = document.getElementById('zoneModal');
        const title = document.getElementById('zoneModalTitle');
        const nameInput = document.getElementById('zoneName');
        const descInput = document.getElementById('zoneDescription');
        
        if (modal && title && nameInput && descInput) {
            title.textContent = 'Editar Zona';
            nameInput.value = zone.name;
            descInput.value = zone.description || '';
            
            // Mostrar la zona en el mapa
            showZoneOnMap(zone);
            
            modal.style.display = 'flex';
        }
    }
}

// Eliminar zona seleccionada
function deleteZone() {
    const select = document.getElementById('zoneSelect');
    if (!select || select.value === '') return;
    
    const zoneIndex = parseInt(select.value);
    const zone = customZones[zoneIndex];
    
    if (zone && confirm(`¿Estás seguro de que quieres eliminar la zona "${zone.name}"?`)) {
        customZones.splice(zoneIndex, 1);
        saveCustomZones();
        updateZoneSelector();
        removeZoneFromMap(zone);
        showNotification(`Zona "${zone.name}" eliminada`, 'success');
    }
}

// Manejar selección de zona
function onZoneSelect() {
    updateZoneButtons();
    
    const select = document.getElementById('zoneSelect');
    if (select && select.value !== '') {
        const zoneIndex = parseInt(select.value);
        const zone = customZones[zoneIndex];
        if (zone) {
            showZoneOnMap(zone);
        }
    } else {
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
    
    if (startBtn) startBtn.disabled = true;
    if (finishBtn) finishBtn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
    
    console.log('✅ Botones actualizados');
    
    // Cambiar cursor
    map.getContainer().style.cursor = 'crosshair';
    console.log('✅ Cursor cambiado a crosshair');
    
    // Mostrar notificación
    showNotification('Haz clic en el mapa para dibujar la zona. Doble clic para finalizar.', 'info');
    
    // Configurar listener de clic
    const clickHandler = (e) => {
        console.log('🖱️ Click detectado en el mapa');
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
        if (!isDrawingZone) {
            console.log('⚠️ Dibujo no activo, ignorando doble click');
            return;
        }
        finishZoneDrawing();
    };
    
    // Remover listeners anteriores si existen
    if (currentClickHandler) {
        map.off('click', currentClickHandler);
    }
    if (map._zoneDblClickHandler) {
        map.off('dblclick', map._zoneDblClickHandler);
    }
    
    // Agregar nuevos listeners
    map.on('click', clickHandler);
    map.on('dblclick', dblClickHandler);
    
    console.log('✅ Listeners de click configurados');
    
    // Guardar handlers para poder removerlos
    currentClickHandler = clickHandler;
    map._zoneDblClickHandler = dblClickHandler;
    
    console.log('🎨 Dibujo de zona iniciado correctamente');
}

// Finalizar dibujo de zona
function finishZoneDrawing() {
    if (!isDrawingZone || zonePoints.length < 2) {
        showNotification('Necesitas al menos 2 puntos para crear una zona', 'error');
        return;
    }
    
    isDrawingZone = false;
    
    // Actualizar botones
    document.getElementById('startDrawing').disabled = false;
    document.getElementById('finishDrawing').disabled = true;
    document.getElementById('clearDrawing').disabled = false;
    document.getElementById('saveZone').disabled = false;
    
    // Restaurar cursor
    map.getContainer().style.cursor = '';
    
    // Remover listeners
    if (currentClickHandler) {
        map.off('click', currentClickHandler);
        currentClickHandler = null;
    }
    if (map._zoneDblClickHandler) {
        map.off('dblclick', map._zoneDblClickHandler);
        map._zoneDblClickHandler = null;
    }
    
    showNotification('Zona dibujada. Puedes guardarla o limpiar para empezar de nuevo.', 'success');
}

// Limpiar dibujo de zona
function clearZoneDrawing() {
    isDrawingZone = false;
    zonePoints = [];
    
    // Actualizar botones
    document.getElementById('startDrawing').disabled = false;
    document.getElementById('finishDrawing').disabled = true;
    document.getElementById('clearDrawing').disabled = true;
    document.getElementById('saveZone').disabled = true;
    
    // Restaurar cursor
    map.getContainer().style.cursor = '';
    
    // Remover listeners
    if (currentClickHandler) {
        map.off('click', currentClickHandler);
        currentClickHandler = null;
    }
    if (map._zoneDblClickHandler) {
        map.off('dblclick', map._zoneDblClickHandler);
        map._zoneDblClickHandler = null;
    }
    
    // Limpiar capa de dibujo
    if (zoneDrawingLayer) {
        map.removeLayer(zoneDrawingLayer);
        zoneDrawingLayer = null;
    }
}

// Actualizar visualización del dibujo de zona
function updateZoneDrawing() {
    if (zonePoints.length === 0) return;
    
    // Limpiar capa anterior
    if (zoneDrawingLayer) {
        map.removeLayer(zoneDrawingLayer);
    }
    
    // Crear nueva capa
    zoneDrawingLayer = L.layerGroup();
    
    // Agregar puntos
    zonePoints.forEach((point, index) => {
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
    
    zoneDrawingLayer.addTo(map);
}

// Guardar zona
function saveZone() {
    const nameInput = document.getElementById('zoneName');
    const descInput = document.getElementById('zoneDescription');
    const typeInput = document.querySelector('input[name="zoneType"]:checked');
    
    if (!nameInput || !descInput || !typeInput) return;
    
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const type = typeInput.value;
    
    if (!name) {
        showNotification('Por favor introduce un nombre para la zona', 'error');
        return;
    }
    
    if (zonePoints.length < 2) {
        showNotification('Necesitas dibujar una zona primero', 'error');
        return;
    }
    
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
    
    // Guardar o actualizar zona
    if (currentZone !== null) {
        customZones[currentZone] = zone;
        showNotification(`Zona "${name}" actualizada`, 'success');
    } else {
        customZones.push(zone);
        showNotification(`Zona "${name}" creada`, 'success');
    }
    
    // Guardar en localStorage
    saveCustomZones();
    
    // Actualizar interfaz
    updateZoneSelector();
    clearZoneDrawing();
    closeZoneModal();
    
    // Mostrar zona en el mapa
    showZoneOnMap(zone);
}

// Mostrar zona en el mapa
function showZoneOnMap(zone) {
    // Limpiar zona anterior
    clearZoneFromMap();
    
    if (!zone || !zone.points || zone.points.length < 2) return;
    
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
    
    // Ajustar vista para mostrar la zona
    const group = new L.featureGroup([polygon]);
    if (group.getBounds().isValid()) {
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Limpiar zona del mapa
function clearZoneFromMap() {
    if (zoneLayer) {
        map.removeLayer(zoneLayer);
        zoneLayer = null;
    }
}

// Remover zona específica del mapa
function removeZoneFromMap(zone) {
    // Esta función se puede expandir si necesitas remover zonas específicas
    clearZoneFromMap();
}

// Buscar recursos en zona
async function searchByZone() {
    const select = document.getElementById('zoneSelect');
    const radius = parseFloat(document.getElementById('zoneRadius').value);
    
    if (!select || select.value === '') {
        showNotification('Por favor selecciona una zona', 'error');
        return;
    }
    
    if (!radius || radius <= 0 || radius > 50) {
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }
    
    const zoneIndex = parseInt(select.value);
    const zone = customZones[zoneIndex];
    
    if (!zone || !zone.points || zone.points.length < 2) {
        showNotification('Zona no válida', 'error');
        return;
    }
    
    try {
        showNotification(`Buscando recursos en zona "${zone.name}"...`, 'info');
        
        // Obtener todos los recursos
        const response = await fetch('/api/recursos');
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
        
    } catch (error) {
        console.error('Error en búsqueda por zona:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Mostrar resultados de búsqueda por zona
function displayZoneSearchResults(recursos, zone, radius) {
    // Limpiar búsquedas anteriores
    clearSearchResults();
    
    // Crear capas para los resultados
    searchLayer = L.layerGroup();
    
    // Mostrar la zona
    showZoneOnMap(zone);
    
    // Mostrar recursos encontrados
    if (recursos.length > 0) {
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
            
            marker.bindPopup(`
                <div style="max-width: 300px;">
                    <h4>🔧 ${recurso.Name || 'Sin nombre'}</h4>
                    <p><strong>Nº:</strong> ${recurso.No_}</p>
                    <p><strong>Distancia a zona:</strong> ${recurso.distancia_a_zona_km} km</p>
                    <p><strong>Estado:</strong> ${recurso.tiene_incidencia && recurso.total_incidencias > 0 ? '🚨 Con incidencias' : recurso.total_campanas > 0 ? '📋 Con campañas' : '✅ Sin problemas'}</p>
                    <p><strong>Campañas:</strong> ${recurso.total_campanas || 0}</p>
                    <p><strong>Incidencias:</strong> ${recurso.total_incidencias || 0}</p>
                </div>
            `);
            
            searchLayer.addLayer(marker);
        });
    }
    
    // Agregar capa al mapa
    searchLayer.addTo(map);
    
    // Mostrar resumen
    showNotification(
        `✓ Búsqueda en zona completada: ${recursos.length} recursos encontrados en "${zone.name}"`,
        'success'
    );
}

// Función auxiliar para verificar si un punto está dentro de un polígono
function isPointInPolygon(point, polygon) {
    const x = point[0], y = point[1];
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

// Función auxiliar para obtener el centro de un polígono
function getPolygonCenter(points) {
    let lat = 0, lon = 0;
    points.forEach(point => {
        lat += point[0];
        lon += point[1];
    });
    return [lat / points.length, lon / points.length];
}

// Función auxiliar para redondear números
function round(num, decimals) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
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
