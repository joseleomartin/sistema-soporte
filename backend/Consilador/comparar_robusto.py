"""
Versión robusta para comparar archivos Excel, con mejor manejo de archivos corruptos.
"""

import pandas as pd
from pathlib import Path
import glob
import sys

def leer_excel_robusto(archivo):
    """
    Intenta leer un archivo Excel con múltiples métodos y opciones.
    """
    print(f"  Intentando leer {archivo}...")
    
    # Método 1: openpyxl (para .xlsx)
    try:
        df = pd.read_excel(archivo, engine='openpyxl')
        if not df.empty:
            print(f"  ✓ Leído exitosamente con openpyxl")
            return df
    except Exception as e:
        print(f"  ✗ openpyxl falló: {str(e)[:80]}")
    
    # Método 2: xlrd (para .xls antiguos) - modo normal
    try:
        df = pd.read_excel(archivo, engine='xlrd')
        if not df.empty:
            print(f"  ✓ Leído exitosamente con xlrd")
            return df
    except Exception as e:
        print(f"  ✗ xlrd falló: {str(e)[:80]}")
    
    # Método 3: xlrd con opciones de recuperación
    try:
        # Intentar leer solo la primera hoja
        xl_file = pd.ExcelFile(archivo, engine='xlrd')
        if len(xl_file.sheet_names) > 0:
            df = pd.read_excel(xl_file, sheet_name=0)
            if not df.empty:
                print(f"  ✓ Leído exitosamente con xlrd (primera hoja)")
                return df
    except Exception as e:
        print(f"  ✗ xlrd (primera hoja) falló: {str(e)[:80]}")
    
    # Método 4: Intentar sin especificar engine
    try:
        df = pd.read_excel(archivo)
        if not df.empty:
            print(f"  ✓ Leído exitosamente (engine automático)")
            return df
    except Exception as e:
        print(f"  ✗ Engine automático falló: {str(e)[:80]}")
    
    # Si todos fallan
    raise Exception(f"\n❌ No se pudo leer el archivo {archivo}.\n"
                   f"El archivo puede estar corrupto. Intenta:\n"
                   f"  1. Abrir el archivo en Excel y guardarlo de nuevo\n"
                   f"  2. Convertir el archivo a formato .xlsx\n"
                   f"  3. Verificar que el archivo no esté dañado")

def comparar_archivos(archivo1=None, archivo2=None):
    """
    Compara dos archivos Excel especificados o busca automáticamente en el directorio.
    """
    # Si no se especifican archivos, buscar automáticamente
    if archivo1 is None or archivo2 is None:
        archivos_excel = []
        for ext in ['*.xlsx', '*.xls']:
            archivos_excel.extend(glob.glob(ext))
        
        if len(archivos_excel) < 2:
            print(f"❌ Error: Se necesitan al menos 2 archivos Excel en el directorio actual.")
            print(f"   Archivos encontrados: {archivos_excel}")
            print(f"\n   Uso alternativo: python comparar_robusto.py <archivo1> <archivo2>")
            return False
        
        archivo1 = archivos_excel[0]
        archivo2 = archivos_excel[1]
    
    print(f"{'='*70}")
    print(f"COMPARACIÓN DE ARCHIVOS EXCEL")
    print(f"{'='*70}")
    print(f"Archivo 1: {archivo1}")
    print(f"Archivo 2: {archivo2}\n")
    
    try:
        df1 = leer_excel_robusto(archivo1)
        print(f"  → {len(df1)} filas, {len(df1.columns)} columnas\n")
        
        df2 = leer_excel_robusto(archivo2)
        print(f"  → {len(df2)} filas, {len(df2.columns)} columnas\n")
        
    except Exception as e:
        print(f"\n{e}")
        return False
    
    # Detectar columna clave
    columna_clave = df1.columns[0]
    print(f"📋 Usando columna clave: '{columna_clave}'")
    
    # Verificar que la columna existe en ambos
    if columna_clave not in df2.columns:
        print(f"⚠️  Advertencia: La columna '{columna_clave}' no existe en el segundo archivo.")
        print(f"   Columnas disponibles en archivo 2:")
        for i, col in enumerate(df2.columns, 1):
            print(f"     {i}. {col}")
        
        if len(df2.columns) > 0:
            columna_clave = df2.columns[0]
            print(f"\n   Usando '{columna_clave}' del segundo archivo.")
        else:
            print("❌ Error: No se puede determinar la columna clave.")
            return False
    
    # Limpiar y convertir a string para comparación
    df1[columna_clave] = df1[columna_clave].astype(str).str.strip()
    df2[columna_clave] = df2[columna_clave].astype(str).str.strip()
    
    # Eliminar valores vacíos o 'nan'
    df1 = df1[df1[columna_clave].notna() & (df1[columna_clave] != 'nan')]
    df2 = df2[df2[columna_clave].notna() & (df2[columna_clave] != 'nan')]
    
    # Obtener valores únicos
    valores1 = set(df1[columna_clave].unique())
    valores2 = set(df2[columna_clave].unique())
    
    # Encontrar faltantes
    faltantes_en_1 = valores2 - valores1
    faltantes_en_2 = valores1 - valores2
    
    print(f"\n{'='*70}")
    print(f"RESUMEN DE COMPARACIÓN")
    print(f"{'='*70}")
    print(f"📊 Total registros en archivo 1: {len(df1)}")
    print(f"📊 Total registros en archivo 2: {len(df2)}")
    print(f"🔑 Valores únicos en archivo 1: {len(valores1)}")
    print(f"🔑 Valores únicos en archivo 2: {len(valores2)}")
    print(f"\n❌ Faltantes en archivo 1: {len(faltantes_en_1)}")
    print(f"❌ Faltantes en archivo 2: {len(faltantes_en_2)}")
    print(f"{'='*70}\n")
    
    # Crear DataFrames con faltantes
    df_faltantes_1 = df2[df2[columna_clave].isin(faltantes_en_1)].copy() if faltantes_en_1 else pd.DataFrame(columns=df2.columns)
    df_faltantes_2 = df1[df1[columna_clave].isin(faltantes_en_2)].copy() if faltantes_en_2 else pd.DataFrame(columns=df1.columns)
    
    # Unificar todos los datos
    df_unificado = pd.concat([df1, df2], ignore_index=True)
    df_unificado = df_unificado.drop_duplicates(subset=[columna_clave], keep='first')
    
    print(f"✅ Total registros unificados: {len(df_unificado)}")
    
    # Generar archivo de salida
    archivo_salida = 'resultado_comparacion.xlsx'
    print(f"\n💾 Generando archivo: {archivo_salida}...")
    
    try:
        with pd.ExcelWriter(archivo_salida, engine='openpyxl') as writer:
            # Hoja 1: Faltantes en archivo1
            nombre_hoja1 = f'Faltantes en {Path(archivo1).stem}'
            if not df_faltantes_1.empty:
                df_faltantes_1.to_excel(writer, sheet_name=nombre_hoja1, index=False)
                print(f"  ✓ Hoja 1: {len(df_faltantes_1)} registros faltantes en archivo 1")
            else:
                pd.DataFrame(columns=df2.columns).to_excel(
                    writer, sheet_name=nombre_hoja1, index=False
                )
                print(f"  ✓ Hoja 1: No hay faltantes en archivo 1")
            
            # Hoja 2: Faltantes en archivo2
            nombre_hoja2 = f'Faltantes en {Path(archivo2).stem}'
            if not df_faltantes_2.empty:
                df_faltantes_2.to_excel(writer, sheet_name=nombre_hoja2, index=False)
                print(f"  ✓ Hoja 2: {len(df_faltantes_2)} registros faltantes en archivo 2")
            else:
                pd.DataFrame(columns=df1.columns).to_excel(
                    writer, sheet_name=nombre_hoja2, index=False
                )
                print(f"  ✓ Hoja 2: No hay faltantes en archivo 2")
            
            # Hoja 3: Todos unificados
            df_unificado.to_excel(writer, sheet_name='Todos Unificados', index=False)
            print(f"  ✓ Hoja 3: {len(df_unificado)} registros unificados")
        
        print(f"\n{'='*70}")
        print(f"✅ Archivo generado exitosamente: {archivo_salida}")
        print(f"{'='*70}")
        return True
        
    except Exception as e:
        print(f"❌ Error al generar el archivo: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) == 3:
        comparar_archivos(sys.argv[1], sys.argv[2])
    else:
        comparar_archivos()

