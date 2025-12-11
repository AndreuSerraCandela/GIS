# Solución de Problemas IIS - Error -2147023829

## Error: Process failed to start. Error Code = '-2147023829'

Este error generalmente indica problemas de permisos o configuración. Sigue estos pasos:

## 1. Verificar la Ruta de Python en web.config

**CRÍTICO**: La ruta `C:\Python\python.exe` en `web.config` debe ser la ruta REAL de tu Python.

### Encontrar la ruta de Python:
```powershell
where python
```

O:
```powershell
python -c "import sys; print(sys.executable)"
```

### Editar web.config:
1. Abre `web.config`
2. Busca: `<httpPlatform processPath="C:\Python\python.exe"`
3. Reemplaza con tu ruta real, por ejemplo:
   - `C:\Python39\python.exe`
   - `C:\Users\TuUsuario\AppData\Local\Programs\Python\Python39\python.exe`
   - `C:\Program Files\Python39\python.exe`

## 2. Verificar que waitress esté instalado

```bash
pip install waitress
```

O:
```bash
pip install -r requirements.txt
```

## 3. Probar wsgi.py localmente

Antes de configurar IIS, prueba que wsgi.py funciona:

```bash
python test_wsgi.py
```

Si hay errores, corrígelos primero.

## 4. Verificar Permisos del Application Pool

1. Abre **IIS Manager**
2. Ve a **Application Pools**
3. Selecciona el pool de tu sitio
4. Clic derecho → **Advanced Settings**
5. Verifica:
   - **Identity**: Debe ser un usuario con permisos (ej: `ApplicationPoolIdentity` o un usuario específico)
6. Si usas `ApplicationPoolIdentity`, asegúrate de dar permisos a `IIS AppPool\NombreDelPool`

### Dar permisos al Application Pool:

1. Clic derecho en la carpeta del proyecto → **Properties**
2. Pestaña **Security** → **Edit**
3. **Add** → Escribe: `IIS AppPool\NombreDelPool` (reemplaza `NombreDelPool` con el nombre real)
4. Dale permisos: **Read & Execute**, **List folder contents**, **Read**
5. **Apply** → **OK**

## 5. Verificar Permisos de la Carpeta logs

La carpeta `logs` debe tener permisos de escritura:

1. Clic derecho en `logs` → **Properties**
2. Pestaña **Security**
3. Asegúrate de que `IIS_IUSRS` y el Application Pool tengan permisos de **Write**

## 6. Verificar que HttpPlatformHandler esté instalado

1. Abre **IIS Manager**
2. Selecciona el servidor (nombre del servidor en la parte superior)
3. Haz doble clic en **Modules**
4. Busca `httpPlatformHandler` en la lista

Si no está:
- Descarga desde: https://www.iis.net/downloads/microsoft/httpplatformhandler
- Instálalo
- Reinicia IIS: `iisreset`

## 7. Revisar los Logs

### Logs de IIS:
- `logs\stdout.log` - Salida estándar
- `logs\stderr.log` - Errores
- `logs\wsgi.log` - Logs específicos de wsgi.py

### Event Viewer de Windows:
1. Abre **Event Viewer**
2. Ve a **Windows Logs** → **Application**
3. Busca errores relacionados con tu aplicación

## 8. Verificar Variables de Entorno

Asegúrate de que Python pueda acceder a todas las variables de entorno necesarias.

En `web.config`, dentro de `<environmentVariables>`, puedes agregar:
```xml
<environmentVariable name="PATH" value="%PATH%;C:\Python39;C:\Python39\Scripts" />
```

## 9. Probar con un Script Simple

Crea un archivo `test_simple.py` en la raíz:

```python
print("Hello from IIS!")
import sys
sys.stdout.flush()
```

Y cambia temporalmente en `web.config`:
```xml
arguments="%ROOTDRIVE%%ROOTPATH%\test_simple.py"
```

Si esto funciona, el problema está en wsgi.py o en las importaciones.

## 10. Verificar Dependencias

Asegúrate de que todas las dependencias estén instaladas en el Python que usa IIS:

```bash
# Usar el Python que configuraste en web.config
C:\Python39\python.exe -m pip install -r requirements.txt
```

## 11. Configuración del Application Pool

1. **IIS Manager** → **Application Pools** → Tu Pool
2. **Advanced Settings**:
   - **.NET CLR version**: `No Managed Code`
   - **Managed pipeline mode**: `Integrated`
   - **Start Mode**: `AlwaysRunning` (opcional)
   - **Idle Time-out**: `0` (para que no se detenga)

## 12. Comandos Útiles para Debugging

### Ver logs en tiempo real:
```powershell
Get-Content logs\stdout.log -Wait -Tail 50
Get-Content logs\stderr.log -Wait -Tail 50
Get-Content logs\wsgi.log -Wait -Tail 50
```

### Reiniciar IIS:
```powershell
iisreset
```

### Reiniciar solo un sitio:
En IIS Manager: Clic derecho en el sitio → **Manage Website** → **Restart**

### Ver procesos de Python:
```powershell
Get-Process python
```

## 13. Solución Alternativa: Usar ruta absoluta completa

Si nada funciona, prueba usar la ruta absoluta completa en `web.config`:

```xml
<httpPlatform processPath="C:\Users\TuUsuario\AppData\Local\Programs\Python\Python39\python.exe"
              arguments="C:\Users\TuUsuario\source\Python\GIS\wsgi.py"
              ...>
```

## 14. Verificar que Python puede ejecutarse

Desde PowerShell (como administrador):
```powershell
C:\Python\python.exe --version
C:\Python\python.exe -c "print('Hello')"
```

Si esto falla, el problema es la ruta de Python.

## Checklist Final

- [ ] Ruta de Python en web.config es correcta
- [ ] waitress está instalado
- [ ] test_wsgi.py se ejecuta sin errores
- [ ] Permisos del Application Pool configurados
- [ ] Permisos de la carpeta logs configurados
- [ ] HttpPlatformHandler está instalado
- [ ] Todas las dependencias están instaladas
- [ ] Application Pool configurado correctamente
- [ ] Logs no muestran errores adicionales

## Si Nada Funciona

1. Prueba ejecutar la aplicación directamente:
   ```bash
   python wsgi.py
   ```

2. Si funciona, el problema es la configuración de IIS
3. Si no funciona, el problema está en el código Python

## Contacto

Si después de seguir todos estos pasos el problema persiste, comparte:
- Contenido de `logs\stdout.log`
- Contenido de `logs\stderr.log`
- Contenido de `logs\wsgi.log`
- Salida de `python test_wsgi.py`
- Configuración del Application Pool (Identity, etc.)

