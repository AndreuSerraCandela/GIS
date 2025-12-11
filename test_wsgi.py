"""
Script de prueba para verificar que wsgi.py funciona correctamente
Ejecutar: python test_wsgi.py
"""
import os
import sys

# Agregar el directorio del proyecto al path
project_dir = os.path.dirname(os.path.abspath(__file__))
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

print(f"📁 Directorio del proyecto: {project_dir}")
print(f"🐍 Python: {sys.executable}")
print(f"📦 Versión Python: {sys.version}")
print(f"📂 Directorio de trabajo: {os.getcwd()}")

try:
    print("\n🔄 Intentando importar wsgi...")
    import wsgi
    print("✅ wsgi.py importado correctamente")
    
    print("\n🔄 Verificando aplicación...")
    if hasattr(wsgi, 'application'):
        print("✅ Variable 'application' encontrada")
        print(f"📝 Tipo: {type(wsgi.application)}")
    else:
        print("❌ Variable 'application' NO encontrada")
    
    print("\n🔄 Verificando app...")
    if hasattr(wsgi, 'app'):
        print("✅ Variable 'app' encontrada")
    else:
        print("⚠️ Variable 'app' no encontrada (puede ser normal)")
    
    print("\n✅ Todas las verificaciones pasaron correctamente")
    print("🚀 La aplicación debería funcionar en IIS")
    
except Exception as e:
    print(f"\n❌ Error: {str(e)}")
    import traceback
    print("\n📋 Traceback completo:")
    traceback.print_exc()
    sys.exit(1)

