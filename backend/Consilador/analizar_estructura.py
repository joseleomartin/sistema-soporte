"""
Script para analizar la estructura de los archivos y entender qué comparar
"""

import pandas as pd
import xlwings as xw

# Leer archivo 1
print("="*70)
print("ARCHIVO 1")
print("="*70)
df1 = pd.read_excel('1764777165398-wphjkp.xls', engine='xlrd')
print(f"Total registros: {len(df1)}")
print(f"\nColumnas: {df1.columns.tolist()}")
print(f"\nPrimeras 3 filas:")
print(df1[['CUIT Agente Ret./Perc.', 'Importe Ret./Perc.']].head(3))
print(f"\nCUITs únicos: {df1['CUIT Agente Ret./Perc.'].nunique()}")
print(f"Importes únicos: {df1['Importe Ret./Perc.'].nunique()}")

# Leer archivo 2
print("\n" + "="*70)
print("ARCHIVO 2")
print("="*70)
app = xw.App(visible=False)
wb = app.books.open('1764777166324-3tf60r.xls')
ws = wb.sheets[0]
data = ws.used_range.value
wb.close()
app.quit()

# Encontrar la fila de encabezados (buscar "Fecha Cobro" o "CUIT")
header_row = None
for i, row in enumerate(data):
    if row and any(cell and ('Fecha Cobro' in str(cell) or 'CUIT' in str(cell)) for cell in row):
        header_row = i
        break

if header_row:
    df2 = pd.DataFrame(data[header_row+1:], columns=data[header_row])
    # Limpiar datos
    df2 = df2.dropna(how='all')
    print(f"Total registros: {len(df2)}")
    print(f"\nColumnas: {df2.columns.tolist()}")
    
    # Buscar columna de CUIT e Importe
    cuit_col = None
    importe_col = None
    for col in df2.columns:
        if col and 'CUIT' in str(col):
            cuit_col = col
        if col and ('Importe' in str(col) or 'Retenido' in str(col)):
            importe_col = col
    
    if cuit_col and importe_col:
        print(f"\nColumna CUIT: {cuit_col}")
        print(f"Columna Importe: {importe_col}")
        print(f"\nPrimeras 3 filas:")
        print(df2[[cuit_col, importe_col]].head(3))
        
        # Normalizar CUITs (eliminar guiones)
        df2['CUIT_normalizado'] = df2[cuit_col].astype(str).str.replace('-', '').str.replace('.', '')
        df1['CUIT_normalizado'] = df1['CUIT Agente Ret./Perc.'].astype(str)
        
        print(f"\nCUITs únicos en archivo 2: {df2['CUIT_normalizado'].nunique()}")
        print(f"Importes únicos en archivo 2: {df2[importe_col].nunique()}")
        
        # Ver si hay CUITs comunes
        cuits_comunes = set(df1['CUIT_normalizado'].unique()) & set(df2['CUIT_normalizado'].dropna().unique())
        print(f"\nCUITs comunes: {len(cuits_comunes)}")
        if len(cuits_comunes) > 0:
            print(f"Ejemplos: {list(cuits_comunes)[:5]}")

print("\n" + "="*70)

