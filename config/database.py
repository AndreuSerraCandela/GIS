"""
Configuración de conexión a la base de datos SQL Server
"""

import pyodbc
import os
from typing import Optional

def get_db_connection() -> pyodbc.Connection:
    """
    Establece conexión con la base de datos SQL Server
    
    Returns:
        pyodbc.Connection: Conexión a la base de datos
    """
    
    # Configuración de la base de datos (ajustar según tu entorno)
    server = os.getenv('DB_SERVER', '192.168.10.190')
    database = os.getenv('DB_NAME', 'Malla2009')
    username = os.getenv('DB_USER', 'SA')
    password = os.getenv('DB_PASSWORD', 'SA1234sa')
    driver = os.getenv('DB_DRIVER', 'ODBC Driver 17 for SQL Server')
    
    # Cadena de conexión
    connection_string = f"""
    DRIVER={{{driver}}};
    SERVER={server};
    DATABASE={database};
    UID={username};
    PWD={password};
    Trusted_Connection=no;
    """
    
    try:
        conn = pyodbc.connect(connection_string)
        return conn
    except pyodbc.Error as e:
        print(f"Error al conectar con la base de datos: {e}")
        raise

def test_connection() -> bool:
    """
    Prueba la conexión a la base de datos
    
    Returns:
        bool: True si la conexión es exitosa, False en caso contrario
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Error en la prueba de conexión: {e}")
        return False

if __name__ == "__main__":
    # Prueba de conexión
    if test_connection():
        print("✓ Conexión a la base de datos exitosa")
    else:
        print("✗ Error al conectar con la base de datos")
