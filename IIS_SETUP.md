# Configuración de IIS para Flask

Esta guía explica cómo configurar la aplicación Flask para ejecutarse en IIS sin necesidad de tener la consola abierta.

## Requisitos Previos

1. **Python instalado** (recomendado Python 3.9 o superior)
2. **IIS instalado** con las siguientes características:
   - HTTP Platform Handler (HttpPlatformHandler)
   - CGI
   - ISAPI Extensions
   - ISAPI Filters

## Paso 1: Instalar HttpPlatformHandler

1. Descargar HttpPlatformHandler desde: https://www.iis.net/downloads/microsoft/httpplatformhandler
2. Instalar el paquete descargado
3. Reiniciar IIS si es necesario

## Paso 2: Instalar Dependencias de Python

```bash
pip install -r requirements.txt
```

Esto instalará `waitress`, que es el servidor WSGI que usaremos para ejecutar Flask en IIS.

## Paso 3: Configurar web.config

El archivo `web.config` ya está creado en la raíz del proyecto. **IMPORTANTE**: Debes ajustar la ruta de Python en el archivo `web.config`:

1. Abre `web.config`
2. Busca la línea: `<httpPlatform processPath="C:\Python\python.exe"`
3. Cambia `C:\Python\python.exe` por la ruta real de tu instalación de Python
   - Ejemplo: `C:\Python39\python.exe` o `C:\Users\TuUsuario\AppData\Local\Programs\Python\Python39\python.exe`

Para encontrar la ruta de Python:
```bash
where python
```

**Nota**: El archivo `web.config` está configurado para usar `wsgi.py` como punto de entrada, que es el método recomendado para Flask en IIS.

## Paso 4: Crear Directorio de Logs

Crea un directorio `logs` en la raíz del proyecto para los logs de IIS:

```bash
mkdir logs
```

## Paso 5: Configurar IIS

### 5.1 Crear un Nuevo Sitio Web

1. Abre **IIS Manager** (inetmgr)
2. Clic derecho en **Sites** → **Add Website**
3. Configura:
   - **Site name**: `GIS-App` (o el nombre que prefieras)
   - **Physical path**: Ruta completa a tu proyecto (ej: `C:\Users\Andreu\source\Python\GIS`)
   - **Binding**: 
     - Type: `http`
     - IP address: `All Unassigned` o una IP específica
     - Port: `80` (o el puerto que prefieras)
     - Host name: (opcional, ej: `gis.local`)

### 5.2 Configurar el Application Pool

1. En IIS Manager, ve a **Application Pools**
2. Selecciona el pool de tu sitio (se crea automáticamente)
3. Clic derecho → **Basic Settings**
4. Configura:
   - **.NET CLR version**: `No Managed Code`
   - **Managed pipeline mode**: `Integrated`
5. Clic derecho → **Advanced Settings**
   - **Start Mode**: `AlwaysRunning` (opcional, para mejor rendimiento)
   - **Idle Time-out**: `0` (para que no se detenga automáticamente)

### 5.3 Configurar Permisos

1. Clic derecho en el sitio → **Edit Permissions**
2. En la pestaña **Security**, asegúrate de que:
   - `IIS_IUSRS` tenga permisos de **Read & Execute**
   - `IUSR` tenga permisos de **Read & Execute**
   - El usuario del Application Pool tenga permisos de **Read & Execute**

### 5.4 Configurar Variables de Entorno (Opcional)

Si necesitas variables de entorno específicas, puedes agregarlas en `web.config` dentro de `<environmentVariables>`:

```xml
<environmentVariable name="DATABASE_CONNECTION_STRING" value="tu_cadena_de_conexion" />
```

## Paso 6: Probar la Aplicación

1. Abre un navegador
2. Ve a `http://localhost` (o la URL que configuraste)
3. Deberías ver la aplicación funcionando

## Solución de Problemas

### Error: "HTTP Error 500.0 - Internal Server Error"

1. Revisa los logs en `logs\stdout.log`
2. Verifica que la ruta de Python en `web.config` sea correcta
3. Asegúrate de que todas las dependencias estén instaladas

### Error: "Module not found"

1. Verifica que todas las dependencias estén instaladas:
   ```bash
   pip install -r requirements.txt
   ```
2. Asegúrate de que el Python usado por IIS sea el mismo donde instalaste las dependencias

### Error: "Permission denied"

1. Verifica los permisos del directorio del proyecto
2. Asegúrate de que el Application Pool tenga permisos de lectura/ejecución

### La aplicación no inicia

1. Revisa el Event Viewer de Windows:
   - Abre **Event Viewer** → **Windows Logs** → **Application**
   - Busca errores relacionados con tu aplicación
2. Revisa los logs de IIS en `logs\stdout.log`
3. Verifica que HttpPlatformHandler esté instalado correctamente

### Verificar que HttpPlatformHandler esté instalado

1. Abre **IIS Manager**
2. Selecciona el servidor (nombre del servidor en la parte superior)
3. Haz doble clic en **Modules**
4. Busca `httpPlatformHandler` en la lista

## Comandos Útiles

### Reiniciar IIS
```bash
iisreset
```

### Reiniciar solo un sitio
En IIS Manager: Clic derecho en el sitio → **Manage Website** → **Restart**

### Ver logs en tiempo real
```bash
Get-Content logs\stdout.log -Wait -Tail 50
```

## Notas Importantes

- **No necesitas ejecutar la consola**: La aplicación se ejecuta como servicio de Windows
- **Reinicio automático**: Si la aplicación falla, IIS intentará reiniciarla automáticamente (hasta 10 veces según la configuración)
- **Logs**: Todos los logs se guardan en `logs\stdout.log`
- **Rendimiento**: Para producción, considera usar un servidor WSGI más robusto como `gunicorn` (aunque requiere más configuración en Windows)

## Alternativa: Usar wfastcgi (Método Antiguo)

Si HttpPlatformHandler no funciona, puedes usar wfastcgi, aunque es menos recomendado:

1. Instalar wfastcgi:
   ```bash
   pip install wfastcgi
   ```

2. Habilitar wfastcgi:
   ```bash
   wfastcgi-enable
   ```

3. Configurar el handler en IIS para usar wfastcgi

Este método es más complejo y menos recomendado que HttpPlatformHandler.

