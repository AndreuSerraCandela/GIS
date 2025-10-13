# Configuración de Servicios de Geocodificación

Este documento explica cómo configurar diferentes servicios de geocodificación para mejorar la precisión de la localización de paradas de autobús.

## Servicios Disponibles

### 1. Google Maps API (Recomendado)
- **Precisión**: Muy alta para paradas de autobús
- **Costo**: $5 por 1000 consultas (primeros $200 gratis/mes)
- **Configuración**:
  1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
  2. Crea un nuevo proyecto o selecciona uno existente
  3. Habilita la API de Geocoding
  4. Crea credenciales (API Key)
  5. Edita `config/api_keys.py`:
     ```python
     GOOGLE_MAPS_API_KEY = "tu_api_key_aqui"
     GEOCODING_SERVICES['google_maps']['enabled'] = True
     ```

### 2. Bing Maps API
- **Precisión**: Alta
- **Costo**: $5 por 1000 consultas (primeros $100 gratis/mes)
- **Configuración**:
  1. Ve a [Bing Maps Portal](https://www.bingmapsportal.com/)
  2. Crea una cuenta y un nuevo proyecto
  3. Genera una API Key
  4. Edita `config/api_keys.py`:
     ```python
     BING_MAPS_API_KEY = "tu_api_key_aqui"
     GEOCODING_SERVICES['bing_maps']['enabled'] = True
     ```

### 3. Nominatim (OpenStreetMap) - Gratuito
- **Precisión**: Media
- **Costo**: Gratuito
- **Configuración**: Ya está habilitado por defecto

## Configuración Actual

Por defecto, solo Nominatim está habilitado. Para usar servicios de pago:

1. **Edita `config/api_keys.py`**:
   ```python
   # Para habilitar Google Maps
   GEOCODING_SERVICES['google_maps']['enabled'] = True
   GOOGLE_MAPS_API_KEY = "tu_api_key_aqui"
   
   # Para habilitar Bing Maps
   GEOCODING_SERVICES['bing_maps']['enabled'] = True
   BING_MAPS_API_KEY = "tu_api_key_aqui"
   ```

2. **Reinicia la aplicación**:
   ```bash
   python main.py
   ```

## Pruebas

### Probar un servicio específico:
```bash
# Ejemplo: Probar parada 1024
curl "http://localhost:5000/api/test-geocoding/1024/Alexandre%20Laborde/ALEXANDRE%20DE%20LABORDE%2C%2017"
```

### Ver estadísticas:
```bash
curl "http://localhost:5000/api/geocoding-stats"
```

## Estrategia de Búsqueda

El sistema intenta los servicios en este orden:
1. **Google Maps** (si está habilitado)
2. **Bing Maps** (si está habilitado)
3. **Nominatim** (siempre habilitado)

## Formato de Búsqueda

Para paradas de autobús, el sistema construye búsquedas como:
```
"Parada bus 1024- Alexandre Laborde, ALEXANDRE DE LABORDE, 17, Mallorca, Islas Baleares, España"
```

## Recomendaciones

- **Para máxima precisión**: Usa Google Maps API
- **Para costo-beneficio**: Usa Bing Maps API
- **Para desarrollo/testing**: Usa solo Nominatim (gratuito)

## Limitaciones

- **Nominatim**: Puede no encontrar paradas específicas de autobús
- **Google Maps**: Requiere API key y tiene costos
- **Bing Maps**: Requiere API key y tiene costos

## Monitoreo

Revisa los logs de la aplicación para ver qué servicio está funcionando mejor:
```
Intentando geocodificación con google_maps...
Google Maps geocodificación exitosa para parada 1024: 39.5696, 2.6502
```
