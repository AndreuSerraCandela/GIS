// JavaScript para la aplicación GIS Web App

// Inicializar el mapa
let map;
let geoData = [];
let recursosLayer = null;
let mobiliarioLayer = null;

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
                } else if (recurso.campañas && recurso.campañas.length > 0) {
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
            
            let tooltipContent = `
                <div style="max-width: 350px; max-height: 400px; overflow-y: auto; padding: 5px;">
                    <h4>🔧 Recurso: ${recurso.Name || 'Sin nombre'}</h4>
                    <p><strong>Nº:</strong> ${recurso.No_}</p>
                    <p><strong>Coordenadas:</strong> ${recurso.PuntoX}, ${recurso.PuntoY}</p>
                    <p><strong>Estado:</strong> ${recurso.tiene_incidencia && recurso.total_incidencias > 0 ? '🚨 Con incidencias' : (recurso.campañas && recurso.campañas.length > 0) ? '📋 Con campañas' : '✅ Sin problemas'}</p>
                    <p><strong>Total campañas:</strong> ${recurso.campañas ? recurso.campañas.length : 0}</p>
                    <p><strong>Total incidencias:</strong> ${recurso.total_incidencias}</p>
            `;
            
            if (recurso.campañas && recurso.campañas.length > 0) {
                tooltipContent += `<h5>📋 Campañas (${recurso.campañas.length}):</h5>`;
                recurso.campañas.forEach((campana, index) => {
                    tooltipContent += `<div style="margin-bottom: 8px; padding: 5px; background-color: #f8f9fa; border-left: 3px solid #007bff;">`;
                    tooltipContent += `<strong>Campaña ${index + 1}:</strong><br>`;
                    if (campana.Campaña) {
                        tooltipContent += `<strong>Campaña:</strong> ${campana.Campaña}<br>`;
                    }
                    if (campana.Inicio) {
                        tooltipContent += `<strong>Inicio:</strong> ${campana.Inicio}<br>`;
                    }
                    if (campana.Fin) {
                        tooltipContent += `<strong>Fin:</strong> ${campana.Fin}<br>`;
                    }
                    if (campana['Nº Incidencia']) {
                        tooltipContent += `<strong>Nº Incidencia:</strong> ${campana['Nº Incidencia']}<br>`;
                    }
                    tooltipContent += `</div>`;
                });
            } else {
                tooltipContent += `<p><em>No hay campañas asociadas</em></p>`;
            }
            
            if (recurso.incidencias && recurso.incidencias.length > 0) {
                tooltipContent += `<h5>🚨 Incidencias (${recurso.incidencias.length}):</h5>`;
                
                // Agrupar incidencias por tipo
                const incidenciasPorTipo = {};
                recurso.incidencias.forEach(incidencia => {
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
                    const desde = fechas.length > 0 ? fechas[0] : 'Sin fecha';
                    const hasta = fechas.length > 0 ? fechas[fechas.length - 1] : 'Sin fecha';
                    
                    tooltipContent += `<div style="margin-bottom: 8px; padding: 5px; background-color: #fff3cd; border-left: 3px solid #ffc107;">`;
                    tooltipContent += `<strong>Tipo:</strong> ${tipo}<br>`;
                    tooltipContent += `<strong>Cantidad:</strong> ${incidenciasTipo.length}<br>`;
                    tooltipContent += `<strong>Desde:</strong> ${desde}<br>`;
                    tooltipContent += `<strong>Hasta:</strong> ${hasta}<br>`;
                    tooltipContent += `</div>`;
                });
            }
            
            tooltipContent += `</div>`;
            
            marker.bindPopup(tooltipContent);
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
                    
                    <!-- Street View Simple -->
                    <div style="margin: 10px 0; text-align: center;">
                        <h5 style="margin: 5px 0; font-size: 14px;">🌍 Vista de la Calle</h5>
                        <iframe 
                            width="320" 
                            height="150" 
                            frameborder="0" 
                            style="border: 1px solid #ccc; border-radius: 5px;"
                            src="https://www.google.com/maps/embed/v1/streetview?key=AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno&location=${mobiliario.PuntoY},${mobiliario.PuntoX}&heading=0&pitch=0&fov=90"
                            allowfullscreen>
                        </iframe>
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
                            <p><strong>Coordenadas:</strong> ${mobiliario.PuntoX}, ${mobiliario.PuntoY}</p>
                            ${mobiliario.geocodificado ? '<p><strong>📍 Ubicación:</strong> <em>Geocodificada desde dirección de Mallorca</em></p>' : ''}
                            ${mobiliario.Dirección ? `<p><strong>Dirección (Mallorca):</strong> ${mobiliario.Dirección}</p>` : ''}
                            <p><strong>Estado:</strong> ${mobiliario.tiene_incidencia ? '⚠️ Con incidencias' : '✅ Sin incidencias'}</p>
                            <p><strong>Total incidencias:</strong> ${data.total_incidencias || 0}</p>
                            
                            <!-- Street View -->
                            <div style="margin: 10px 0; text-align: center;">
                                <h5>🌍 Vista de la Calle</h5>
                                <iframe 
                                    width="350" 
                                    height="200" 
                                    frameborder="0" 
                                    style="border: 1px solid #ccc; border-radius: 5px;"
                                    src="https://www.google.com/maps/embed/v1/streetview?key=AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno&location=${mobiliario.PuntoY},${mobiliario.PuntoX}&heading=0&pitch=0&fov=90"
                                    allowfullscreen>
                                </iframe>
                                <p style="font-size: 12px; color: #666; margin-top: 5px;">
                                    <a href="https://www.google.com/maps/@${mobiliario.PuntoY},${mobiliario.PuntoX},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s0x0:0x0!2zM${mobiliario.PuntoY},${mobiliario.PuntoX}" 
                                       target="_blank" 
                                       style="color: #007bff; text-decoration: none;">
                                        🔗 Abrir en Google Maps
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
                            const desde = fechas.length > 0 ? fechas[0] : 'Sin fecha';
                            const hasta = fechas.length > 0 ? fechas[fechas.length - 1] : 'Sin fecha';
                            
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
                    const errorTooltip = `
                        <div style="max-width: 300px; padding: 10px;">
                            <h4>🪑 ${mobiliario.Descripción || 'Sin descripción'}</h4>
                            <p><strong>Nº Emplazamiento:</strong> ${mobiliario['Nº Emplazamiento']}</p>
                            <p><strong>Estado:</strong> ${mobiliario.tiene_incidencia ? '⚠️ Con incidencias' : '✅ Sin incidencias'}</p>
                            <p><strong>Total incidencias:</strong> ${mobiliario.total_incidencias}</p>
                            <p style="color: red;"><em>Error cargando detalles de incidencias</em></p>
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
                if (layer.getLatLng) {
                    bounds.extend(layer.getLatLng());
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
                if (layer.getLatLng) {
                    bounds.extend(layer.getLatLng());
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
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    console.log(`Mostrando ${geoJsonData.features.length} elementos en el mapa`);
}

// Limpiar el mapa
function clearMap() {
    // Remover capas específicas
    if (recursosLayer) {
        map.removeLayer(recursosLayer);
        recursosLayer = null;
    }
    if (mobiliarioLayer) {
        map.removeLayer(mobiliarioLayer);
        mobiliarioLayer = null;
    }
    
    // Remover cualquier otra capa que no sea la base
    map.eachLayer(function(layer) {
        if (layer !== map && layer !== map._layers[Object.keys(map._layers)[0]]) {
            map.removeLayer(layer);
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
    
    // Event listeners para los botones
    document.getElementById('loadAllData').addEventListener('click', loadAllGeoData);
    document.getElementById('loadRecursos').addEventListener('click', loadRecursos);
    document.getElementById('loadMobiliario').addEventListener('click', loadMobiliario);
    document.getElementById('clearMap').addEventListener('click', clearMap);
    
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

// Exportar funciones para uso global
window.GISApp = {
    loadAllGeoData,
    loadRecursos,
    loadMobiliario,
    clearMap,
    showNotification,
    map
};
