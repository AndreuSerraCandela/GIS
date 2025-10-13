#!/usr/bin/env python3
"""
Script de prueba para verificar la conexión a la base de datos SQL Server
"""

from config.database import test_connection, get_db_connection
import pyodbc

def test_views():
    """Prueba si las vistas RecursosGis y MobiliarioGis existen"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar si las vistas existen
        views_to_check = ['RecursosGis', 'MobiliarioGis']
        
        for view_name in views_to_check:
            try:
                cursor.execute(f"SELECT TOP 1 * FROM {view_name}")
                result = cursor.fetchone()
                print(f"✓ Vista '{view_name}' existe y tiene datos")
                
                # Obtener información sobre las columnas
                cursor.execute(f"SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '{view_name}'")
                columns = cursor.fetchall()
                print(f"  Columnas en {view_name}:")
                for col in columns:
                    print(f"    - {col[0]} ({col[1]})")
                print()
                
            except pyodbc.Error as e:
                print(f"✗ Error al acceder a la vista '{view_name}': {e}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error general: {e}")

def main():
    print("=== Prueba de Conexión a Base de Datos SQL Server ===")
    print(f"Servidor: 192.168.10.190")
    print(f"Base de datos: Malla2009")
    print(f"Usuario: SA")
    print()
    
    # Probar conexión básica
    if test_connection():
        print("✓ Conexión a la base de datos exitosa")
        print()
        
        # Probar las vistas
        test_views()
    else:
        print("✗ Error al conectar con la base de datos")
        print("Verifica que:")
        print("1. El servidor SQL Server esté ejecutándose")
        print("2. La IP 192.168.10.190 sea accesible")
        print("3. Las credenciales SA/SA1234sa sean correctas")
        print("4. El driver ODBC esté instalado")

if __name__ == "__main__":
    main()


