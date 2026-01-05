#!/usr/bin/env python3
"""
Proyecto GIS Web App - Sistema de Información Geográfica
Autor: Andreu
Fecha: 2025
"""

from flask import Flask, render_template, jsonify, request, send_file
from flask_cors import CORS
import pyodbc
import json
import requests
import os
import math
from datetime import datetime, date
from config.database import get_db_connection
from config.api_keys import GEOCODING_SERVICES, SEARCH_CONFIG
import pandas as pd
from io import BytesIO
import base64

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

def get_fechas():
    """
    Obtiene las fechas desde los parámetros de la request.
    Si no se proporcionan, usa la fecha de hoy para ambas.
    
    Returns:
        tuple: (fecha_desde, fecha_hasta) en formato YYYY-MM-DD
    """
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    # Si no se proporcionan fechas, usar la fecha de hoy
    fecha_hoy = date.today().strftime('%Y-%m-%d')
    
    fecha_desde = fecha_desde if fecha_desde else fecha_hoy
    fecha_hasta = fecha_hasta if fecha_hasta else fecha_hoy
    
    return fecha_desde, fecha_hasta

def calcular_distancia_haversine(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
    
    Args:
        lat1, lon1: Coordenadas del primer punto
        lat2, lon2: Coordenadas del segundo punto
        
    Returns:
        float: Distancia en kilómetros
    """
    # Radio de la Tierra en kilómetros
    R = 6371.0
    
    # Convertir grados a radianes
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Diferencia de coordenadas
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Fórmula de Haversine
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def buscar_lugares_cerca(lat, lon, tipo_lugar, radio_km=5):
    """
    Busca lugares específicos cerca de unas coordenadas usando Google Places API
    
    Args:
        lat, lon: Coordenadas de referencia
        tipo_lugar: Tipo de lugar a buscar ('pharmacy', 'gas_station', 'hospital', etc.)
        radio_km: Radio de búsqueda en kilómetros
        
    Returns:
        list: Lista de lugares encontrados con sus coordenadas
    """
    try:
        # Convertir radio de km a metros para la API
        radio_metros = radio_km * 1000
        
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            'location': f"{lat},{lon}",
            'radius': radio_metros,
            'type': tipo_lugar,
            'key': GEOCODING_SERVICES['google_maps']['api_key']
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data['status'] == 'OK':
                lugares = []
                for place in data['results']:
                    lugar = {
                        'nombre': place.get('name', 'Sin nombre'),
                        'lat': place['geometry']['location']['lat'],
                        'lon': place['geometry']['location']['lng'],
                        'rating': place.get('rating', 0),
                        'vicinity': place.get('vicinity', ''),
                        'place_id': place.get('place_id', ''),
                        'tipo': tipo_lugar,
                        'distancia_km': calcular_distancia_haversine(
                            lat, lon, 
                            place['geometry']['location']['lat'], 
                            place['geometry']['location']['lng']
                        )
                    }
                    lugares.append(lugar)
                
                # Ordenar por distancia
                lugares.sort(key=lambda x: x['distancia_km'])
                return lugares
            else:
                print(f"Error en Google Places API: {data.get('status', 'Unknown error')}")
                return []
        else:
            print(f"Error HTTP en Google Places API: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"Error al buscar lugares cerca: {e}")
        return []

def obtener_tipos_lugares_soportados():
    """
    Devuelve la lista de tipos de lugares soportados por Google Places API
    
    Returns:
        dict: Diccionario con tipos de lugares y sus descripciones
    """
    return {
        'pharmacy': 'Farmacias',
        'gas_station': 'Gasolineras',
        'hospital': 'Hospitales',
        'bank': 'Bancos',
        'restaurant': 'Restaurantes',
        'school': 'Colegios',
        'university': 'Universidades',
        'police': 'Comisarías',
        'fire_station': 'Bomberos',
        'post_office': 'Oficinas de correos',
        'supermarket': 'Supermercados',
        'shopping_mall': 'Centros comerciales',
        'gym': 'Gimnasios',
        'park': 'Parques',
        'church': 'Iglesias',
        'mosque': 'Mezquitas',
        'synagogue': 'Sinagogas',
        'cemetery': 'Cementerios',
        'zoo': 'Zoológicos',
        'museum': 'Museos',
        'library': 'Bibliotecas',
        'movie_theater': 'Cines',
        'amusement_park': 'Parques de atracciones',
        'aquarium': 'Acuarios',
        'stadium': 'Estadios',
        'airport': 'Aeropuertos',
        'bus_station': 'Estaciones de autobús',
        'train_station': 'Estaciones de tren',
        'subway_station': 'Estaciones de metro',
        'taxi_stand': 'Paradas de taxi',
        'car_rental': 'Alquiler de coches',
        'car_wash': 'Lavaderos de coches',
        'car_repair': 'Talleres de reparación',
        'dentist': 'Dentistas',
        'doctor': 'Médicos',
        'veterinary_care': 'Veterinarios',
        'beauty_salon': 'Peluquerías',
        'hair_care': 'Salones de belleza',
        'spa': 'Spas',
        'laundry': 'Lavanderías',
        'dry_cleaning': 'Tintorerías',
        'funeral_home': 'Funerarias',
        'real_estate_agency': 'Inmobiliarias',
        'insurance_agency': 'Agencias de seguros',
        'travel_agency': 'Agencias de viajes',
        'tourist_attraction': 'Atracciones turísticas',
        'campground': 'Campings',
        'rv_park': 'Parques para autocaravanas',
        'lodging': 'Alojamientos',
        'night_club': 'Discotecas',
        'bar': 'Bares',
        'cafe': 'Cafeterías',
        'bakery': 'Panaderías',
        'food': 'Comida',
        'meal_takeaway': 'Comida para llevar',
        'meal_delivery': 'Comida a domicilio',
        'liquor_store': 'Licorerías',
        'convenience_store': 'Tiendas de conveniencia',
        'clothing_store': 'Tiendas de ropa',
        'shoe_store': 'Zapaterías',
        'jewelry_store': 'Joyerías',
        'electronics_store': 'Tiendas de electrónica',
        'furniture_store': 'Tiendas de muebles',
        'home_goods_store': 'Tiendas de hogar',
        'hardware_store': 'Ferreterías',
        'book_store': 'Librerías',
        'bicycle_store': 'Tiendas de bicicletas',
        'sporting_goods_store': 'Tiendas de deportes',
        'pet_store': 'Tiendas de mascotas',
        'florist': 'Floristerías',
        'gift_shop': 'Tiendas de regalos',
        'art_gallery': 'Galerías de arte',
        'atm': 'Cajeros automáticos',
        'embassy': 'Embajadas',
        'local_government_office': 'Oficinas gubernamentales',
        'courthouse': 'Tribunales',
        'city_hall': 'Ayuntamientos'
    }

def geocodificar_direccion(direccion):
    """
    Geocodifica una dirección usando Google Maps API
    
    Args:
        direccion: Dirección a geocodificar
        
    Returns:
        tuple: (lat, lon) o (None, None) si no se encuentra
    """
    try:
        print(f"Geocodificando dirección: {direccion}")
        
        # Verificar si la API key está disponible
        if not GEOCODING_SERVICES['google_maps']['api_key']:
            print("API key de Google Maps no configurada")
            return None, None
        
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            'address': direccion,
            'key': GEOCODING_SERVICES['google_maps']['api_key'],
            'region': 'es',
            'components': 'country:ES'
        }
        
        print(f"URL de geocodificación: {url}")
        print(f"Parámetros: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        print(f"Respuesta HTTP: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Respuesta de la API: {data}")
            
            if data['status'] == 'OK' and data['results']:
                location = data['results'][0]['geometry']['location']
                lat = location['lat']
                lon = location['lng']
                print(f"Coordenadas encontradas: {lat}, {lon}")
                return lat, lon
            else:
                print(f"Error en geocodificación: {data.get('status', 'Unknown error')}")
                if 'error_message' in data:
                    print(f"Mensaje de error: {data['error_message']}")
        else:
            print(f"Error HTTP: {response.status_code}")
            print(f"Respuesta: {response.text}")
        
        return None, None
        
    except Exception as e:
        print(f"Error al geocodificar dirección: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return None, None

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
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Obtener datos usando RecursosPorFechas
        recursos_query = "SELECT * FROM [dbo].[RecursosPorFechasGlobal](?, ?)"
        cursor.execute(recursos_query, (fecha_desde, fecha_hasta))
        recursos_results = cursor.fetchall()
        
        # Obtener datos usando MobiliarioPorFechas
        mobiliario_query = "SELECT * FROM [dbo].[MobiliarioPorFechas](?, ?)"
        cursor.execute(mobiliario_query, (fecha_desde, fecha_hasta))
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
    """API endpoint para obtener datos de Campañas con filtros opcionales"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener parámetros de filtro
        no_recurso = request.args.get('no_recurso', '')
        fecha_desde_str = request.args.get('fecha_desde', '')
        fecha_hasta_str = request.args.get('fecha_hasta', '')
        empresa = request.args.get('empresa', '')
        
        # Validar y convertir fechas
        fecha_desde = None
        fecha_hasta = None
        
        if fecha_desde_str:
            try:
                fecha_desde = datetime.strptime(fecha_desde_str, '%Y-%m-%d').date()
            except ValueError:
                print(f"⚠️ Formato de fecha_desde inválido: {fecha_desde_str}")
                return jsonify({"error": f"Formato de fecha_desde inválido: {fecha_desde_str}. Use formato YYYY-MM-DD"}), 400
        
        if fecha_hasta_str:
            try:
                fecha_hasta = datetime.strptime(fecha_hasta_str, '%Y-%m-%d').date()
            except ValueError:
                print(f"⚠️ Formato de fecha_hasta inválido: {fecha_hasta_str}")
                return jsonify({"error": f"Formato de fecha_hasta inválido: {fecha_hasta_str}. Use formato YYYY-MM-DD"}), 400
        
        # Construir la consulta base
        query = """
        SELECT Distinct
        [Empresa],
            [Campaña],
            [Inicio],
            [Fin],
            [Cliente],
            [Nº Recurso]
            FROM [dbo].[Campañas]
        """
        
        params = []
        where_clauses = []
        
        # Añadir filtros si se proporcionan
        if no_recurso:
            where_clauses.append("[Nº Recurso] = ?")
            params.append(no_recurso)
        
        if fecha_desde:
            where_clauses.append("[Fin] >= ?")
            params.append(fecha_desde)
        
        if fecha_hasta:
            where_clauses.append("[Inicio] <= ?")
            params.append(fecha_hasta)
        
        if empresa:
            where_clauses.append("Empresa = ?")
            params.append(empresa)
        
        # Añadir WHERE si hay filtros
        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)
        
        query += " ORDER BY [Inicio] DESC"
        
        print(f"📊 Query de campañas: {query}")
        print(f"📊 Parámetros: {params}")
        
        cursor.execute(query, params)
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
        print(f"❌ Error en endpoint /api/campanas: {e}")
        import traceback
        print(f"❌ Traceback completo: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tipos-recurso')
def get_tipos_recurso():
    """API endpoint para obtener los tipos de recurso disponibles"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Obtener tipos de recurso desde RecursosPorFechasGlobal
        query = """
        SELECT DISTINCT [Tipo Recurso]
        FROM [dbo].[RecursosPorFechasGlobal](?, ?)
        WHERE [Tipo Recurso] <> ''
        ORDER BY [Tipo Recurso]
        """
        cursor.execute(query, (fecha_desde, fecha_hasta))
        results = cursor.fetchall()
        
        tipos = [row[0] for row in results if row[0]]
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "tipos_recurso": tipos,
            "total": len(tipos)
        })
        
    except Exception as e:
        print(f"Error en endpoint /api/tipos-recurso: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/empresas')
def get_empresas():
    """API endpoint para obtener las empresas disponibles"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Obtener empresas desde RecursosPorFechasGlobal
        query = """
        SELECT DISTINCT Empresa
        FROM [dbo].[RecursosPorFechasGlobal](?, ?)
        WHERE Empresa IS NOT NULL AND Empresa <> ''
        ORDER BY Empresa
        """
        cursor.execute(query, (fecha_desde, fecha_hasta))
        results = cursor.fetchall()
        
        empresas = [row[0] for row in results if row[0]]
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "empresas": empresas,
            "total": len(empresas)
        })
        
    except Exception as e:
        print(f"Error en endpoint /api/empresas: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/familias')
def get_familias():
    """API endpoint para obtener las familias disponibles"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Obtener familias desde RecursosPorFechasGlobal
        query = """
        SELECT DISTINCT Familia
        FROM [dbo].[RecursosPorFechasGlobal](?, ?)
        WHERE Familia IS NOT NULL AND Familia <> ''
        ORDER BY Familia
        """
        cursor.execute(query, (fecha_desde, fecha_hasta))
        results = cursor.fetchall()
        
        familias = [row[0] for row in results if row[0]]
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "familias": familias,
            "total": len(familias)
        })
        
    except Exception as e:
        print(f"Error en endpoint /api/familias: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/recursos')
def get_recursos():
    """API endpoint específico para obtener datos de RecursosPorFechasGlobal con incidencias y campañas"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Obtener tipos de recurso seleccionados (puede ser múltiple, separado por comas)
        tipos_recurso = request.args.get('tipos_recurso', '')
        tipos_list = [t.strip() for t in tipos_recurso.split(',') if t.strip()] if tipos_recurso else []
        
        # Obtener empresas seleccionadas (puede ser múltiple, separado por comas)
        empresas = request.args.get('empresas', '')
        empresas_list = [e.strip() for e in empresas.split(',') if e.strip()] if empresas else []
        
        # Obtener familias seleccionadas (puede ser múltiple, separado por comas)
        familias = request.args.get('familias', '')
        familias_list = [f.strip() for f in familias.split(',') if f.strip()] if familias else []
        
        # Construir la consulta base con filtros
        where_conditions = []
        params = [fecha_desde, fecha_hasta]
        
        if tipos_list:
            placeholders_tipos = ','.join(['?' for _ in tipos_list])
            where_conditions.append(f"[Tipo Recurso] IN ({placeholders_tipos})")
            params.extend(tipos_list)
        
        if empresas_list:
            placeholders_empresas = ','.join(['?' for _ in empresas_list])
            where_conditions.append(f"Empresa IN ({placeholders_empresas})")
            params.extend(empresas_list)
        
        if familias_list:
            placeholders_familias = ','.join(['?' for _ in familias_list])
            where_conditions.append(f"Familia IN ({placeholders_familias})")
            params.extend(familias_list)
        
        # Construir la consulta
        query = """
        SELECT [No_], [Name], [PuntoX], [PuntoY], Incidencia, Campañas, [Tipo Recurso], Empresa, [Ruta]
        FROM [dbo].[RecursosPorFechasGlobal](?, ?)
        """
        
        if where_conditions:
            query += " WHERE " + " AND ".join(where_conditions)
        
        cursor.execute(query, params)
        
        results = cursor.fetchall()
        
        # Obtener nombres de columnas
        columns = [column[0] for column in cursor.description]
        
        # Convertir a lista de diccionarios
        recursos_data = []
        for row in results:
            recurso = dict(zip(columns, row))
            recurso = clean_data(recurso)
            
            # Inicializar campos básicos (sin cargar datos completos)
            recurso['total_campanas'] = recurso['Campañas']
            recurso['total_incidencias'] = recurso['Incidencia']
            recurso['tiene_incidencia'] = 1 if recurso['total_incidencias'] > 0 else 0
            recurso['tiene_campana'] = 1 if recurso['total_campanas'] > 0 else 0
            
            # try:
            #     # Solo obtener conteo de campañas
            #     campanas_count_query = "SELECT COUNT(DISTINCT [Campaña]) as total FROM Campañas WHERE [Nº Recurso] = ?"
            #     cursor.execute(campanas_count_query, (recurso['No_'],))
            #     campanas_count = cursor.fetchone()[0]
            #     recurso['total_campanas'] = campanas_count
            # except Exception as e:
            #     print(f"Error al obtener conteo de campañas para recurso {recurso['No_']}: {e}")
            #     recurso['total_campanas'] = 0
            
            # try:
            #     # Solo obtener conteo de incidencias
            #     incidencias_count_query = "SELECT COUNT(*) as total FROM [dbo].[Incidencias] WHERE [Nº Recurso] = ? AND [Tipo] = 'Recurso'"
            #     cursor.execute(incidencias_count_query, (recurso['No_'],))
            #     incidencias_count = cursor.fetchone()[0]
            #     recurso['total_incidencias'] = incidencias_count
            #     recurso['tiene_incidencia'] = 1 if incidencias_count > 0 else 0
            # except Exception as e:
            #     print(f"Error al obtener conteo de incidencias para recurso {recurso['No_']}: {e}")
            #     recurso['total_incidencias'] = 0
            
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
    """API endpoint específico para obtener datos de MobiliarioPorFechas con incidencias"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Siempre usar MobiliarioPorFechas
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
            [Dirección],
            Incidencia
        FROM [dbo].[MobiliarioPorFechas](?, ?)
        """
        cursor.execute(query, (fecha_desde, fecha_hasta))
        
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
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Probar consulta simple usando funciones con fechas
        cursor.execute("SELECT COUNT(*) as total FROM [dbo].[RecursosPorFechasGlobal](?, ?)", (fecha_desde, fecha_hasta))
        recursos_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) as total FROM [dbo].[MobiliarioPorFechas](?, ?)", (fecha_desde, fecha_hasta))
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
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Contar mobiliario con coordenadas válidas
        cursor.execute("""
            SELECT COUNT(*) 
            FROM [dbo].[MobiliarioPorFechas](?, ?) 
            WHERE PuntoX != 0 AND PuntoY != 0
        """, (fecha_desde, fecha_hasta))
        con_coordenadas = cursor.fetchone()[0]
        
        # Contar mobiliario sin coordenadas
        cursor.execute("""
            SELECT COUNT(*) 
            FROM [dbo].[MobiliarioPorFechas](?, ?) 
            WHERE PuntoX = 0 OR PuntoY = 0 OR PuntoX IS NULL OR PuntoY IS NULL
        """, (fecha_desde, fecha_hasta))
        sin_coordenadas = cursor.fetchone()[0]
        
        # Contar mobiliario con dirección
        cursor.execute("""
            SELECT COUNT(*) 
            FROM [dbo].[MobiliarioPorFechas](?, ?) 
            WHERE [Dirección] IS NOT NULL AND [Dirección] != ''
        """, (fecha_desde, fecha_hasta))
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

@app.route('/api/recursos-cerca-lugares')
def get_recursos_cerca_lugares():
    """API endpoint genérico para obtener recursos cerca de cualquier tipo de lugar"""
    try:
        # Obtener parámetros de la consulta
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        tipo_lugar = request.args.get('tipo_lugar')
        radio_km = request.args.get('radio', 5, type=float)
        
        if not lat or not lon:
            return jsonify({"error": "Se requieren parámetros lat y lon"}), 400
        
        if not tipo_lugar:
            return jsonify({"error": "Se requiere el parámetro tipo_lugar"}), 400
        
        # Validar que el tipo de lugar sea soportado
        tipos_soportados = obtener_tipos_lugares_soportados()
        if tipo_lugar not in tipos_soportados:
            return jsonify({
                "error": f"Tipo de lugar '{tipo_lugar}' no soportado",
                "tipos_soportados": list(tipos_soportados.keys()),
                "descripciones": tipos_soportados
            }), 400
        
        # Buscar lugares cerca
        lugares = buscar_lugares_cerca(lat, lon, tipo_lugar, radio_km)
        
        if not lugares:
            return jsonify({
                "mensaje": f"No se encontraron {tipos_soportados[tipo_lugar].lower()} en el área especificada",
                "tipo_lugar": tipo_lugar,
                "descripcion": tipos_soportados[tipo_lugar],
                "lugares": [],
                "recursos_cerca": []
            })
        
        # Obtener todos los recursos de la base de datos
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Obtener tipos de recurso seleccionados (puede ser múltiple, separado por comas)
        tipos_recurso = request.args.get('tipos_recurso', '')
        tipos_list = [t.strip() for t in tipos_recurso.split(',') if t.strip()] if tipos_recurso else []
        
        # Obtener empresas seleccionadas (puede ser múltiple, separado por comas)
        empresas = request.args.get('empresas', '')
        empresas_list = [e.strip() for e in empresas.split(',') if e.strip()] if empresas else []
        
        # Obtener familias seleccionadas (puede ser múltiple, separado por comas)
        familias = request.args.get('familias', '')
        familias_list = [f.strip() for f in familias.split(',') if f.strip()] if familias else []
        
        # Construir la consulta con filtros
        where_conditions = ["[PuntoX] != 0", "[PuntoY] != 0"]
        params = [fecha_desde, fecha_hasta]
        
        if tipos_list:
            placeholders_tipos = ','.join(['?' for _ in tipos_list])
            where_conditions.append(f"[Tipo Recurso] IN ({placeholders_tipos})")
            params.extend(tipos_list)
        
        if empresas_list:
            placeholders_empresas = ','.join(['?' for _ in empresas_list])
            where_conditions.append(f"Empresa IN ({placeholders_empresas})")
            params.extend(empresas_list)
        
        if familias_list:
            placeholders_familias = ','.join(['?' for _ in familias_list])
            where_conditions.append(f"Familia IN ({placeholders_familias})")
            params.extend(familias_list)
        
        query = f"""
        SELECT [No_], [Name], [PuntoX], [PuntoY], Incidencia, Campañas, [Tipo Recurso], Empresa, [Ruta]
        FROM [dbo].[RecursosPorFechasGlobal](?, ?) 
        WHERE {' AND '.join(where_conditions)}
        """
        cursor.execute(query, params)
        
        recursos_results = cursor.fetchall()
        
        columns = [column[0] for column in cursor.description]
        recursos_data = []
        
        for row in recursos_results:
            recurso = dict(zip(columns, row))
            recurso = clean_data(recurso)
            
            # Calcular distancia a cada lugar
            distancias_lugares = []
            for lugar in lugares:
                distancia = calcular_distancia_haversine(
                    lugar['lat'], lugar['lon'],
                    recurso['PuntoY'], recurso['PuntoX']
                )
                distancias_lugares.append({
                    'lugar': lugar['nombre'],
                    'distancia_km': round(distancia, 2)
                })
            recurso['total_campanas'] = recurso['Campañas']
            recurso['total_incidencias'] = recurso['Incidencia']
            recurso['tiene_incidencia'] = 1 if recurso['total_incidencias'] > 0 else 0
            recurso['tiene_campana'] = 1 if recurso['total_campanas'] > 0 else 0
            # Encontrar el lugar más cercano
            lugar_mas_cercano = min(distancias_lugares, key=lambda x: x['distancia_km'])
            
            if lugar_mas_cercano['distancia_km'] <= radio_km:
                recurso['lugar_mas_cercano'] = lugar_mas_cercano
                recurso['distancia_a_lugar_km'] = lugar_mas_cercano['distancia_km']
                recursos_data.append(recurso)
        
        # Ordenar por distancia al lugar más cercano
        recursos_data.sort(key=lambda x: x['distancia_a_lugar_km'])
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "tipo_busqueda": tipo_lugar,
            "descripcion": tipos_soportados[tipo_lugar],
            "coordenadas_referencia": {"lat": lat, "lon": lon},
            "radio_km": radio_km,
            "lugares_encontrados": len(lugares),
            "lugares": lugares,
            "recursos_cerca": len(recursos_data),
            "recursos": recursos_data
        })
        
    except Exception as e:
        print(f"Error en endpoint /api/recursos-cerca-lugares: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/recursos-cerca-direccion')
def get_recursos_cerca_direccion():
    """API endpoint para obtener recursos cerca de una dirección específica"""
    try:
        # Obtener parámetros de la consulta
        direccion = request.args.get('direccion')
        radio_km = request.args.get('radio', 5, type=float)
        
        print(f"Búsqueda por dirección - Dirección: {direccion}, Radio: {radio_km}")
        
        if not direccion:
            print("Error: No se proporcionó dirección")
            return jsonify({"error": "Se requiere el parámetro direccion"}), 400
        
        if not radio_km or radio_km <= 0 or radio_km > 50:
            print(f"Error: Radio inválido: {radio_km}")
            return jsonify({"error": "Radio debe estar entre 0.1 y 50 km"}), 400
        
        # Geocodificar la dirección
        print("Iniciando geocodificación...")
        lat, lon = geocodificar_direccion(direccion)
        
        if not lat or not lon:
            print("Error: No se pudo geocodificar la dirección")
            return jsonify({
                "error": "No se pudo geocodificar la dirección proporcionada",
                "direccion": direccion,
                "sugerencia": "Verifica que la dirección sea correcta y esté en España"
            }), 400
        
        # Obtener todos los recursos de la base de datos
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Obtener tipos de recurso seleccionados (puede ser múltiple, separado por comas)
        tipos_recurso = request.args.get('tipos_recurso', '')
        tipos_list = [t.strip() for t in tipos_recurso.split(',') if t.strip()] if tipos_recurso else []
        
        # Obtener empresas seleccionadas (puede ser múltiple, separado por comas)
        empresas = request.args.get('empresas', '')
        empresas_list = [e.strip() for e in empresas.split(',') if e.strip()] if empresas else []
        
        # Obtener familias seleccionadas (puede ser múltiple, separado por comas)
        familias = request.args.get('familias', '')
        familias_list = [f.strip() for f in familias.split(',') if f.strip()] if familias else []
        
        # Construir la consulta con filtros
        where_conditions = ["[PuntoX] != 0", "[PuntoY] != 0"]
        params = [fecha_desde, fecha_hasta]
        
        if tipos_list:
            placeholders_tipos = ','.join(['?' for _ in tipos_list])
            where_conditions.append(f"[Tipo Recurso] IN ({placeholders_tipos})")
            params.extend(tipos_list)
        
        if empresas_list:
            placeholders_empresas = ','.join(['?' for _ in empresas_list])
            where_conditions.append(f"Empresa IN ({placeholders_empresas})")
            params.extend(empresas_list)
        
        if familias_list:
            placeholders_familias = ','.join(['?' for _ in familias_list])
            where_conditions.append(f"Familia IN ({placeholders_familias})")
            params.extend(familias_list)
        
        query = f"""
        SELECT [No_], [Name], [PuntoX], [PuntoY], Incidencia, Campañas, [Tipo Recurso], Empresa, [Ruta]
        FROM [dbo].[RecursosPorFechasGlobal](?, ?) 
        WHERE {' AND '.join(where_conditions)}
        """
        cursor.execute(query, params)
        
        recursos_results = cursor.fetchall()
        
        columns = [column[0] for column in cursor.description]
        recursos_data = []
        
        for row in recursos_results:
            recurso = dict(zip(columns, row))
            recurso = clean_data(recurso)
            
            # Calcular distancia a la dirección
            distancia = calcular_distancia_haversine(
                lat, lon,
                recurso['PuntoY'], recurso['PuntoX']
            )
            recurso['total_campanas'] = recurso['Campañas']
            recurso['total_incidencias'] = recurso['Incidencia']
            recurso['tiene_incidencia'] = 1 if recurso['total_incidencias'] > 0 else 0
            recurso['tiene_campana'] = 1 if recurso['total_campanas'] > 0 else 0
            if distancia <= radio_km:
                recurso['distancia_a_direccion_km'] = round(distancia, 2)
                recursos_data.append(recurso)
        
        # Ordenar por distancia
        recursos_data.sort(key=lambda x: x['distancia_a_direccion_km'])
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "tipo_busqueda": "direccion",
            "direccion_buscada": direccion,
            "coordenadas_encontradas": {"lat": lat, "lon": lon},
            "radio_km": radio_km,
            "recursos_cerca": len(recursos_data),
            "recursos": recursos_data
        })
        
    except Exception as e:
        print(f"Error en endpoint /api/recursos-cerca-direccion: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/recursos-cerca')
def get_recursos_cerca():
    """API endpoint unificado para buscar recursos cerca de cualquier tipo de lugar o dirección"""
    try:
        # Obtener parámetros de la consulta
        tipo = request.args.get('tipo')  # 'direccion' o cualquier tipo de lugar
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        direccion = request.args.get('direccion')
        radio_km = request.args.get('radio', 5, type=float)
        
        if not tipo:
            return jsonify({"error": "Se requiere el parámetro tipo"}), 400
        
        if tipo == 'direccion':
            if not direccion:
                return jsonify({"error": "Para tipo 'direccion' se requiere el parámetro direccion"}), 400
            # Redirigir al endpoint específico de dirección
            return get_recursos_cerca_direccion()
        else:
            # Es un tipo de lugar específico
            if not lat or not lon:
                return jsonify({"error": f"Para tipo '{tipo}' se requieren los parámetros lat y lon"}), 400
            
            # Usar el endpoint genérico de lugares
            # Simular la llamada al endpoint genérico
            request.args = request.args.copy()
            request.args['tipo_lugar'] = tipo
            return get_recursos_cerca_lugares()
            
    except Exception as e:
        print(f"Error en endpoint /api/recursos-cerca: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tipos-lugares')
def get_tipos_lugares():
    """API endpoint para obtener todos los tipos de lugares soportados"""
    try:
        tipos_soportados = obtener_tipos_lugares_soportados()
        return jsonify({
            "total_tipos": len(tipos_soportados),
            "tipos_lugares": tipos_soportados
        })
    except Exception as e:
        print(f"Error en endpoint /api/tipos-lugares: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/recursos-cerca-coordenadas')
def get_recursos_cerca_coordenadas():
    """API endpoint para obtener recursos cerca de coordenadas específicas"""
    try:
        # Obtener parámetros de la consulta
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        radio_km = request.args.get('radio', 5, type=float)
        
        if not lat or not lon:
            return jsonify({"error": "Se requieren parámetros lat y lon"}), 400
        
        # Obtener todos los recursos de la base de datos
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Obtener tipos de recurso seleccionados (puede ser múltiple, separado por comas)
        tipos_recurso = request.args.get('tipos_recurso', '')
        tipos_list = [t.strip() for t in tipos_recurso.split(',') if t.strip()] if tipos_recurso else []
        
        # Obtener empresas seleccionadas (puede ser múltiple, separado por comas)
        empresas = request.args.get('empresas', '')
        empresas_list = [e.strip() for e in empresas.split(',') if e.strip()] if empresas else []
        
        # Obtener familias seleccionadas (puede ser múltiple, separado por comas)
        familias = request.args.get('familias', '')
        familias_list = [f.strip() for f in familias.split(',') if f.strip()] if familias else []
        
        # Construir la consulta con filtros
        where_conditions = ["[PuntoX] != 0", "[PuntoY] != 0"]
        params = [fecha_desde, fecha_hasta]
        
        if tipos_list:
            placeholders_tipos = ','.join(['?' for _ in tipos_list])
            where_conditions.append(f"[Tipo Recurso] IN ({placeholders_tipos})")
            params.extend(tipos_list)
        
        if empresas_list:
            placeholders_empresas = ','.join(['?' for _ in empresas_list])
            where_conditions.append(f"Empresa IN ({placeholders_empresas})")
            params.extend(empresas_list)
        
        if familias_list:
            placeholders_familias = ','.join(['?' for _ in familias_list])
            where_conditions.append(f"Familia IN ({placeholders_familias})")
            params.extend(familias_list)
        
        query = f"""
        SELECT [No_], [Name], [PuntoX], [PuntoY], Incidencia, Campañas, [Tipo Recurso], Empresa, [Ruta]
        FROM [dbo].[RecursosPorFechasGlobal](?, ?) 
        WHERE {' AND '.join(where_conditions)}
        """
        cursor.execute(query, params)
        
        recursos_results = cursor.fetchall()
        
        columns = [column[0] for column in cursor.description]
        recursos_data = []
        
        for row in recursos_results:
            recurso = dict(zip(columns, row))
            recurso = clean_data(recurso)
            
            # Calcular distancia a las coordenadas especificadas
            distancia = calcular_distancia_haversine(
                lat, lon,
                recurso['PuntoY'], recurso['PuntoX']
            )
            recurso['total_campanas'] = recurso['Campañas']
            recurso['total_incidencias'] = recurso['Incidencia']
            recurso['tiene_incidencia'] = 1 if recurso['total_incidencias'] > 0 else 0
            recurso['tiene_campana'] = 1 if recurso['total_campanas'] > 0 else 0
            if distancia <= radio_km:
                recurso['distancia_km'] = round(distancia, 2)
                recursos_data.append(recurso)
        
        # Ordenar por distancia
        recursos_data.sort(key=lambda x: x['distancia_km'])
        
        cursor.close()
        conn.close()
        
        return jsonify({
            "tipo_busqueda": "coordenadas",
            "coordenadas_referencia": {"lat": lat, "lon": lon},
            "radio_km": radio_km,
            "recursos_cerca": len(recursos_data),
            "recursos": recursos_data
        })
        
    except Exception as e:
        print(f"Error en endpoint /api/recursos-cerca-coordenadas: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/test-direccion')
def test_direccion():
    """Endpoint de prueba para verificar la geocodificación de direcciones"""
    try:
        direccion = request.args.get('direccion', 'Plaza España, Palma de Mallorca')
        
        print(f"Probando geocodificación con: {direccion}")
        
        lat, lon = geocodificar_direccion(direccion)
        
        if lat and lon:
            return jsonify({
                "status": "success",
                "direccion": direccion,
                "coordenadas": {"lat": lat, "lon": lon},
                "mensaje": "Geocodificación exitosa"
            })
        else:
            return jsonify({
                "status": "error",
                "direccion": direccion,
                "mensaje": "No se pudo geocodificar la dirección"
            }), 400
            
    except Exception as e:
        return jsonify({
            "status": "error",
            "mensaje": str(e)
        }), 500

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
        print(f"🔍 Tipo de emplazamiento_id: {type(emplazamiento_id)}")
        
        # Verificar que el emplazamiento_id sea válido
        if not emplazamiento_id or emplazamiento_id.strip() == '':
            return jsonify({"error": "Emplazamiento ID no válido"}), 400
        
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
        print(f"📊 Columnas: {columns}")
        
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
        import traceback
        print(f"❌ Traceback completo: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/recursos/<recurso_id>/detalles')
def get_recurso_detalles(recurso_id):
    """API endpoint para obtener incidencias y campañas de un recurso específico"""
    try:
        print(f"🔍 SOLICITUD DE DETALLES para recurso: {recurso_id}")
        print(f"🔍 Tipo de recurso_id: {type(recurso_id)}")
        
        # Verificar que el recurso_id sea válido
        if not recurso_id or recurso_id.strip() == '':
            return jsonify({"error": "Recurso ID no válido"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Query para obtener incidencias del recurso
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
        WHERE [Nº Recurso] = ? AND [Tipo] = 'Recurso'
        ORDER BY [Fecha] DESC
        """
        
        print(f"📊 Ejecutando query de incidencias: {incidencias_query}")
        print(f"📊 Con parámetro: {recurso_id}")
        
        cursor.execute(incidencias_query, (recurso_id,))
        incidencias_results = cursor.fetchall()
        
        print(f"📊 Incidencias encontradas: {len(incidencias_results)}")
        
        # Obtener nombres de columnas de incidencias
        incidencias_columns = [column[0] for column in cursor.description]
        
        # Convertir incidencias a lista de diccionarios
        incidencias_data = []
        for row in incidencias_results:
            incidencia = dict(zip(incidencias_columns, row))
            incidencias_data.append(clean_data(incidencia))
        
        # Query para obtener campañas del recurso
        campanas_query = """
        SELECT 
            Distinct
            [Campaña],
            [Inicio],
            [Fin],
            Max([Cliente]) as [Cliente]
        FROM [dbo].[Campañas] 
        WHERE [Nº Recurso] = ?
        Group by [Campaña], [Inicio], [Fin]
        ORDER BY [Inicio] DESC
        """
        
        print(f"📊 Ejecutando query de campañas: {campanas_query}")
        print(f"📊 Con parámetro: {recurso_id}")
        
        cursor.execute(campanas_query, (recurso_id,))
        campanas_results = cursor.fetchall()
        
        print(f"📊 Campañas encontradas: {len(campanas_results)}")
        
        # Obtener nombres de columnas de campañas
        campanas_columns = [column[0] for column in cursor.description]
        
        # Convertir campañas a lista de diccionarios
        campanas_data = []
        for row in campanas_results:
            campana = dict(zip(campanas_columns, row))
            campanas_data.append(clean_data(campana))
        
        cursor.close()
        conn.close()
        
        print(f"✅ Respuesta enviada: {len(incidencias_data)} incidencias y {len(campanas_data)} campañas para recurso {recurso_id}")
        print(f"✅ Datos de campañas: {campanas_data}")
        
        return jsonify({
            "success": True,
            "recurso_id": recurso_id,
            "total_incidencias": len(incidencias_data),
            "total_campanas": len(campanas_data),
            "incidencias": incidencias_data,
            "campanas": campanas_data
        })
        
    except Exception as e:
        print(f"❌ Error en endpoint /api/recursos/{recurso_id}/detalles: {e}")
        import traceback
        print(f"❌ Traceback completo: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/exportar-excel', methods=['POST'])
def exportar_excel():
    """Endpoint para exportar recursos seleccionados a Excel"""
    try:
        data = request.get_json()
        recursos_nos = data.get('recursos', [])
        
        if not recursos_nos:
            return jsonify({"error": "No se proporcionaron recursos para exportar"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener fechas (usar hoy si no se proporcionan)
        fecha_desde, fecha_hasta = get_fechas()
        
        # Construir la consulta para obtener los recursos seleccionados
        placeholders = ','.join(['?' for _ in recursos_nos])
        query = f"""
        SELECT [No_], [Name], [PuntoX], [PuntoY], Incidencia, Campañas, [Tipo Recurso], Empresa, [Ruta]
        FROM [dbo].[RecursosPorFechasGlobal](?, ?)
        WHERE [No_] IN ({placeholders})
        """
        
        params = [fecha_desde, fecha_hasta] + recursos_nos
        cursor.execute(query, params)
        
        # Obtener nombres de columnas
        columns = [column[0] for column in cursor.description]
        results = cursor.fetchall()
        
        # Convertir resultados a lista de listas (pandas necesita esto)
        rows = []
        for row in results:
            rows.append(list(row))
        
        # Convertir a DataFrame
        df = pd.DataFrame(rows, columns=columns)
        
        # Crear archivo Excel en memoria
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Recursos')
        
        output.seek(0)
        
        cursor.close()
        conn.close()
        
        # Enviar el archivo
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'recursos_seleccionados_{date.today().strftime("%Y%m%d")}.xlsx'
        )
        
    except Exception as e:
        print(f"❌ Error exportando a Excel: {e}")
        import traceback
        print(f"❌ Traceback completo: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/file')
def get_file():
    """
    Endpoint para obtener archivos (imágenes) y devolverlos como base64.
    Recibe el parámetro filepath por GET.
    """
    try:
        filepath = request.args.get('filepath', '')
        
        if not filepath:
            return jsonify({"error": "Parámetro filepath requerido"}), 400
        
        # Verificar que el archivo existe
        if not os.path.exists(filepath):
            print(f"⚠️ Archivo no encontrado: {filepath}")
            return jsonify({"error": "Archivo no encontrado"}), 404
        
        # Leer el archivo y convertirlo a base64
        try:
            with open(filepath, 'rb') as f:
                file_content = f.read()
                base64_content = base64.b64encode(file_content).decode('utf-8')
                return base64_content, 200, {'Content-Type': 'text/plain'}
        except Exception as e:
            print(f"❌ Error leyendo archivo {filepath}: {e}")
            return jsonify({"error": f"Error leyendo archivo: {str(e)}"}), 500
            
    except Exception as e:
        print(f"❌ Error en endpoint /file: {e}")
        import traceback
        print(f"❌ Traceback completo: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

# Configuración para IIS
# Nota: Para IIS, usar wsgi.py como punto de entrada
if __name__ == "__main__":
    # Modo desarrollo (solo si se ejecuta directamente main.py)
    app.run(debug=True, host='0.0.0.0', port=5016)
