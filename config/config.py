"""
Configuración de la aplicación GIS Web App
"""

import os
from dotenv import load_dotenv

# Cargar variables de entorno desde archivo .env
load_dotenv()

class Config:
    """Configuración base de la aplicación"""
    
    # Configuración de la base de datos
    DB_SERVER = os.getenv('DB_SERVER', '192.168.10.190')
    DB_NAME = os.getenv('DB_NAME', 'Malla2009')
    DB_USER = os.getenv('DB_USER', 'SA')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'SA1234sa')
    DB_DRIVER = os.getenv('DB_DRIVER', 'ODBC Driver 17 for SQL Server')
    
    # Configuración de vistas GIS
    RECURSOS_VIEW = 'RecursosGis'
    MOBILIARIO_VIEW = 'MobiliarioGis'
    SOURCE_TABLE = 'Malla Publicidad$Resource$437dbf0e-84ff-417a-965d-ed2bb9650972'
    
    # Configuración de Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'tu_clave_secreta_aqui')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    
    # Configuración del servidor
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5016))
    
    # Configuración de CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')

class DevelopmentConfig(Config):
    """Configuración para desarrollo"""
    DEBUG = True
    DB_SERVER = os.getenv('DB_SERVER_DEV', 'localhost')
    DB_NAME = os.getenv('DB_NAME_DEV', 'gis_database_dev')

class ProductionConfig(Config):
    """Configuración para producción"""
    DEBUG = False
    DB_SERVER = os.getenv('DB_SERVER_PROD', 'tu_servidor_prod')
    DB_NAME = os.getenv('DB_NAME_PROD', 'gis_database_prod')

# Configuración por defecto
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
