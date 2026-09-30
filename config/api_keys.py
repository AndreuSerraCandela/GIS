"""
Configuración de API Keys para servicios de geocodificación
"""

import os

# Google Maps API Key
# Obtener en: https://console.cloud.google.com/apis/credentials
# En IIS: definir GOOGLE_MAPS_API_KEY en C:\inetpub\wwwroot\Gis\.env (recomendado)
_DEFAULT_GOOGLE_KEY = "AIzaSyDw_VuMVhBi6Yj0fWVZTpf32DxjpnjbCno"


def resolve_google_maps_api_key():
    """Clave efectiva: .env del servidor primero; fallback al valor del repo."""
    env_key = (os.getenv("GOOGLE_MAPS_API_KEY") or "").strip()
    if env_key and not env_key.upper().startswith("YOUR_"):
        return env_key, "env"
    if _DEFAULT_GOOGLE_KEY and not _DEFAULT_GOOGLE_KEY.upper().startswith("YOUR_"):
        return _DEFAULT_GOOGLE_KEY.strip(), "repo_default"
    return "", "missing"


GOOGLE_MAPS_API_KEY, _GOOGLE_KEY_SOURCE = resolve_google_maps_api_key()


def places_osm_fallback_enabled():
    """Solo si Google falla; desactivado por defecto (Google es la fuente principal)."""
    return (os.getenv("PLACES_OSM_FALLBACK") or "false").strip().lower() in (
        "1", "true", "yes", "on",
    )


def refresh_google_maps_api_key():
    """Actualiza GEOCODING_SERVICES tras cargar .env (p. ej. en diagnóstico)."""
    global GOOGLE_MAPS_API_KEY, _GOOGLE_KEY_SOURCE
    GOOGLE_MAPS_API_KEY, _GOOGLE_KEY_SOURCE = resolve_google_maps_api_key()
    GEOCODING_SERVICES["google_maps"]["api_key"] = GOOGLE_MAPS_API_KEY
    return GOOGLE_MAPS_API_KEY, _GOOGLE_KEY_SOURCE

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
