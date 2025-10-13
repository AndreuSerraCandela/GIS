# Creación de Vistas GIS

Este documento explica cómo crear las vistas necesarias para la aplicación GIS Web App.

## Vistas Requeridas

### 1. RecursosGis
Vista que filtra recursos de tipo "Opi" con blocked=false de la tabla principal.

**Campos:**
- `No_` - Número de identificación
- `Name` - Nombre del recurso
- `PuntoX` - Coordenada X (longitud)
- `PuntoY` - Coordenada Y (latitud)

**Filtros aplicados:**
- `Tipo = 'Opi'`
- `blocked = 0` (false)

### 2. MobiliarioGis
Vista placeholder para futuros datos de mobiliario.

## Scripts Disponibles

### 1. create_views.sql
Script SQL directo para ejecutar en SQL Server Management Studio.

### 2. create_views.py
Script Python que:
- Verifica la estructura de la tabla fuente
- Crea las vistas automáticamente
- Muestra estadísticas de los datos

## Instrucciones de Uso

### Opción 1: Usar el script Python (Recomendado)

```bash
cd C:\users\Andreu\Source\Python\GIS
python create_views.py
```

Este script:
1. Verifica que la tabla fuente existe
2. Muestra la estructura de la tabla
3. Crea las vistas si no existen
4. Muestra estadísticas de los datos

### Opción 2: Usar SQL directamente

1. Abre SQL Server Management Studio
2. Conecta al servidor 192.168.10.190
3. Selecciona la base de datos Malla2009
4. Ejecuta el contenido de `create_views.sql`

## Verificación

Después de crear las vistas, puedes verificar que funcionan correctamente:

```sql
-- Verificar que las vistas existen
SELECT * FROM INFORMATION_SCHEMA.VIEWS 
WHERE TABLE_NAME IN ('RecursosGis', 'MobiliarioGis');

-- Contar registros en RecursosGis
SELECT COUNT(*) FROM RecursosGis;

-- Ver algunos datos de ejemplo
SELECT TOP 10 * FROM RecursosGis;
```

## Estructura de la Tabla Fuente

La vista se basa en la tabla:
`Malla Publicidad$Resource$437dbf0e-84ff-417a-965d-ed2bb9650972`

**Campos requeridos:**
- `No_` - Identificador
- `Name` - Nombre
- `PuntoX` - Coordenada X
- `PuntoY` - Coordenada Y
- `Tipo` - Tipo de recurso (debe contener 'Opi')
- `blocked` - Estado de bloqueo (0 = false, 1 = true)

## Solución de Problemas

### Error: "Tabla no existe"
- Verifica que el nombre de la tabla sea exacto
- Asegúrate de estar conectado a la base de datos correcta

### Error: "Campo no existe"
- Ejecuta el script de verificación para ver la estructura real
- Ajusta los nombres de campos si es necesario

### Error: "Permisos insuficientes"
- Asegúrate de que el usuario SA tenga permisos para crear vistas
- Verifica que estés conectado con las credenciales correctas

## Próximos Pasos

Una vez creadas las vistas:

1. Ejecuta `python test_connection.py` para verificar la conexión
2. Ejecuta `python main.py` para iniciar la aplicación web
3. Abre http://localhost:5000 en tu navegador
4. Usa los botones para cargar datos de las vistas

