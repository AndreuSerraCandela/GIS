#!/usr/bin/env python3
"""
Proyecto GIS Web App - Sistema de Información Geográfica
Autor: Andreu
Fecha: 2025
"""

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import pyodbc
import json
import requests
import os
from config.database import get_db_connection
from config.api_keys import GEOCODING_SERVICES, SEARCH_CONFIG

# Función global para limpiar datos antes de serializar
def clean_data(data):
    """Limpia los datos para que sean serializables a JSON"""
    if isinstance(data, dict):
        return {k: clean_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_data(item) for item in data]
    elif isinstance(data, bytes):
        return data.decode('utf-8', errors='ignore') if data else None
    elif hasattr(data, 'isoformat'):  # datetime objects
        return data.isoformat()
    else:
        return data

def geocode_with_google_maps(parada, description, address):
    """
    Geocodifica usando Google Maps API (más preciso para paradas de autobús)
    
    Args:
        parada: Número de emplazamiento/parada
        description: Descripción del emplazamiento
        address: Dirección del emplazamiento
        
    Returns:
        tuple: (lat, lon) o (None, None) si no se encuentra
    """
    if not address or address.strip() == '':
        return None, None
    
    try:
        # Construir búsqueda específica para paradas de autobús
        search_terms = []
        
        if parada and description and description.strip():
            bus_stop_search = f"Bus stop {parada}- {description.strip()}"
            search_terms.append(bus_stop_search)
        
        #if address and address.strip():
         #   search_terms.append(address.strip())
        
        search_terms.append("Palma de Mallorca")
        full_search = ", ".join(search_terms)
        
        print(f"Buscando con Google Maps: {full_search}")
        
        # Usar Google Maps Geocoding API
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            'address': full_search,
            'key': GEOCODING_SERVICES['google_maps']['api_key'],
            'region': 'es',  # Priorizar España
            'components': 'country:ES|administrative_area:Islas Baleares'
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data['status'] == 'OK' and data['results']:
                location = data['results'][0]['geometry']['location']
                lat = location['lat']
                lon = location['lng']
                print(f"Google Maps geocodificación exitosa para parada {parada}: {lat}, {lon}")
                return lat, lon
            else:
                print(f"Google Maps error para parada {parada}: {data.get('status', 'Unknown error')} - {data.get('error_message', '')}")
                # Si la API key es inválida, deshabilitar Google Maps temporalmente
                if data.get('status') == 'REQUEST_DENIED':
                    print("API key de Google Maps inválida, deshabilitando temporalmente...")
                    GEOCODING_SERVICES['google_maps']['enabled'] = False
        else:
            print(f"Google Maps HTTP error para parada {parada}: {response.status_code}")
        
        return None, None
        
    except Exception as e:
        print(f"Error en geocodificación Google Maps para parada {parada}: {e}")
        return None, None

def geocode_with_bing_maps(parada, description, address):
    """
    Geocodifica usando Bing Maps API (alternativa gratuita)
    
    Args:
        parada: Número de emplazamiento/parada
        description: Descripción del emplazamiento
        address: Dirección del emplazamiento
        
    Returns:
        tuple: (lat, lon) o (None, None) si no se encuentra
    """
    if not address or address.strip() == '':
        return None, None
    
    try:
        # Construir búsqueda específica para paradas de autobús
        search_terms = []
        
        if parada and description and description.strip():
            bus_stop_search = f"Parada bus {parada}- {description.strip()}"
            search_terms.append(bus_stop_search)
        
        if address and address.strip():
            search_terms.append(address.strip())
        
        search_terms.append("Mallorca, Islas Baleares, España")
        full_search = ", ".join(search_terms)
        
        print(f"Buscando con Bing Maps: {full_search}")
        
        # Usar Bing Maps API
        url = "https://dev.virtualearth.net/REST/v1/Locations"
        params = {
            'q': full_search,
            'key': GEOCODING_SERVICES['bing_maps']['api_key'],
            'c': 'es',  # País España
            'maxResults': 1
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('resourceSets') and data['resourceSets'][0].get('resources'):
                location = data['resourceSets'][0]['resources'][0]['point']['coordinates']
                lat = location[0]  # Bing devuelve [lat, lon]
                lon = location[1]
                print(f"Bing Maps geocodificación exitosa para parada {parada}: {lat}, {lon}")
                return lat, lon
            else:
                print(f"Bing Maps no encontró resultados para parada {parada}")
                # Verificar si hay errores de autenticación
                if data.get('errorDetails'):
                    print(f"Bing Maps error: {data['errorDetails']}")
                    if 'InvalidCredentials' in str(data['errorDetails']):
                        print("API key de Bing Maps inválida, deshabilitando temporalmente...")
                        GEOCODING_SERVICES['bing_maps']['enabled'] = False
        else:
            print(f"Bing Maps HTTP error para parada {parada}: {response.status_code}")
        
        return None, None
        
    except Exception as e:
        print(f"Error en geocodificación Bing Maps para parada {parada}: {e}")
        return None, None



def geocode_with_photon(parada, description, address):
    """
    Usa Photon API (gratuito, basado en OpenStreetMap pero más preciso)
    """
    if not address or address.strip() == '':
        return None, None
    
    try:
        # Construir búsqueda
        search_terms = []
        
        if parada and description and description.strip():
            search_terms.append(f"Parada bus {parada}- {description.strip()}")
        
        if address and address.strip():
            search_terms.append(address.strip())
        
        search_terms.append("Mallorca, España")
        full_search = ", ".join(search_terms)
        
        print(f"Buscando con Photon: {full_search}")
        
        url = "https://photon.komoot.io/api"
        params = {
            'q': full_search,
            'limit': 5,
            'lat': 39.5696,  # Centro de Mallorca
            'lon': 2.6502,
            'radius': 50000  # 50km de radio
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('features'):
                # Buscar el resultado más relevante
                for feature in data['features']:
                    properties = feature.get('properties', {})
                    name = properties.get('name', '').lower()
                    city = properties.get('city', '').lower()
                    
                    if 'mallorca' in city or 'palma' in city:
                        coords = feature['geometry']['coordinates']
                        lon = coords[0]
                        lat = coords[1]
                        print(f"Photon geocodificación exitosa para parada {parada}: {lat}, {lon}")
                        return lat, lon
                
                # Si no encuentra específico de Mallorca, usar el primero
                coords = data['features'][0]['geometry']['coordinates']
                lon = coords[0]
                lat = coords[1]
                print(f"Photon geocodificación exitosa para parada {parada} (genérico): {lat}, {lon}")
                return lat, lon
        
        return None, None
        
    except Exception as e:
        print(f"Error en geocodificación Photon para parada {parada}: {e}")
        return None, None

def geocode_address(parada, description, address):
    """
    Geocodifica un emplazamiento usando múltiples estrategias
    Especializado para direcciones de Mallorca
    
    Args:
        parada: Número de emplazamiento/parada
        description: Descripción del emplazamiento
        address: Dirección del emplazamiento
        
    Returns:
        tuple: (lat, lon) o (None, None) si no se encuentra
    """
    if not address or address.strip() == '':
        return None, None
    
    # Estrategia 1: Google Maps (más preciso para paradas de autobús)
    if GEOCODING_SERVICES['google_maps']['enabled']:
        print(f"Intentando geocodificación con Google Maps para parada {parada}...")
        result = geocode_with_google_maps(parada, description, address)
        if result and result[0] and result[1]:
            return result
    
    # Estrategia 2: Base de datos local (más rápida y precisa)
    if result and result[0] and result[1]:
        return result
    
    # Estrategia 3: Photon API (gratuito, más preciso que Nominatim)
    print(f"Intentando geocodificación con Photon para parada {parada}...")
    result = geocode_with_photon(parada, description, address)
    if result and result[0] and result[1]:
        return result
    
    # Estrategia 4: Servicios configurados restantes
    services = sorted(GEOCODING_SERVICES.items(), key=lambda x: x[1]['priority'])
    
    for service_name, service_config in services:
        if not service_config['enabled'] or service_name == 'google_maps':
            continue
            
        print(f"Intentando geocodificación con {service_name}...")
        
        if service_name == 'bing_maps':
            result = geocode_with_bing_maps(parada, description, address)
        elif service_name == 'nominatim':
            result = geocode_with_nominatim(parada, description, address)
        else:
            continue
            
        if result and result[0] and result[1]:
            print(f"Geocodificación exitosa con {service_name} para parada {parada}")
            return result
    
    print(f"No se pudo geocodificar la parada {parada} con ningún servicio")
    return None, None

def geocode_with_nominatim(parada, description, address):
    """
    Geocodifica usando Nominatim (OpenStreetMap) con múltiples estrategias
    """
    if not address or address.strip() == '':
        return None, None
    
    try:
        # Estrategia 1: Búsqueda completa con parada
        if parada and description and description.strip():
            search_terms = [
                f"Parada bus {parada}- {description.strip()}",
                address.strip(),
                "Mallorca, Islas Baleares, España"
            ]
            full_search = ", ".join(search_terms)
            
            print(f"Estrategia 1 - Búsqueda completa: {full_search}")
            result = try_nominatim_search(full_search, parada)
            if result[0] and result[1]:
                return result
        
        # Estrategia 2: Solo descripción + dirección
        if description and description.strip() and address and address.strip():
            search_terms = [
                description.strip(),
                address.strip(),
                "Mallorca, España"
            ]
            full_search = ", ".join(search_terms)
            
            print(f"Estrategia 2 - Descripción + dirección: {full_search}")
            result = try_nominatim_search(full_search, parada)
            if result[0] and result[1]:
                return result
        
        # Estrategia 3: Solo dirección + Mallorca
        if address and address.strip():
            search_terms = [
                address.strip(),
                "Mallorca, España"
            ]
            full_search = ", ".join(search_terms)
            
            print(f"Estrategia 3 - Solo dirección: {full_search}")
            result = try_nominatim_search(full_search, parada)
            if result[0] and result[1]:
                return result
        
        # Estrategia 4: Búsqueda más simple
        if address and address.strip():
            simple_search = f"{address.strip()}, Mallorca"
            print(f"Estrategia 4 - Búsqueda simple: {simple_search}")
            result = try_nominatim_search(simple_search, parada)
            if result[0] and result[1]:
                return result
        
        print(f"No se pudo geocodificar la parada {parada} con Nominatim")
        return None, None
        
    except Exception as e:
        print(f"Error en geocodificación Nominatim para parada {parada}: {e}")
        return None, None

def try_nominatim_search(search_query, parada):
    """
    Intenta una búsqueda específica con Nominatim
    """
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': search_query,
            'format': 'json',
            'limit': 3,  # Obtener más resultados para mejor precisión
            'countrycodes': 'es',
            'addressdetails': 1,
            'bounded': 1,
            'viewbox': '2.5,39.3,3.2,39.9'
        }
        
        headers = {
            'User-Agent': 'GIS-WebApp/1.0'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                # Buscar el resultado más relevante
                for result in data:
                    display_name = result.get('display_name', '').lower()
                    if 'mallorca' in display_name or 'balear' in display_name:
                        lat = float(result['lat'])
                        lon = float(result['lon'])
                        print(f"Nominatim geocodificación exitosa para parada {parada}: {lat}, {lon}")
                        return lat, lon
                
                # Si no encuentra uno específico de Mallorca, usar el primero
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                print(f"Nominatim geocodificación exitosa para parada {parada} (resultado genérico): {lat}, {lon}")
                return lat, lon
        
        return None, None
        
    except Exception as e:
        print(f"Error en búsqueda Nominatim: {e}")
        return None, None

def update_mobiliario_coordinates(cursor, emplazamiento_id, lat, lon):
    """
    Actualiza las coordenadas de un emplazamiento en la base de datos
    
    Args:
        cursor: Cursor de la base de datos
        emplazamiento_id: ID del emplazamiento
        lat: Latitud
        lon: Longitud
    """
    try:
        # Primero verificar si el emplazamiento existe
        check_query = """
        SELECT COUNT(*) FROM [Malla Publicidad$Emplazamientos$4c3e28b8-7fe9-4a33-ad5d-d26cbf8f7765]
        WHERE [Tipo Emplazamiento] = 1 AND [Nº Emplazamiento] = ?
        """
        cursor.execute(check_query, (emplazamiento_id,))
        count = cursor.fetchone()[0]
        
        if count == 0:
            print(f"Emplazamiento {emplazamiento_id} no encontrado en la tabla principal")
            return False
        
        print(f"Emplazamiento {emplazamiento_id} encontrado, procediendo con la actualización...")
        
        # Query para actualizar las coordenadas en la tabla principal
        update_query = """
        UPDATE [Malla Publicidad$Emplazamientos$4c3e28b8-7fe9-4a33-ad5d-d26cbf8f7765]
        SET PuntoX = ?, PuntoY = ?
        WHERE [Tipo Emplazamiento] = 1 AND [Nº Emplazamiento] = ?
        """
        
        cursor.execute(update_query, (lon, lat, emplazamiento_id))
        
        # Verificar cuántas filas se actualizaron
        rows_affected = cursor.rowcount
        print(f"Filas actualizadas: {rows_affected}")
        
        if rows_affected > 0:
            print(f"Coordenadas actualizadas en BD para emplazamiento {emplazamiento_id}: {lon}, {lat}")
            return True
        else:
            print(f"No se actualizó ninguna fila para emplazamiento {emplazamiento_id}")
            return False
        
    except Exception as e:
        print(f"Error al actualizar coordenadas en BD para emplazamiento {emplazamiento_id}: {e}")
        return False

app = Flask(__name__)
CORS(app)

# Configuración de la base de datos
app.config['SQLALCHEMY_DATABASE_URI'] = 'mssql+pyodbc://SA:SA1234sa@192.168.10.190/Malla2009?driver=ODBC+Driver+17+for+SQL+Server'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

@app.route('/')
def index():
    """Página principal de la aplicación GIS"""
    return render_template('index.html')

@app.route('/api/geodata')
def get_geo_data():
    """API endpoint para obtener todos los datos geoespaciales de ambas vistas"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener datos de RecursosGis
        recursos_query = "SELECT * FROM RecursosGis"
        cursor.execute(recursos_query)
        recursos_results = cursor.fetchall()
        
        # Obtener datos de MobiliarioGis
        mobiliario_query = "SELECT * FROM MobiliarioGis"
        cursor.execute(mobiliario_query)
        mobiliario_results = cursor.fetchall()
        
        # Convertir resultados a formato GeoJSON
        features = []
        
        # Procesar RecursosGis
        for row in recursos_results:
            feature = {
                "type": "Feature",
                "properties": {
                    "tipo": "Recurso",
                    "data": dict(zip([column[0] for column in cursor.description], row))
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [0, 0]  # Se procesará según la estructura de datos
                }
            }
            features.append(feature)
        
        # Procesar MobiliarioGis
        for row in mobiliario_results:
            feature = {
                "type": "Feature",
                "properties": {
                    "tipo": "Mobiliario",
                    "data": dict(zip([column[0] for column in cursor.description], row))
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [0, 0]  # Se procesará según la estructura de datos
                }
            }
            features.append(feature)
        
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        
        cursor.close()
        conn.close()
        
        return jsonify(geojson)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/incidencias')
def get_incidencias():
    """API endpoint para obtener datos de Incidencias"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM Incidencias"
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Obtener nombres de columnas
        columns = [column[0] for column in cursor.description]
        
        # Convertir a lista de diccionarios
        data = []
        for row in results:
            row_dict = dict(zip(columns, row))
            data.append(clean_data(row_dict))
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "vista": "Incidencias",
            "total_registros": len(data),
            "datos": data
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/campanas')
def get_campanas():
    """API endpoint para obtener datos de Campañas"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM Campañas"
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Obtener nombres de columnas
        columns = [column[0] for column in cursor.description]
        
        # Convertir a lista de diccionarios
        data = []
        for row in results:
            row_dict = dict(zip(columns, row))
            data.append(clean_data(row_dict))
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "vista": "Campañas",
            "total_registros": len(data),
            "datos": data
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/recursos')
def get_recursos():
    """API endpoint específico para obtener datos de RecursosGis con incidencias y campañas"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query simplificada para obtener recursos básicos
        query = "SELECT [No_], [Name], [PuntoX], [PuntoY] FROM [dbo].[RecursosGis]"
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Obtener nombres de columnas
        columns = [column[0] for column in cursor.description]
        
        # Convertir a lista de diccionarios
        recursos_data = []
        for row in results:
            recurso = dict(zip(columns, row))
            recurso = clean_data(recurso)
            
            # Inicializar campos de incidencias
            recurso['tiene_incidencia'] = 0
            recurso['total_incidencias'] = 0
            recurso['campañas'] = []
            recurso['incidencias'] = []
            
            try:
                # Obtener campañas para este recurso
                campanas_query = "Select Distinct [Nº Recurso],Campaña,Inicio,Fin, MAX(Cliente) As cliente from Campañas WHERE [Nº Recurso] = ? group By [Nº Recurso],Campaña,Inicio,Fin"
                cursor.execute(campanas_query, (recurso['No_'],))
                campanas_results = cursor.fetchall()
                campanas_columns = [column[0] for column in cursor.description]
                campanas_data = [dict(zip(campanas_columns, row)) for row in campanas_results]
                recurso['campañas'] = clean_data(campanas_data)
            except Exception as e:
                print(f"Error al obtener campañas para recurso {recurso['No_']}: {e}")
                recurso['campañas'] = []
            
            try:
                # Obtener incidencias para este recurso
                incidencias_query = "SELECT * FROM [dbo].[Incidencias] WHERE [Nº Recurso] = ?"
                cursor.execute(incidencias_query, (recurso['No_'],))
                incidencias_results = cursor.fetchall()
                incidencias_columns = [column[0] for column in cursor.description]
                incidencias_data = [dict(zip(incidencias_columns, row)) for row in incidencias_results]
                recurso['incidencias'] = clean_data(incidencias_data)
                
                # Actualizar estado de incidencias
                recurso['total_incidencias'] = len(recurso['incidencias'])
                recurso['tiene_incidencia'] = 1 if recurso['total_incidencias'] > 0 else 0
                
            except Exception as e:
                print(f"Error al obtener incidencias para recurso {recurso['No_']}: {e}")
                recurso['incidencias'] = []
            
            recursos_data.append(recurso)
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "vista": "RecursosGis",
            "total_registros": len(recursos_data),
            "datos": recursos_data
        })
        
    except Exception as e:
        print(f"Error en endpoint /api/recursos: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/mobiliario')
def get_mobiliario():
    """API endpoint específico para obtener datos de MobiliarioGis con incidencias"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query simplificada para obtener mobiliario básico
        query = """
        SELECT 
            [Nº Emplazamiento],
            [Descripción],
            [Tipo],
            [Tipo Parada],
            [SAE],
            [Banco Madera],
            [ABA],
            [Zona Limpieza],
            [Operario],
            [Semoan],
            [PuntoX],
            [PuntoY],
            [Dirección],Incidencia
        FROM [dbo].[MobiliarioGis]
        """
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Obtener nombres de columnas
        columns = [column[0] for column in cursor.description]
        
        # Convertir a lista de diccionarios
        mobiliario_data = []
        for row in results:
            mobiliario = dict(zip(columns, row))
            mobiliario = clean_data(mobiliario)
            
            # Verificar si las coordenadas son 0 o nulas y geocodificar si es necesario
            if (mobiliario.get('PuntoX') == 0 or mobiliario.get('PuntoX') is None or 
                mobiliario.get('PuntoY') == 0 or mobiliario.get('PuntoY') is None):
                
                Dirección = mobiliario.get('Dirección', '')
                Descripción = mobiliario.get('Descripción', '')
                Parada = mobiliario.get('Nº Emplazamiento', '')
                if Dirección and Dirección.strip():
                    print(f"Geocodificando dirección para mobiliario {mobiliario['Nº Emplazamiento']}: {Dirección}")
                    lat, lon = geocode_address(Parada,Descripción,Dirección)
                    if lat and lon:
                        # Actualizar las coordenadas en la base de datos
                        if update_mobiliario_coordinates(cursor, mobiliario['Nº Emplazamiento'], lat, lon):
                            mobiliario['PuntoX'] = lon  # Longitud
                            mobiliario['PuntoY'] = lat  # Latitud
                            mobiliario['geocodificado'] = True
                            mobiliario['actualizado_bd'] = True
                            print(f"Coordenadas geocodificadas y actualizadas en BD: {lon}, {lat}")
                        else:
                            # Si no se puede actualizar en BD, usar las coordenadas temporalmente
                            mobiliario['PuntoX'] = lon
                            mobiliario['PuntoY'] = lat
                            mobiliario['geocodificado'] = True
                            mobiliario['actualizado_bd'] = False
                            print(f"Coordenadas geocodificadas (no actualizadas en BD): {lon}, {lat}")
                    else:
                        mobiliario['geocodificado'] = False
                        mobiliario['actualizado_bd'] = False
                        print(f"No se pudo geocodificar: {Dirección}")
                else:
                    mobiliario['geocodificado'] = False
                    mobiliario['actualizado_bd'] = False
                    print(f"No hay dirección para geocodificar: {mobiliario['Nº Emplazamiento']}")
            else:
                mobiliario['geocodificado'] = False
                mobiliario['actualizado_bd'] = False
            mobiliario['total_incidencias'] = mobiliario['Incidencia']
            mobiliario['tiene_incidencia'] = 1 if mobiliario['total_incidencias'] > 0 else 0
            # Solo obtener el conteo de incidencias (usando el campo Incidencia si existe)
            # try:
            #     # Intentar usar el campo Incidencia si existe en la vista
            #     incidencias_query = "SELECT COUNT(*) as total FROM [dbo].[Incidencias] WHERE [Emplazamiento] = ? and [Tipo] = 'Emplazamiento'"
            #     cursor.execute(incidencias_query, (mobiliario['Nº Emplazamiento'],))
            #     count_result = cursor.fetchone()
            #     mobiliario['total_incidencias'] = count_result[0] if count_result else 0
            #     mobiliario['tiene_incidencia'] = 1 if mobiliario['total_incidencias'] > 0 else 0
                
            # except Exception as e:
            #     print(f"Error al obtener conteo de incidencias para mobiliario {mobiliario['Nº Emplazamiento']}: {e}")
            #     mobiliario['total_incidencias'] = 0
            #     mobiliario['tiene_incidencia'] = 0
            
            mobiliario_data.append(mobiliario)
        
        # Hacer commit de todas las actualizaciones
        conn.commit()
        print("Cambios confirmados en la base de datos")
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "vista": "MobiliarioGis",
            "total_registros": len(mobiliario_data),
            "datos": mobiliario_data
        })
        
    except Exception as e:
        print(f"Error en endpoint /api/mobiliario: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/test-db')
def test_database():
    """Endpoint para probar la conexión a la base de datos"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Probar consulta simple
        cursor.execute("SELECT COUNT(*) as total FROM [dbo].[RecursosGis]")
        recursos_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) as total FROM [dbo].[MobiliarioGis]")
        mobiliario_count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "status": "OK",
            "message": "Conexión a la base de datos exitosa",
            "recursos_count": recursos_count,
            "mobiliario_count": mobiliario_count
        })
        
    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

@app.route('/api/test-geocoding/<parada>/<description>/<address>')
def test_geocoding(parada, description, address):
    """Endpoint de prueba para probar diferentes servicios de geocodificación"""
    try:
        results = {}
        
        # Probar cada servicio individualmente
        if GEOCODING_SERVICES['google_maps']['enabled']:
            print(f"Probando Google Maps para parada {parada}...")
            result = geocode_with_google_maps(parada, description, address)
            results['google_maps'] = {
                'success': result[0] is not None and result[1] is not None,
                'coordinates': {'lat': result[0], 'lon': result[1]} if result[0] and result[1] else None
            }
        
        if GEOCODING_SERVICES['bing_maps']['enabled']:
            print(f"Probando Bing Maps para parada {parada}...")
            result = geocode_with_bing_maps(parada, description, address)
            results['bing_maps'] = {
                'success': result[0] is not None and result[1] is not None,
                'coordinates': {'lat': result[0], 'lon': result[1]} if result[0] and result[1] else None
            }
        
        if GEOCODING_SERVICES['nominatim']['enabled']:
            print(f"Probando Nominatim para parada {parada}...")
            result = geocode_with_nominatim(parada, description, address)
            results['nominatim'] = {
                'success': result[0] is not None and result[1] is not None,
                'coordinates': {'lat': result[0], 'lon': result[1]} if result[0] and result[1] else None
            }
        
        return jsonify({
            "parada": parada,
            "description": description,
            "address": address,
            "results": results
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/test-update/<emplazamiento_id>')
def test_update_coordinates(emplazamiento_id):
    """Endpoint de prueba para actualizar coordenadas de un emplazamiento específico"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Coordenadas de prueba (Palma de Mallorca)
        test_lat = 39.5696
        test_lon = 2.6502
        
        print(f"Probando actualización para emplazamiento {emplazamiento_id}")
        
        # Intentar actualizar
        success = update_mobiliario_coordinates(cursor, emplazamiento_id, test_lat, test_lon)
        
        if success:
            conn.commit()
            print("Actualización de prueba confirmada")
            cursor.close()
            conn.close()
            return jsonify({
                "status": "success",
                "message": f"Coordenadas de prueba actualizadas para emplazamiento {emplazamiento_id}",
                "coordinates": {"lat": test_lat, "lon": test_lon}
            })
        else:
            cursor.close()
            conn.close()
            return jsonify({
                "status": "error",
                "message": f"No se pudo actualizar emplazamiento {emplazamiento_id}"
            }), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/geocoding-stats')
def geocoding_stats():
    """Endpoint para obtener estadísticas de geocodificación"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Contar mobiliario con coordenadas válidas
        cursor.execute("SELECT COUNT(*) FROM [dbo].[MobiliarioGis] WHERE PuntoX != 0 AND PuntoY != 0")
        con_coordenadas = cursor.fetchone()[0]
        
        # Contar mobiliario sin coordenadas
        cursor.execute("SELECT COUNT(*) FROM [dbo].[MobiliarioGis] WHERE PuntoX = 0 OR PuntoY = 0 OR PuntoX IS NULL OR PuntoY IS NULL")
        sin_coordenadas = cursor.fetchone()[0]
        
        # Contar mobiliario con dirección
        cursor.execute("SELECT COUNT(*) FROM [dbo].[MobiliarioGis] WHERE [Dirección] IS NOT NULL AND [Dirección] != ''")
        con_direccion = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "total_mobiliario": con_coordenadas + sin_coordenadas,
            "con_coordenadas": con_coordenadas,
            "sin_coordenadas": sin_coordenadas,
            "con_direccion": con_direccion,
            "geocodificables": min(sin_coordenadas, con_direccion)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/health')
def health_check():
    """Endpoint para verificar el estado de la aplicación"""
    return jsonify({"status": "OK", "message": "Aplicación GIS funcionando correctamente"})

@app.route('/api/test-incidencias/<emplazamiento_id>')
def test_incidencias(emplazamiento_id):
    """Endpoint de prueba para verificar incidencias"""
    try:
        print(f"🧪 PRUEBA DE INCIDENCIAS para emplazamiento: {emplazamiento_id}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query simple para probar
        test_query = "SELECT COUNT(*) as total FROM [dbo].[Incidencias] WHERE [Emplazamiento] = ?"
        cursor.execute(test_query, (emplazamiento_id,))
        count = cursor.fetchone()[0]
        
        # Query completa para ver datos
        full_query = """
        SELECT TOP 5 [Nº Incidencia], [Fecha], [Tipo], [Motivo] 
        FROM [dbo].[Incidencias] 
        WHERE [Emplazamiento] = ? 
        ORDER BY [Fecha] DESC
        """
        cursor.execute(full_query, (emplazamiento_id,))
        results = cursor.fetchall()
        
        conn.close()
        
        return jsonify({
            "emplazamiento_id": emplazamiento_id,
            "total_count": count,
            "sample_data": [dict(zip(['Nº Incidencia', 'Fecha', 'Tipo', 'Motivo'], row)) for row in results]
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/mobiliario/<emplazamiento_id>/incidencias')
def get_mobiliario_incidencias(emplazamiento_id):
    """API endpoint para obtener incidencias de un mobiliario específico"""
    try:
        print(f"🔍 SOLICITUD DE INCIDENCIAS para emplazamiento: {emplazamiento_id}")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query para obtener incidencias del emplazamiento
        incidencias_query = """
        SELECT 
            [timestamp],
            [Nº Incidencia],
            [Fecha],
            [Motivo],
            [Nº Recurso],
            [Incidencia de Bloqueo],
            [Tipo],
            [Emplazamiento]
        FROM [dbo].[Incidencias] 
        WHERE [Emplazamiento] = ? AND [Tipo] = 'Emplazamiento'
        ORDER BY [Fecha] DESC
        """
        
        print(f"📊 Ejecutando query: {incidencias_query}")
        print(f"📊 Con parámetro: {emplazamiento_id}")
        
        cursor.execute(incidencias_query, (emplazamiento_id,))
        results = cursor.fetchall()
        
        print(f"📊 Resultados encontrados: {len(results)} incidencias")
        
        # Obtener nombres de columnas
        columns = [column[0] for column in cursor.description]
        
        # Convertir a lista de diccionarios
        incidencias_data = []
        for row in results:
            incidencia = dict(zip(columns, row))
            incidencias_data.append(clean_data(incidencia))
        
        conn.close()
        
        print(f"✅ Respuesta enviada: {len(incidencias_data)} incidencias para emplazamiento {emplazamiento_id}")
        
        return jsonify({
            "success": True,
            "emplazamiento_id": emplazamiento_id,
            "total_incidencias": len(incidencias_data),
            "incidencias": incidencias_data
        })
        
    except Exception as e:
        print(f"❌ Error en endpoint /api/mobiliario/{emplazamiento_id}/incidencias: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
