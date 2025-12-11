# Restaurar Estado Después de Reservar Puertos

## Si las otras aplicaciones dejaron de funcionar

### Paso 1: Revertir Reservas del Application Pool

**En el servidor, como Administrador**:

```powershell
cd C:\inetpub\wwwroot\Gis
.\revertir_reservas_puertos.ps1
```

Este script solo eliminará las reservas que hicimos para tu Application Pool específico, sin tocar las de otras aplicaciones.

### Paso 2: Verificar Reservas Restantes

**En el servidor**:

```powershell
netsh http show urlacl
```

Esto mostrará todas las reservas. Verifica que las reservas de tus otras aplicaciones sigan ahí.

### Paso 3: Si Necesitas Restaurar una Reserva Específica

Si sabes qué puerto necesita una aplicación específica, puedes restaurarlo:

```powershell
# Ejemplo: restaurar puerto 8080 para un usuario específico
netsh http add urlacl url=http://localhost:8080/ user="UsuarioOriginal"
```

### Paso 4: Reiniciar IIS

**En el servidor**:

```powershell
iisreset
```

### Paso 5: Probar Aplicaciones

Prueba todas tus aplicaciones para verificar que funcionan correctamente.

## Solución Alternativa: No Reservar Puertos

Si las reservas están causando problemas, podemos configurar la aplicación para que **NO** requiera reservas de puerto. Esto se hace usando `0.0.0.0` en lugar de `127.0.0.1`, pero requiere permisos adicionales.

**Opción más segura**: Usar un rango de puertos específico que no interfiera con otras aplicaciones.

## Verificar Qué Aplicaciones Usan Qué Puertos

**En el servidor**:

```powershell
# Ver todas las reservas
netsh http show urlacl

# Ver puertos en uso
netstat -ano | findstr LISTENING
```

## Si Nada Funciona

1. **Revisa Event Viewer** para ver errores específicos de cada aplicación
2. **Revisa los logs** de cada aplicación para ver qué puerto intenta usar
3. **Restaura manualmente** las reservas que necesites basándote en los logs

## Prevención Futura

Antes de reservar puertos en el futuro:
1. Ejecuta `verificar_puertos_existentes.ps1` para ver el estado actual
2. Identifica qué puertos usan tus otras aplicaciones
3. Solo reserva puertos que estén disponibles

