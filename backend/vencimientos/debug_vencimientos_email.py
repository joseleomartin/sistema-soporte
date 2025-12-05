"""
Script de depuración para verificar vencimientos de diciembre 2025
"""

import pandas as pd
import os
from pathlib import Path
from datetime import datetime

# Configuración
CUIL_EJEMPLO = "20-38533918-7"
MES_ACTUAL = 12  # Diciembre
ANIO_ACTUAL = 2025

# Directorio de vencimientos
VENCIMIENTOS_DIR = Path(__file__).parent
print("=" * 80)
print("DEBUG VENCIMIENTOS - DICIEMBRE 2025")
print("=" * 80)
print(f"CUIL: {CUIL_EJEMPLO}")
print(f"Último dígito: 7")
print(f"Mes: Diciembre ({MES_ACTUAL})")
print(f"Año: {ANIO_ACTUAL}")
print()

# Buscar archivo consolidado más reciente
archivos = list(VENCIMIENTOS_DIR.glob("vencimientos_consolidado_*.xlsx"))
if not archivos:
    print("[ERROR] No se encontró archivo consolidado")
    exit(1)

archivo = max(archivos, key=os.path.getmtime)
print(f"Archivo: {archivo.name}")
print()

# Diccionario de meses
meses_espanol = {
    'enero': 1, 'ene': 1,
    'febrero': 2, 'feb': 2,
    'marzo': 3, 'mar': 3,
    'abril': 4, 'abr': 4,
    'mayo': 5, 'may': 5,
    'junio': 6, 'jun': 6,
    'julio': 7, 'jul': 7,
    'agosto': 8, 'ago': 8,
    'septiembre': 9, 'sep': 9, 'sept': 9,
    'octubre': 10, 'oct': 10,
    'noviembre': 11, 'nov': 11,
    'diciembre': 12, 'dic': 12
}

# Leer archivo
excel_file = pd.ExcelFile(archivo)
print(f"Hojas encontradas: {len(excel_file.sheet_names)}")
print()

total_vencimientos_encontrados = 0
vencimientos_por_hoja = {}

for sheet_name in excel_file.sheet_names:
    print("=" * 80)
    print(f"HOJA: {sheet_name}")
    print("=" * 80)
    
    df = pd.read_excel(excel_file, sheet_name=sheet_name)
    df = df.where(pd.notna(df), None)
    
    print(f"Columnas: {list(df.columns)}")
    print(f"Filas: {len(df)}")
    print()
    
    # Buscar columna de período
    columnas_periodo = [col for col in df.columns if any(term in str(col).lower() for term in ['mes de devengamiento', 'periodo devengado', 'mes'])]
    
    if not columnas_periodo:
        print("[SKIP] No tiene columna de período")
        print()
        continue
    
    col_periodo = columnas_periodo[0]
    print(f"Columna de período: {col_periodo}")
    
    # Buscar columnas de fechas
    columnas_fechas = [col for col in df.columns if 'vencimiento' in str(col).lower() or 'fecha' in str(col).lower()]
    print(f"Columnas de fechas: {columnas_fechas}")
    print()
    
    # Mostrar primeras filas
    print("Primeras 5 filas:")
    print(df.head(5).to_string())
    print()
    
    # Buscar filas con período de diciembre 2025
    print("Buscando filas de Diciembre 2025...")
    indices_diciembre = []
    
    for idx, fila in df.iterrows():
        valor_periodo = fila.get(col_periodo)
        if pd.notna(valor_periodo) and valor_periodo:
            periodo_texto = str(valor_periodo).lower().strip()
            
            if 'diciembre' in periodo_texto or 'dic' in periodo_texto:
                # Verificar que sea 2025 o no tenga año
                if '2025' in periodo_texto or not any(str(y) in periodo_texto for y in range(2020, 2030)):
                    # Verificar que NO sea diferido
                    if 'diferido' not in periodo_texto or periodo_texto.index('diciembre' if 'diciembre' in periodo_texto else 'dic') < periodo_texto.index('diferido'):
                        indices_diciembre.append(idx)
                        print(f"  [OK] Fila {idx}: {periodo_texto}")
    
    if not indices_diciembre:
        print("  [X] No se encontraron filas de Diciembre 2025")
        print()
        continue
    
    print(f"\n{len(indices_diciembre)} filas encontradas para Diciembre 2025")
    print()
    
    # Determinar columna de fecha para terminación 7
    print("Determinando columna de fecha para terminación 7...")
    
    tiene_division_digitos = any('terminación' in str(c).lower() or 'cuit' in str(c).lower() for c in columnas_fechas)
    print(f"Tiene división por dígitos: {tiene_division_digitos}")
    
    columna_fecha_digito = None
    
    if not tiene_division_digitos and len(columnas_fechas) >= 1:
        # Sin división por dígitos (ej: servicio doméstico)
        columna_fecha_digito = columnas_fechas[0]
        print(f"  Sin división: usando {columna_fecha_digito}")
    elif len(columnas_fechas) <= 3 and not any('.1' in str(c) or '.2' in str(c) for c in columnas_fechas):
        # Formato simplificado
        # Terminación 7 está en el grupo 7,8,9 (tercera columna)
        if len(columnas_fechas) >= 3:
            columna_fecha_digito = columnas_fechas[2]
            print(f"  Formato simplificado (3 cols): usando columna 3: {columna_fecha_digito}")
        elif len(columnas_fechas) == 2:
            columna_fecha_digito = columnas_fechas[1]
            print(f"  Formato simplificado (2 cols): usando columna 2: {columna_fecha_digito}")
    else:
        # Formato estándar con sufijos
        # Terminación 7 está en el grupo 7,8,9 (columna con .2 o .4)
        tercera = [c for c in columnas_fechas if '.2' in str(c)]
        if not tercera:
            tercera = [c for c in columnas_fechas if '.4' in str(c)]
        if tercera:
            columna_fecha_digito = tercera[0]
            print(f"  Formato estándar: usando {columna_fecha_digito}")
    
    if not columna_fecha_digito:
        print("  [X] No se pudo determinar columna de fecha")
        print()
        continue
    
    print(f"  [OK] Columna seleccionada: {columna_fecha_digito}")
    print()
    
    # Buscar fecha en las filas de diciembre
    print("Extrayendo fechas...")
    for idx in indices_diciembre:
        fila = df.iloc[idx]
        fecha_vencimiento = fila.get(columna_fecha_digito)
        
        print(f"  Fila {idx}:")
        print(f"    Período: {fila.get(col_periodo)}")
        print(f"    Fecha en columna {columna_fecha_digito}: {fecha_vencimiento}")
        
        if pd.notna(fecha_vencimiento) and str(fecha_vencimiento).strip():
            fecha_str = str(fecha_vencimiento).strip()
            
            # Verificar si es una fecha válida
            es_fecha_valida = '-' in fecha_str or '/' in fecha_str
            tiene_separadores_invalidos = 'y' in fecha_str.lower() or ',' in fecha_str
            
            print(f"    ¿Es fecha válida? {es_fecha_valida and not tiene_separadores_invalidos}")
            print(f"    Contenido: '{fecha_str}'")
            
            if es_fecha_valida and not tiene_separadores_invalidos:
                # Parsear fecha para verificar que sea diciembre 2025
                try:
                    separador = '-' if '-' in fecha_str else '/'
                    partes = fecha_str.split(separador)
                    
                    if len(partes) >= 2:
                        dia = partes[0].strip()
                        mes_parte = partes[1].strip().lower()
                        anio_parte = partes[2].strip() if len(partes) > 2 else str(ANIO_ACTUAL)
                        
                        if mes_parte in meses_espanol:
                            mes_num = meses_espanol[mes_parte]
                        elif mes_parte.isdigit():
                            mes_num = int(mes_parte)
                        else:
                            print(f"    [X] No se pudo parsear el mes: {mes_parte}")
                            continue
                        
                        if len(anio_parte) == 2:
                            anio_parte = '20' + anio_parte
                        
                        anio_num = int(anio_parte) if anio_parte.isdigit() else ANIO_ACTUAL
                        
                        print(f"    Parseado: día={dia}, mes={mes_num}, año={anio_num}")
                        
                        if mes_num == MES_ACTUAL and anio_num == ANIO_ACTUAL:
                            print(f"    [OK] ¡VENCIMIENTO VÁLIDO PARA DICIEMBRE 2025!")
                            total_vencimientos_encontrados += 1
                            
                            if sheet_name not in vencimientos_por_hoja:
                                vencimientos_por_hoja[sheet_name] = []
                            vencimientos_por_hoja[sheet_name].append({
                                'fecha': fecha_str,
                                'periodo': str(fila.get(col_periodo))
                            })
                        else:
                            print(f"    [X] Fecha es de {mes_num}/{anio_num}, no coincide")
                except Exception as e:
                    print(f"    [ERROR] Error parseando: {e}")
            else:
                # Buscar en la siguiente fila
                siguiente_idx = idx + 1
                if siguiente_idx < len(df):
                    fila_siguiente = df.iloc[siguiente_idx]
                    fecha_siguiente = fila_siguiente.get(columna_fecha_digito)
                    
                    print(f"    Buscando en fila siguiente {siguiente_idx}: {fecha_siguiente}")
                    
                    if pd.notna(fecha_siguiente) and str(fecha_siguiente).strip():
                        fecha_str_sig = str(fecha_siguiente).strip()
                        es_fecha_valida_sig = '-' in fecha_str_sig or '/' in fecha_str_sig
                        tiene_separadores_invalidos_sig = 'y' in fecha_str_sig.lower() or ',' in fecha_str_sig
                        
                        if es_fecha_valida_sig and not tiene_separadores_invalidos_sig:
                            print(f"    [OK] Fecha válida encontrada en siguiente fila: {fecha_str_sig}")
                            # Parsear igual que antes...
                            try:
                                separador = '-' if '-' in fecha_str_sig else '/'
                                partes = fecha_str_sig.split(separador)
                                
                                if len(partes) >= 2:
                                    mes_parte = partes[1].strip().lower()
                                    anio_parte = partes[2].strip() if len(partes) > 2 else str(ANIO_ACTUAL)
                                    
                                    if mes_parte in meses_espanol:
                                        mes_num = meses_espanol[mes_parte]
                                    elif mes_parte.isdigit():
                                        mes_num = int(mes_parte)
                                    else:
                                        continue
                                    
                                    if len(anio_parte) == 2:
                                        anio_parte = '20' + anio_parte
                                    
                                    anio_num = int(anio_parte) if anio_parte.isdigit() else ANIO_ACTUAL
                                    
                                    if mes_num == MES_ACTUAL and anio_num == ANIO_ACTUAL:
                                        print(f"    [OK] ¡VENCIMIENTO VÁLIDO PARA DICIEMBRE 2025!")
                                        total_vencimientos_encontrados += 1
                                        
                                        if sheet_name not in vencimientos_por_hoja:
                                            vencimientos_por_hoja[sheet_name] = []
                                        vencimientos_por_hoja[sheet_name].append({
                                            'fecha': fecha_str_sig,
                                            'periodo': str(fila.get(col_periodo))
                                        })
                            except Exception as e:
                                print(f"    [ERROR] Error parseando siguiente: {e}")
        print()
    
    print()

print("=" * 80)
print("RESUMEN")
print("=" * 80)
print(f"Total vencimientos encontrados: {total_vencimientos_encontrados}")
print()

if vencimientos_por_hoja:
    print("Vencimientos por hoja:")
    for hoja, vencs in vencimientos_por_hoja.items():
        print(f"\n{hoja}:")
        for venc in vencs:
            print(f"  - Fecha: {venc['fecha']} | Período: {venc['periodo']}")
else:
    print("No se encontraron vencimientos")

