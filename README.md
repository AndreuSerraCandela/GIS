# GIS Web App

Aplicación web de Sistema de Información Geográfica desarrollada en Python con Flask y conexión a SQL Server.

## Descripción

Esta aplicación web está diseñada para visualizar y gestionar datos geoespaciales almacenados en una base de datos SQL Server existente. Proporciona una interfaz web moderna para la consulta y visualización de información geográfica.

## Características

- 🌐 **Interfaz web moderna** con Flask
- 🗄️ **Conexión a SQL Server** existente
- 🗺️ **Visualización interactiva** con Leaflet.js
- 📊 **API REST** para consultas geoespaciales
- 🎨 **Diseño responsive** y moderno
- 🔧 **Configuración flexible** con variables de entorno

## Estructura del Proyecto

```
GIS/
├── config/         # Configuración de la aplicación
│   ├── database.py # Conexión a SQL Server
│   └── config.py   # Configuración general
├── static/         # Archivos estáticos
│   ├── css/        # Estilos CSS
│   └── js/         # JavaScript del cliente
├── templates/      # Plantillas HTML
│   └── index.html  # Página principal
├── tests/          # Pruebas unitarias
├── docs/           # Documentación
├── data/           # Datos geoespaciales
├── main.py         # Aplicación Flask principal
├── requirements.txt # Dependencias del proyecto
├── .env.example    # Ejemplo de variables de entorno
└── README.md       # Este archivo
```

## Instalación

1. Navega al directorio del proyecto:
   ```bash
   cd C:\users\Andreu\Source\Python\GIS
   ```

2. Crea un entorno virtual (recomendado):
   ```bash
   python -m venv venv
   venv\Scripts\activate  # En Windows
   ```

3. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```

4. Configura las variables de entorno:
   ```bash
   copy .env.example .env
   ```
   Edita el archivo `.env` con tu configuración de SQL Server.

## Configuración de la Base de Datos

1. Asegúrate de tener SQL Server instalado y funcionando
2. Instala el driver ODBC para SQL Server
3. Configura las variables de entorno en `.env`:
   ```
   DB_SERVER=tu_servidor_sql
   DB_NAME=tu_base_datos
   DB_USER=tu_usuario
   DB_PASSWORD=tu_password
   ```

## Uso

1. Ejecuta la aplicación:
   ```bash
   python main.py
   ```

2. Abre tu navegador y ve a:
   ```
   http://localhost:5000
   ```

3. Usa el botón "Cargar Datos" para obtener información de tu base de datos SQL Server

## API Endpoints

- `GET /` - Página principal de la aplicación
- `GET /api/geodata` - Obtiene datos geoespaciales de la base de datos
- `GET /api/health` - Verifica el estado de la aplicación

## Dependencias Principales

### Backend
- **Flask**: Framework web
- **pyodbc**: Conexión a SQL Server
- **SQLAlchemy**: ORM para base de datos
- **geopandas**: Manipulación de datos geoespaciales
- **shapely**: Operaciones geométricas

### Frontend
- **Leaflet.js**: Visualización de mapas interactivos
- **CSS3**: Estilos modernos y responsive

## Desarrollo

Para contribuir al proyecto:

1. Instala las dependencias de desarrollo
2. Ejecuta las pruebas: `pytest`
3. Formatea el código: `black .`
4. Verifica la calidad: `flake8`

## Notas Importantes

- Asegúrate de que tu base de datos SQL Server tenga tablas con datos geoespaciales
- Ajusta las consultas SQL en `main.py` según tu esquema de base de datos
- El proyecto está configurado para trabajar con geometrías en formato WKT

## Autor

Andreu - 2025
