#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para convertir coordenadas UTM a coordenadas geográficas (lat/lon)
"""

import pandas as pd
import pyproj
import numpy as np

def utm_to_geographic(utm_x, utm_y, zone=31, hemisphere='S'):
    """
    Convierte coordenadas UTM a coordenadas geográficas (lat/lon)
    
    Args:
        utm_x: Coordenada X UTM
        utm_y: Coordenada Y UTM  
        zone: Zona UTM (por defecto 31)
        hemisphere: Hemisferio ('N' o 'S', por defecto 'S')
    
    Returns:
        tuple: (longitud, latitud) en grados decimales
    """
    # Crear el transformador UTM a WGS84
    utm_crs = pyproj.CRS.from_string(f"+proj=utm +zone={zone} +hemisphere={hemisphere.lower()} +datum=WGS84")
    wgs84_crs = pyproj.CRS.from_string("+proj=longlat +datum=WGS84")
    
    transformer = pyproj.Transformer.from_crs(utm_crs, wgs84_crs, always_xy=True)
    
    # Convertir coordenadas
    lon, lat = transformer.transform(utm_x, utm_y)
    
    return lon, lat

def main():
    print("Convirtiendo coordenadas UTM a geograficas...")
    
    # Leer el archivo Excel
    try:
        df = pd.read_excel('Coordenadas.xlsx')
        print(f"Archivo leido correctamente. {len(df)} filas encontradas.")
    except Exception as e:
        print(f"Error al leer el archivo: {e}")
        return
    
    # Mostrar información del archivo
    print(f"\nColumnas encontradas: {df.columns.tolist()}")
    print(f"Primeras 5 filas:")
    print(df.head())
    
    # Verificar que tenemos las columnas necesarias
    required_cols = ['X UTM (31S)', 'Y UTM (31S)']
    if not all(col in df.columns for col in required_cols):
        print(f"Error: No se encontraron las columnas necesarias: {required_cols}")
        return
    
    # Convertir coordenadas
    print(f"\nConvirtiendo {len(df)} coordenadas UTM a geograficas...")
    
    # Aplicar la conversión a todas las filas
    coordinates = []
    for idx, row in df.iterrows():
        utm_x = row['X UTM (31S)']
        utm_y = row['Y UTM (31S)']
        
        try:
            lon, lat = utm_to_geographic(utm_x, utm_y, zone=31, hemisphere='S')
            # Obtener el número de parada usando el índice de la columna
            numero_parada = row.iloc[0]  # Primera columna
            coordinates.append({
                'Numero_Parada': numero_parada,
                'UTM_X': utm_x,
                'UTM_Y': utm_y,
                'Longitud': lon,
                'Latitud': lat
            })
        except Exception as e:
            print(f"Error en fila {idx}: {e}")
            continue
    
    # Crear DataFrame con las coordenadas convertidas
    df_converted = pd.DataFrame(coordinates)
    
    # Mostrar resultados
    print(f"\nConversion completada. {len(df_converted)} coordenadas convertidas.")
    print(f"\nPrimeras 5 coordenadas convertidas:")
    print(df_converted.head())
    
    # Mostrar estadísticas
    if len(df_converted) > 0:
        print(f"\nEstadisticas de las coordenadas geograficas:")
        print(f"   Longitud: {df_converted['Longitud'].min():.6f} a {df_converted['Longitud'].max():.6f}")
        print(f"   Latitud: {df_converted['Latitud'].min():.6f} a {df_converted['Latitud'].max():.6f}")
    else:
        print(f"\nNo se pudieron convertir coordenadas.")
    
    # Guardar en archivo CSV
    output_file = 'coordenadas_geograficas.csv'
    df_converted.to_csv(output_file, index=False, encoding='utf-8')
    print(f"\nCoordenadas guardadas en: {output_file}")
    
    # Guardar también en Excel
    output_excel = 'coordenadas_geograficas.xlsx'
    df_converted.to_excel(output_excel, index=False, engine='openpyxl')
    print(f"Coordenadas guardadas en: {output_excel}")
    
    # Mostrar algunas coordenadas de ejemplo
    print(f"\nEjemplos de coordenadas convertidas:")
    for i in range(min(5, len(df_converted))):
        row = df_converted.iloc[i]
        print(f"   Parada {row['Numero_Parada']}: {row['Latitud']:.6f}, {row['Longitud']:.6f}")

if __name__ == "__main__":
    main()
