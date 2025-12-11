# Instrucciones para Configurar en el SERVIDOR

## ⚠️ IMPORTANTE: Todo debe ejecutarse en el SERVIDOR, no en tu ordenador local

## Paso 1: Copiar Archivos al Servidor

Copia estos archivos al servidor en la carpeta de tu aplicación IIS:
- `wsgi.py`
- `web.config`
- `main.py` (y todos los archivos del proyecto)
- `requirements.txt`
- `fix_port_permissions.ps1`

## Paso 2: Instalar Dependencias en el Servidor

**En el servidor**, abre PowerShell o CMD y ejecuta:

```powershell
# Navegar a la carpeta de la aplicación
cd C:\inetpub\wwwroot\Gis  # Ajusta según tu ruta

# Instalar dependencias (usando el Python que configuraste en web.config)
python -m pip install -r requirements.txt
```

**IMPORTANTE**: Usa el mismo Python que configuraste en `web.config`.

## Paso 3: Configurar web.config

**En el servidor**, edita `web.config` y cambia la línea 7:

```xml
processPath="C:\Python\python.exe"
```

Por la ruta real de Python en el servidor. Para encontrarla:

```powershell
where python
```

O:

```powershell
python -c "import sys; print(sys.executable)"
```

## Paso 4: Reservar Puertos para el Application Pool

**En el servidor**, abre PowerShell **como Administrador** y ejecuta:

```powershell
# Navegar a la carpeta de la aplicación
cd C:\inetpub\wwwroot\Gis  # Ajusta según tu ruta

# Ejecutar el script de reserva de puertos
.\fix_port_permissions.ps1
```

El script te pedirá el nombre del Application Pool. Si no lo sabes:

1. Abre **IIS Manager** en el servidor
2. Ve a **Application Pools**
3. Busca el pool asociado a tu sitio (ej: `DefaultAppPool`, `GIS-App`)
4. Ingresa ese nombre cuando el script lo pida

## Paso 5: Verificar Configuración del Application Pool

**En el servidor**, en IIS Manager:

1. **Application Pools** → Tu Application Pool
2. **Advanced Settings**:
   - **.NET CLR version**: `No Managed Code`
   - **Managed pipeline mode**: `Integrated`
   - **Identity**: Verifica que sea `ApplicationPoolIdentity` o un usuario específico

## Paso 6: Verificar Permisos

**En el servidor**, asegúrate de que el Application Pool tenga permisos:

1. Clic derecho en la carpeta de la aplicación → **Properties**
2. Pestaña **Security** → **Edit**
3. Si el Application Pool usa `ApplicationPoolIdentity`:
   - **Add** → Escribe: `IIS AppPool\NombreDelPool`
   - Permisos: **Read & Execute**, **List folder contents**, **Read**
4. Para la carpeta `logs`:
   - Mismos permisos + **Write**

## Paso 7: Probar Localmente en el Servidor

**En el servidor**, prueba que wsgi.py funciona:

```powershell
# Navegar a la carpeta
cd C:\inetpub\wwwroot\Gis

# Probar wsgi.py
python test_wsgi.py
```

Si hay errores, corrígelos antes de continuar.

## Paso 8: Reiniciar IIS

**En el servidor**, reinicia IIS:

```powershell
iisreset
```

O reinicia solo tu sitio en IIS Manager.

## Paso 9: Verificar Logs

**En el servidor**, revisa los logs después de intentar acceder:

```powershell
# Ver logs en tiempo real
Get-Content logs\stdout.log -Wait -Tail 50
Get-Content logs\stderr.log -Wait -Tail 50
Get-Content logs\wsgi.log -Wait -Tail 50
```

## Solución de Problemas en el Servidor

### Error: "ModuleNotFoundError: No module named 'waitress'"

**Solución**: Instala waitress en el servidor:
```powershell
python -m pip install waitress
```

### Error: "[WinError 10013] Intento de acceso a un socket"

**Solución**: Ejecuta `fix_port_permissions.ps1` como Administrador en el servidor.

### Error: "Process failed to start"

**Solución**: 
1. Verifica que la ruta de Python en `web.config` sea correcta
2. Verifica permisos del Application Pool
3. Revisa `logs\stderr.log` para ver el error exacto

### Verificar que el puerto esté disponible

**En el servidor**:
```powershell
# Ver qué está usando el puerto
netstat -ano | findstr :8086

# Ver reservas de puerto
netsh http show urlacl | findstr 8086
```

## Comandos Útiles en el Servidor

### Ver procesos de Python:
```powershell
Get-Process python
```

### Ver puertos en uso:
```powershell
netstat -ano | findstr LISTENING
```

### Ver todas las reservas de puerto:
```powershell
netsh http show urlacl
```

### Reiniciar IIS:
```powershell
iisreset
```

### Verificar que HttpPlatformHandler esté instalado:
En IIS Manager → Servidor → Modules → Buscar `httpPlatformHandler`

## Checklist Final

Antes de probar desde tu ordenador local:

- [ ] Todos los archivos están en el servidor
- [ ] Dependencias instaladas en el servidor (`pip install -r requirements.txt`)
- [ ] Ruta de Python en `web.config` es correcta (ruta del servidor)
- [ ] `test_wsgi.py` funciona en el servidor
- [ ] Puertos reservados para el Application Pool (`fix_port_permissions.ps1`)
- [ ] Permisos del Application Pool configurados
- [ ] Permisos de la carpeta `logs` configurados
- [ ] IIS reiniciado
- [ ] Logs revisados (sin errores críticos)

## Acceso desde tu Ordenador Local

Una vez configurado en el servidor, puedes acceder desde tu ordenador usando:

```
http://IP_DEL_SERVIDOR:PUERTO
```

O si configuraste un nombre de dominio:

```
http://nombre-del-servidor
```

## Notas Importantes

1. **Python en el servidor**: Asegúrate de usar el mismo Python donde instalaste las dependencias
2. **Rutas absolutas**: Todas las rutas en `web.config` deben ser rutas del servidor
3. **Permisos**: El Application Pool necesita permisos de lectura en la carpeta del proyecto y escritura en `logs`
4. **Firewall**: Asegúrate de que el firewall del servidor permita conexiones en el puerto configurado

## Contacto

Si después de seguir todos estos pasos en el servidor el problema persiste, comparte:
- Contenido de `logs\stdout.log` del servidor
- Contenido de `logs\stderr.log` del servidor
- Contenido de `logs\wsgi.log` del servidor
- Salida de `python test_wsgi.py` en el servidor
- Nombre del Application Pool
- Ruta de Python en el servidor

