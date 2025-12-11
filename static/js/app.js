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
        </div>
    `;
    
    // Usar tooltip simple inicialmente
    marker.bindPopup(simpleTooltip);
    
    // Crear tooltip completo solo cuando se necesite
    marker.on('click', async function() {
        console.log(`🖱️ Click en recurso: ${recurso.No_}`);
        
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
            const urlDetalles = `/api/recursos/${recurso.No_}/detalles`;
            console.log(`📡 URL de petición detalles: ${urlDetalles}`);
            
            // Obtener fechas para filtrar campañas
            const fechaDesde = document.getElementById('fechaDesde')?.value || '';
            const fechaHasta = document.getElementById('fechaHasta')?.value || '';
            const empresa = recurso.Empresa || '';
            
            console.log(`📅 Fechas para filtrar campañas: desde=${fechaDesde}, hasta=${fechaHasta}, empresa=${empresa}`);
            
            // Construir URL para campañas con filtros
            let urlCampanas = '/api/campanas?';
            const paramsCampanas = new URLSearchParams();
            paramsCampanas.append('no_recurso', recurso.No_);
            if (fechaDesde) paramsCampanas.append('fecha_desde', fechaDesde);
            if (fechaHasta) paramsCampanas.append('fecha_hasta', fechaHasta);
            if (empresa) paramsCampanas.append('empresa', empresa);
            urlCampanas += paramsCampanas.toString();
            
            console.log(`📡 URL de petición campañas: ${urlCampanas}`);
            console.log(`📡 Iniciando petición a /api/campanas...`);
            
            // Cargar detalles e incidencias
            const responseDetalles = await fetch(urlDetalles);
            console.log(`📡 Respuesta detalles recibida:`, responseDetalles.status, responseDetalles.statusText);
            
            if (!responseDetalles.ok) {
                throw new Error(`Error al cargar detalles: ${responseDetalles.status}`);
            }
            
            // Cargar detalles e incidencias primero
            const dataDetalles = await responseDetalles.json();
            console.log(`📊 Datos de detalles recibidos:`, dataDetalles);
            
            // Cargar campañas con filtros
            console.log(`📡 Iniciando fetch a: ${urlCampanas}`);
            let responseCampanas;
            try {
                responseCampanas = await fetch(urlCampanas);
                console.log(`📡 Respuesta campañas recibida:`, responseCampanas.status, responseCampanas.statusText);
            } catch (fetchError) {
                console.error(`❌ Error en fetch de campañas:`, fetchError);
                throw fetchError;
            }
            
            let dataCampanas = { datos: [], total_registros: 0 };
            
            if (responseCampanas.ok) {
                try {
                    dataCampanas = await responseCampanas.json();
                    console.log(`✅ Campañas parseadas correctamente:`, dataCampanas);
                } catch (jsonError) {
                    console.error(`❌ Error parseando JSON de campañas:`, jsonError);
                    const textResponse = await responseCampanas.text();
                    console.error(`❌ Respuesta de texto:`, textResponse);
                }
            } else {
                console.warn(`⚠️ Error al cargar campañas: ${responseCampanas.status}`);
                const errorText = await responseCampanas.text();
                console.warn(`⚠️ Mensaje de error:`, errorText);
            }
            
            console.log(`📊 Campañas recibidas:`, dataCampanas);
            console.log(`📊 Total campañas:`, dataCampanas.total_registros || 0);
            console.log(`📊 Longitud array campañas:`, dataCampanas.datos ? dataCampanas.datos.length : 0);
            
            if (dataCampanas.datos && dataCampanas.datos.length > 0) {
                console.log(`📊 Primera campaña ejemplo:`, dataCampanas.datos[0]);
                console.log(`📊 Campos de la primera campaña:`, Object.keys(dataCampanas.datos[0]));
            } else {
                console.log(`⚠️ No hay datos de campañas en la respuesta`);
            }
            
            // Usar campañas de la API de campañas si están disponibles, sino usar las de detalles
            const campanas = dataCampanas.datos && dataCampanas.datos.length > 0 
                ? dataCampanas.datos 
                : (dataDetalles.campanas || []);
            const totalCampanas = dataCampanas.total_registros || dataDetalles.total_campanas || 0;
            
            let tooltipContent = `
                <div style="max-width: 400px; max-height: 500px; overflow-y: auto; padding: 5px;">
                    <h4>🔧 Recurso: ${recurso.Name || 'Sin nombre'}</h4>
                    <p><strong>Nº:</strong> ${recurso.No_}</p>
                    ${recurso['Tipo Recurso'] ? `<p><strong>Tipo de Recurso:</strong> ${recurso['Tipo Recurso']}</p>` : ''}
                    ${recurso.Empresa ? `<p><strong>Empresa:</strong> ${recurso.Empresa}</p>` : ''}
                    <p><strong>Estado:</strong> ${dataDetalles.total_incidencias > 0 ? '🚨 Con incidencias' : totalCampanas > 0 ? '📋 Con campañas' : '✅ Sin problemas'}</p>
                    <p><strong>Total campañas:</strong> ${totalCampanas}</p>
                    <p><strong>Total incidencias:</strong> ${dataDetalles.total_incidencias || 0}</p>
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
            
            // Mostrar campañas
            if (campanas && Array.isArray(campanas) && campanas.length > 0) {
                console.log(`📋 Mostrando ${campanas.length} campañas`);
                console.log(`📋 Estructura de campañas:`, campanas);
                tooltipContent += `<h5 style="margin-top: 15px; margin-bottom: 10px;">📋 Campañas (${campanas.length}):</h5>`;
                campanas.forEach((campana, index) => {
                    console.log(`📋 Procesando campaña ${index + 1}:`, campana);
                    tooltipContent += `<div style="margin-bottom: 10px; padding: 8px; background-color: #f8f9fa; border-left: 3px solid #007bff; border-radius: 4px;">`;
                    tooltipContent += `<strong style="color: #007bff; font-size: 1.05em;">Campaña ${index + 1}</strong><br><br>`;
                    
                    // Mostrar todos los campos disponibles para debugging
                    console.log(`📋 Campos de campaña ${index + 1}:`, Object.keys(campana));
                    
                    // Intentar con diferentes nombres de campos posibles
                    const nombreCampana = campana.Campaña || campana['Campaña'] || campana.campana || '';
                    const cliente = campana.Cliente || campana['Cliente'] || campana.cliente || '';
                    const inicio = campana.Inicio || campana['Inicio'] || campana.inicio || '';
                    const fin = campana.Fin || campana['Fin'] || campana.fin || '';
                    const noIncidencia = campana['Nº Incidencia'] || campana['Nº Incidencia'] || campana.no_incidencia || '';
                    
                    if (nombreCampana) {
                        tooltipContent += `<strong>📌 Nombre:</strong> ${nombreCampana}<br>`;
                    }
                    
                    if (cliente) {
                        tooltipContent += `<strong>👤 Cliente:</strong> ${cliente}<br>`;
                    }
                    
                    if (inicio) {
                        tooltipContent += `<strong>📅 Inicio:</strong> ${formatearFecha(inicio)}<br>`;
                    }
                    
                    if (fin) {
                        tooltipContent += `<strong>📅 Fin:</strong> ${formatearFecha(fin)}<br>`;
                    }
                    
                    // Calcular duración si hay fechas
                    if (inicio && fin) {
                        try {
                            const inicioDate = new Date(inicio);
                            const finDate = new Date(fin);
                            const diffTime = Math.abs(finDate - inicioDate);
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            tooltipContent += `<strong>⏱️ Duración:</strong> ${diffDays} día${diffDays !== 1 ? 's' : ''}<br>`;
                        } catch (e) {
                            console.warn(`⚠️ Error calculando duración:`, e);
                        }
                    }
                    
                    if (noIncidencia) {
                        tooltipContent += `<strong>🔢 Nº Incidencia:</strong> ${noIncidencia}<br>`;
                    }
                    
                    // Mostrar todos los campos adicionales que puedan existir
                    Object.keys(campana).forEach(key => {
                        const value = campana[key];
                        if (value && !['Campaña', 'Cliente', 'Inicio', 'Fin', 'Nº Incidencia', 'Nº Recurso'].includes(key)) {
                            tooltipContent += `<strong>${key}:</strong> ${value}<br>`;
                        }
                    });
                    
                    tooltipContent += `</div>`;
                });
            } else {
                console.log(`⚠️ No hay campañas o el array está vacío`);
                console.log(`⚠️ campanas:`, campanas);
                console.log(`⚠️ totalCampanas:`, totalCampanas);
                if (totalCampanas > 0 && (!campanas || campanas.length === 0)) {
                    tooltipContent += `<p style="color: orange;"><em>⚠️ Se reportan ${totalCampanas} campaña(s) pero no se pudieron cargar los detalles</em></p>`;
                } else {
                    tooltipContent += `<p><em>No hay campañas asociadas</em></p>`;
                }
            }
            
            if (dataDetalles.incidencias && dataDetalles.incidencias.length > 0) {
                tooltipContent += `<h5>🚨 Incidencias (${dataDetalles.incidencias.length}):</h5>`;
                
                // Agrupar incidencias por tipo
                const incidenciasPorTipo = {};
                dataDetalles.incidencias.forEach(incidencia => {
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
            
            // Log final para debugging
            console.log(`📋 Contenido final del tooltip (primeros 500 caracteres):`, tooltipContent.substring(0, 500));
            console.log(`📋 ¿Contiene "Campañas"?`, tooltipContent.includes('Campañas'));
            console.log(`📋 ¿Contiene "📋"?`, tooltipContent.includes('📋'));
            console.log(`📋 Longitud total del tooltip:`, tooltipContent.length);
            
            marker.setPopupContent(tooltipContent);
            
            // Forzar actualización del popup si está abierto
            if (marker.isPopupOpen()) {
                marker.openPopup();
            }
            
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
            
            // Usar función común para crear el popup
            crearPopupRecurso(marker, recurso);
            
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
    
    // Actualizar contador de seleccionados
    updateContadorSeleccionados();
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
                    
                    if (dataDetalles.incidencias && dataDetalles.incidencias.length > 0) {
                        tooltipContent += `<h5>🚨 Incidencias (${dataDetalles.incidencias.length}):</h5>`;
                        
                        // Agrupar incidencias por tipo
                        const incidenciasPorTipo = {};
                        dataDetalles.incidencias.forEach(incidencia => {
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
        
        // Obtener fechas si están seleccionadas
        const fechaDesde = document.getElementById('fechaDesde').value;
        const fechaHasta = document.getElementById('fechaHasta').value;
        
        // Construir URL con parámetros de fecha si existen
        let url = '/api/recursos';
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
    
    console.log('📍 Dirección:', address);
    console.log('📍 Radio:', radius);
    
    if (!address) {
        console.log('❌ No hay dirección introducida');
        showNotification('Por favor introduce una dirección', 'error');
        return;
    }
    
    if (!radius || radius <= 0 || radius > 50) {
        console.log('❌ Radio inválido');
        showNotification('Por favor introduce un radio válido entre 0.1 y 50 km', 'error');
        return;
    }
    
    console.log('✅ Validaciones pasadas, iniciando búsqueda...');
    
    try {
        showNotification(`Geocodificando dirección y buscando recursos en un radio de ${radius} km...`, 'info');
        
        const url = addFechasToUrl(`/api/recursos-cerca-direccion?direccion=${encodeURIComponent(address)}&radio=${radius}`);
        const response = await fetch(url);
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
        console.log('✅ Resultados mostrados');
        
    } catch (error) {
        console.error('❌ Error en búsqueda por dirección:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
    
    console.log('✅ Búsqueda por dirección completada');
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
