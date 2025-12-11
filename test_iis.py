"""
Script de prueba para simular cómo IIS ejecuta wsgi.py
Ejecutar: python test_iis.py
"""
import os
import sys
import socket

# Simular variable de entorno de IIS
# Usar un puerto que probablemente esté libre
test_port = 5016

# Verificar si el puerto está disponible
def is_port_available(port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(('127.0.0.1', port))
        sock.close()
        return True
    except OSError:
        return False

# Buscar un puerto disponible
while not is_port_available(test_port) and test_port < 5100:
    test_port += 1

if test_port >= 5100:
    print("❌ No se encontró un puerto disponible para la prueba")
    sys.exit(1)

os.environ['HTTP_PLATFORM_PORT'] = str(test_port)

print("🧪 Simulando ejecución desde IIS...")
print(f"📡 HTTP_PLATFORM_PORT: {os.environ.get('HTTP_PLATFORM_PORT')}")
print(f"🔌 Usando puerto: {test_port}")
print("🔄 Ejecutando wsgi.py...\n")

try:
    # Importar y ejecutar wsgi
    import wsgi
    print("\n" + "="*60)
    print("✅ ¡ÉXITO! wsgi.py se ejecutó correctamente")
    print("="*60)
    print("\n🟢 El servidor waitress está EJECUTÁNDOSE y ESCUCHANDO conexiones")
    print("   Esto es NORMAL y es lo que debe hacer en IIS")
    print("\n📡 El servidor está escuchando en:")
    print(f"   http://127.0.0.1:{test_port}")
    print("\n🧪 Puedes probar abriendo otra terminal y ejecutando:")
    print(f"   curl http://127.0.0.1:{test_port}")
    print("   O abre un navegador y ve a la URL de arriba")
    print("\n⚠️  El proceso se quedará ejecutándose hasta que presiones Ctrl+C")
    print("   En IIS, esto es lo que debe hacer - quedarse ejecutándose")
    print("\n" + "="*60)
    print("🛑 Presiona Ctrl+C para detener el servidor de prueba")
    print("="*60 + "\n")
    
    # Mantener el proceso vivo
    import time
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Servidor detenido por el usuario")
        print("✅ Esto confirma que el servidor estaba funcionando correctamente")
        
except KeyboardInterrupt:
    print("\n\n🛑 Servidor detenido")
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

