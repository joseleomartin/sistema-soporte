"""
Programa para comparar dos archivos Excel y encontrar elementos faltantes
en ambos lados, además de crear una hoja con todos los datos unificados.
"""

import pandas as pd
import sys
from pathlib import Path

def leer_excel(archivo, columna_clave=None):
    """
    Lee un archivo Excel intentando diferentes engines si es necesario.
    """
    try:
        # Intentar leer con openpyxl primero (para .xlsx)
        df = pd.read_excel(archivo, engine='openpyxl')
    except:
        try:
            # Intentar con xlrd (para .xls antiguos)
            df = pd.read_excel(archivo, engine='xlrd')
        except:
            try:
                # Intentar sin especificar engine
                df = pd.read_excel(archivo)
            except Exception as e:
                print(f"Error al leer {archivo}: {e}")
                return None, None
    
    if df.empty:
        print(f"El archivo {archivo} está vacío.")
        return None, None
    
    # Si no se especifica columna clave, usar la primera columna
    if columna_clave is None:
        columna_clave = df.columns[0]
    elif columna_clave not in df.columns:
        print(f"Advertencia: La columna '{columna_clave}' no existe en {archivo}.")
        print(f"Columnas disponibles: {', '.join(df.columns.tolist())}")
        print(f"Usando la primera columna '{df.columns[0]}' como clave.")
        columna_clave = df.columns[0]
    
    return df, columna_clave

def comparar_excel(archivo1, archivo2, columna_clave=None, archivo_salida='resultado_comparacion.xlsx'):
    """
    Compara dos archivos Excel y genera un archivo con tres hojas:
    1. Faltantes en archivo1 (están en archivo2 pero no en archivo1)
    2. Faltantes en archivo2 (están en archivo1 pero no en archivo2)
    3. Todos unificados (todos los datos de ambos archivos)
    """
    
    print(f"Leyendo {archivo1}...")
    df1, clave1 = leer_excel(archivo1, columna_clave)
    if df1 is None:
        return False
    
    print(f"Leyendo {archivo2}...")
    df2, clave2 = leer_excel(archivo2, columna_clave)
    if df2 is None:
        return False
    
    # Asegurar que usamos la misma columna clave
    if clave1 != clave2:
        print(f"Advertencia: Las columnas clave son diferentes.")
        print(f"Archivo 1 usa: '{clave1}'")
        print(f"Archivo 2 usa: '{clave2}'")
        print(f"Usando '{clave1}' para ambos.")
        clave2 = clave1
    
    columna_clave = clave1
    
    # Convertir la columna clave a string para comparación
    df1[columna_clave] = df1[columna_clave].astype(str)
    df2[columna_clave] = df2[columna_clave].astype(str)
    
    # Obtener los valores únicos de la columna clave
    valores1 = set(df1[columna_clave].unique())
    valores2 = set(df2[columna_clave].unique())
    
    # Encontrar faltantes
    faltantes_en_1 = valores2 - valores1  # Están en 2 pero no en 1
    faltantes_en_2 = valores1 - valores2  # Están en 1 pero no en 2
    
    print(f"\nResumen de comparación:")
    print(f"  - Total registros en archivo 1: {len(df1)}")
    print(f"  - Total registros en archivo 2: {len(df2)}")
    print(f"  - Faltantes en archivo 1: {len(faltantes_en_1)}")
    print(f"  - Faltantes en archivo 2: {len(faltantes_en_2)}")
    
    # Crear DataFrames con los faltantes
    df_faltantes_1 = df2[df2[columna_clave].isin(faltantes_en_1)].copy()
    df_faltantes_2 = df1[df1[columna_clave].isin(faltantes_en_2)].copy()
    
    # Unificar todos los datos (eliminar duplicados basándose en la columna clave)
    # Primero combinar ambos dataframes
    df_unificado = pd.concat([df1, df2], ignore_index=True)
    
    # Eliminar duplicados basándose en la columna clave, manteniendo el primero
    df_unificado = df_unificado.drop_duplicates(subset=[columna_clave], keep='first')
    
    print(f"  - Total registros unificados: {len(df_unificado)}")
    
    # Crear el archivo Excel con tres hojas
    print(f"\nGenerando archivo de salida: {archivo_salida}...")
    
    with pd.ExcelWriter(archivo_salida, engine='openpyxl') as writer:
        # Hoja 1: Faltantes en archivo1
        if not df_faltantes_1.empty:
            df_faltantes_1.to_excel(writer, sheet_name='Faltantes en Archivo 1', index=False)
        else:
            # Crear hoja vacía con las columnas
            pd.DataFrame(columns=df2.columns).to_excel(
                writer, sheet_name='Faltantes en Archivo 1', index=False
            )
        
        # Hoja 2: Faltantes en archivo2
        if not df_faltantes_2.empty:
            df_faltantes_2.to_excel(writer, sheet_name='Faltantes en Archivo 2', index=False)
        else:
            # Crear hoja vacía con las columnas
            pd.DataFrame(columns=df1.columns).to_excel(
                writer, sheet_name='Faltantes en Archivo 2', index=False
            )
        
        # Hoja 3: Todos unificados
        df_unificado.to_excel(writer, sheet_name='Todos Unificados', index=False)
    
    print(f"✓ Archivo generado exitosamente: {archivo_salida}")
    return True

def main():
    """
    Función principal del programa.
    """
    if len(sys.argv) < 3:
        print("Uso: python comparar_excel.py <archivo1.xlsx> <archivo2.xlsx> [columna_clave] [archivo_salida.xlsx]")
        print("\nEjemplo:")
        print("  python comparar_excel.py archivo1.xlsx archivo2.xlsx")
        print("  python comparar_excel.py archivo1.xlsx archivo2.xlsx 'CUIT Agente Ret./Perc.'")
        print("  python comparar_excel.py archivo1.xlsx archivo2.xlsx 'CUIT Agente Ret./Perc.' resultado.xlsx")
        sys.exit(1)
    
    archivo1 = sys.argv[1]
    archivo2 = sys.argv[2]
    columna_clave = sys.argv[3] if len(sys.argv) > 3 else None
    archivo_salida = sys.argv[4] if len(sys.argv) > 4 else 'resultado_comparacion.xlsx'
    
    # Verificar que los archivos existan
    if not Path(archivo1).exists():
        print(f"Error: El archivo '{archivo1}' no existe.")
        sys.exit(1)
    
    if not Path(archivo2).exists():
        print(f"Error: El archivo '{archivo2}' no existe.")
        sys.exit(1)
    
    # Ejecutar la comparación
    exito = comparar_excel(archivo1, archivo2, columna_clave, archivo_salida)
    
    if not exito:
        sys.exit(1)

if __name__ == "__main__":
    main()

