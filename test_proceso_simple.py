"""
Script de prueba muy simple para verificar que el proceso se puede ejecutar
Este script solo imprime mensajes y se queda ejecutándose
"""
import sys
import os
import time

print("=" * 60, flush=True)
print("TEST: Proceso Python iniciado correctamente", flush=True)
print("=" * 60, flush=True)
print(f"Python: {sys.executable}", flush=True)
print(f"Versión: {sys.version}", flush=True)
print(f"Directorio: {os.getcwd()}", flush=True)
print(f"HTTP_PLATFORM_PORT: {os.environ.get('HTTP_PLATFORM_PORT', 'NO DEFINIDO')}", flush=True)
print("=" * 60, flush=True)
print("Este proceso se quedará ejecutándose 60 segundos...", flush=True)
print("Presiona Ctrl+C para detenerlo antes", flush=True)
print("=" * 60, flush=True)

# Mantener el proceso vivo
try:
    for i in range(60):
        time.sleep(1)
        if i % 10 == 0:
            print(f"Ejecutándose... {i}/60 segundos", flush=True)
except KeyboardInterrupt:
    print("\nProceso detenido por el usuario", flush=True)

print("Proceso finalizado", flush=True)

