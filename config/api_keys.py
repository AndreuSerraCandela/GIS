"""
Configuración de API Keys para servicios de geocodificación
"""

# Google Maps API Key
# Obtener en: https://console.cloud.google.com/apis/credentials
GOOGLE_MAPS_API_KEY = "AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno"

# Bing Maps API Key  
# Obtener en: https://www.bingmapsportal.com/
BING_MAPS_API_KEY = "YOUR_BING_MAPS_API_KEY"

# Configuración de servicios de geocodificación
GEOCODING_SERVICES = {
    'google_maps': {
        'enabled': True,  # Deshabilitado - Requiere facturación
        'api_key': GOOGLE_MAPS_API_KEY,
        'priority': 1
    },
    'bing_maps': {
        'enabled': True,  # Deshabilitado - API key inválida
        'api_key': BING_MAPS_API_KEY,
        'priority': 2
    },
    'nominatim': {
        'enabled': True,  # Habilitado como principal
        'priority': 3
    }
}

# Configuración de búsqueda
SEARCH_CONFIG = {
    'timeout': 10,
    'max_retries': 3,
    'use_fallback': True,
    # Límite geográfico: solo Islas Baleares (búsqueda por dirección)
    'baleares_bounds': {
        'lat_min': 38.62,
        'lat_max': 40.12,
        'lon_min': 1.10,
        'lon_max': 4.42,
    },
    'baleares_admin_area': 'Illes Balears',
    'baleares_terms': (
        'balear', 'illes balears', 'islas baleares', 'balearic',
        'mallorca', 'majorca', 'menorca', 'minorca', 'ibiza', 'eivissa', 'formentera',
    ),
}
