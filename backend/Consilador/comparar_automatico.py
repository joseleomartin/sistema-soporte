"""
Versión simplificada que compara automáticamente los archivos Excel en el directorio actual.
"""

import pandas as pd
from pathlib import Path
import glob

def leer_excel_multiple(archivo):
    """
    Intenta leer un archivo Excel con diferentes métodos, incluyendo recuperación de archivos corruptos.
    """
    engines = ['openpyxl', 'xlrd', None]
    
    for engine in engines:
        try:
            if engine:
                df = pd.read_excel(archivo, engine=engine)
            else:
                df = pd.read_excel(archivo)
            
            if not df.empty:
                return df
        except Exception as e:
            print(f"  Intento con {engine or 'default'}: {str(e)[:100]}")
            continue
    
    # Intentar con pyexcel si está disponible (mejor para archivos corruptos)
    try:
        print(f"  Intentando con pyexcel (mejor para archivos corruptos)...")
        import pyexcel as pe
        import pyexcel_xls
        records = pe.get_records(file_name=archivo)
        df = pd.DataFrame(list(records))
        if not df.empty:
            print(f"  ✓ Leído exitosamente con pyexcel")
            return df
    except ImportError:
        print(f"  pyexcel no está instalado (pip install pyexcel pyexcel-xls)")
    except Exception as e:
        print(f"  pyexcel falló: {str(e)[:100]}")
    
    # Intentar con xlwings si Excel está instalado
    try:
        print(f"  Intentando con xlwings (requiere Excel instalado)...")
        import xlwings as xw
        app = xw.App(visible=False)
        wb = app.books.open(archivo)
        ws = wb.sheets[0]
        data = ws.used_range.value
        wb.close()
        app.quit()
        
        if data:
            # Buscar la fila que contiene los encabezados reales (buscar palabras clave)
            header_row = 0
            palabras_clave = ['cuit', 'fecha', 'importe', 'retenido', 'saldo', 'monto']
            
            for i, row in enumerate(data):
                if row and any(cell and any(palabra in str(cell).lower() for palabra in palabras_clave) 
                              for cell in row if cell):
                    header_row = i
                    break
            
            # Convertir a DataFrame usando la fila de encabezados encontrada
            if header_row < len(data):
                df = pd.DataFrame(data[header_row+1:], columns=data[header_row])
                # Eliminar filas completamente vacías
                df = df.dropna(how='all')
                if not df.empty:
                    print(f"  ✓ Leído exitosamente con xlwings (encabezados en fila {header_row+1})")
                    return df
            
            # Si no se encontró encabezado, usar la primera fila como antes
            df = pd.DataFrame(data[1:], columns=data[0])
            df = df.dropna(how='all')
            if not df.empty:
                print(f"  ✓ Leído exitosamente con xlwings")
                return df
    except ImportError:
        print(f"  xlwings no está instalado (pip install xlwings)")
    except Exception as e:
        print(f"  xlwings falló: {str(e)[:100]}")
    
    # Intentar leer solo la primera hoja con diferentes opciones
    try:
        print(f"  Intentando lectura parcial (solo primera hoja)...")
        xl_file = pd.ExcelFile(archivo, engine='xlrd')
        if len(xl_file.sheet_names) > 0:
            df = pd.read_excel(xl_file, sheet_name=0, header=0)
            if not df.empty:
                print(f"  ✓ Leído parcialmente (primera hoja)")
                return df
    except Exception as e:
        print(f"  Lectura parcial falló: {str(e)[:100]}")
    
    # Si todos fallan, mostrar error detallado con sugerencias
    raise Exception(
        f"\n❌ No se pudo leer el archivo {archivo}.\n"
        f"El archivo parece estar corrupto.\n\n"
        f"SOLUCIONES:\n"
        f"1. Abre el archivo en Excel y guárdalo de nuevo (como .xlsx)\n"
        f"2. Instala pyexcel: pip install pyexcel pyexcel-xls\n"
        f"3. Si tienes Excel instalado: pip install xlwings\n"
        f"4. Intenta reparar el archivo con herramientas de Excel\n"
        f"5. Solicita una copia nueva del archivo"
    )

def comparar_archivos_actuales():
    """
    Compara automáticamente los archivos Excel encontrados en el directorio actual.
    """
    # Buscar archivos Excel (excluir el archivo de resultado si existe)
    archivos_excel = []
    for ext in ['*.xlsx', '*.xls']:
        archivos_excel.extend(glob.glob(ext))
    
    # Excluir el archivo de resultado de la comparación
    archivos_excel = [f for f in archivos_excel if not f.startswith('resultado_comparacion')]
    
    if len(archivos_excel) < 2:
        print(f"Error: Se necesitan al menos 2 archivos Excel en el directorio actual.")
        print(f"Archivos encontrados: {archivos_excel}")
        if len(archivos_excel) == 1:
            print(f"\nNota: Se excluyó 'resultado_comparacion.xlsx' de la búsqueda.")
        return False
    
    # Ordenar para usar los archivos más antiguos primero (los originales)
    archivos_excel.sort(key=lambda x: Path(x).stat().st_mtime)
    
    archivo1 = archivos_excel[0]
    archivo2 = archivos_excel[1]
    
    print(f"Archivo 1: {archivo1}")
    print(f"Archivo 2: {archivo2}\n")
    
    try:
        print(f"Leyendo {archivo1}...")
        df1 = leer_excel_multiple(archivo1)
        print(f"✓ Leído: {len(df1)} filas, {len(df1.columns)} columnas")
        
        print(f"\nLeyendo {archivo2}...")
        df2 = leer_excel_multiple(archivo2)
        print(f"✓ Leído: {len(df2)} filas, {len(df2.columns)} columnas")
        
    except Exception as e:
        print(f"Error: {e}")
        return False
    
    # Limpiar nombres de columnas (eliminar None y espacios)
    df1.columns = [str(col).strip() if col is not None else f'Columna_{i}' 
                   for i, col in enumerate(df1.columns)]
    df2.columns = [str(col).strip() if col is not None else f'Columna_{i}' 
                   for i, col in enumerate(df2.columns)]
    
    # Eliminar columnas completamente vacías o con nombres duplicados
    df1 = df1.loc[:, ~df1.columns.duplicated()]
    df2 = df2.loc[:, ~df2.columns.duplicated()]
    
    # Palabras clave para buscar columnas de saldo/importe
    palabras_saldo = ['saldo', 'importe', 'monto', 'cantidad', 'valor', 'total', 
                      'retencion', 'percepcion', 'ganancia', 'sufrida']
    
    def buscar_columna_saldo(columnas):
        """Busca una columna relacionada con saldo/importe"""
        columnas_lower = [str(col).lower() for col in columnas]
        for palabra in palabras_saldo:
            for i, col_lower in enumerate(columnas_lower):
                if palabra in col_lower:
                    return columnas[i]
        return None
    
    # Buscar columnas de saldo en ambos archivos
    col_saldo_1 = buscar_columna_saldo(df1.columns)
    col_saldo_2 = buscar_columna_saldo(df2.columns)
    
    # Mostrar columnas de saldo encontradas
    if col_saldo_1:
        print(f"\n📊 Columna de saldo detectada en archivo 1: '{col_saldo_1}'")
    if col_saldo_2:
        print(f"📊 Columna de saldo detectada en archivo 2: '{col_saldo_2}'")
    
    # Detectar columna clave priorizando saldo
    columna_clave = None
    
    # Prioridad 1: Columna de saldo común en ambos archivos
    if col_saldo_1 and col_saldo_1 in df2.columns:
        columna_clave = col_saldo_1
        print(f"✓ Usando columna de saldo común: '{columna_clave}'")
    # Prioridad 2: Si hay columnas de saldo en ambos pero con nombres diferentes, usar CUIT + Importe
    elif col_saldo_1 and col_saldo_2:
        # Buscar columnas de CUIT en ambos archivos
        def buscar_columna_cuit(columnas):
            """Busca una columna relacionada con CUIT"""
            columnas_lower = [str(col).lower() if col else '' for col in columnas]
            for i, col_lower in enumerate(columnas_lower):
                if 'cuit' in col_lower:
                    return columnas[i]
            return None
        
        col_cuit_1 = buscar_columna_cuit(df1.columns)
        col_cuit_2 = buscar_columna_cuit(df2.columns)
        
        # Normalizar valores de saldo (convertir a numérico y redondear)
        def normalizar_saldo(valor):
            try:
                if isinstance(valor, str):
                    valor = valor.replace(',', '').replace('$', '').replace(' ', '')
                return round(float(valor), 2)
            except:
                return str(valor).strip()
        
        def normalizar_cuit(valor):
            """Normaliza CUIT eliminando guiones y puntos"""
            if pd.isna(valor):
                return ''
            return str(valor).replace('-', '').replace('.', '').strip()
        
        # Si hay CUIT en ambos, usar CUIT + Importe como clave compuesta
        if col_cuit_1 and col_cuit_2:
            print(f"✓ Comparando por CUIT + Importe (más preciso)")
            print(f"   Archivo 1 - CUIT: '{col_cuit_1}', Importe: '{col_saldo_1}'")
            print(f"   Archivo 2 - CUIT: '{col_cuit_2}', Importe: '{col_saldo_2}'")
            
            df1['_cuit_norm'] = df1[col_cuit_1].apply(normalizar_cuit)
            df1['_saldo_norm'] = df1[col_saldo_1].apply(normalizar_saldo).astype(str)
            df1['_clave_compuesta'] = df1['_cuit_norm'] + '|' + df1['_saldo_norm']
            
            df2['_cuit_norm'] = df2[col_cuit_2].apply(normalizar_cuit)
            df2['_saldo_norm'] = df2[col_saldo_2].apply(normalizar_saldo).astype(str)
            df2['_clave_compuesta'] = df2['_cuit_norm'] + '|' + df2['_saldo_norm']
            
            columna_clave = '_clave_compuesta'
        else:
            # Si no hay CUIT, usar solo saldo
            print(f"✓ Comparando por valores de saldo (columnas diferentes)")
            print(f"   Archivo 1: '{col_saldo_1}'")
            print(f"   Archivo 2: '{col_saldo_2}'")
            
            df1['_saldo_comparacion'] = df1[col_saldo_1].apply(normalizar_saldo).astype(str)
            df2['_saldo_comparacion'] = df2[col_saldo_2].apply(normalizar_saldo).astype(str)
            columna_clave = '_saldo_comparacion'
    # Prioridad 3: Cualquier columna común
    else:
        cols_comunes = set(df1.columns) & set(df2.columns)
        if cols_comunes:
            # Si hay columnas de saldo en común, priorizarlas
            cols_saldo_comunes = [c for c in cols_comunes if buscar_columna_saldo([c])]
            if cols_saldo_comunes:
                columna_clave = cols_saldo_comunes[0]
                print(f"\n✓ Usando columna de saldo común: '{columna_clave}'")
            else:
                columna_clave = list(cols_comunes)[0]
                print(f"\n✓ Usando columna común: '{columna_clave}'")
        # Prioridad 4: Primera columna no vacía del archivo 1
        else:
            for col in df1.columns:
                if df1[col].notna().any():
                    columna_clave = col
                    break
            if columna_clave is None:
                columna_clave = df1.columns[0]
    
    print(f"Columnas archivo 1: {len(df1.columns)}")
    print(f"Columnas archivo 2: {len(df2.columns)}")
    
    # Verificar que la columna existe en ambos
    if columna_clave not in df2.columns:
        print(f"⚠️  Advertencia: La columna '{columna_clave}' no existe en el segundo archivo.")
        # Mostrar columnas disponibles de forma segura
        cols2 = [str(c) if c is not None else f'Columna_{i}' for i, c in enumerate(df2.columns)]
        print(f"Columnas del archivo 2: {', '.join(cols2[:10])}")  # Mostrar solo las primeras 10
        
        # Intentar encontrar una columna común
        cols_comunes = set(df1.columns) & set(df2.columns)
        if cols_comunes:
            # Priorizar columnas de saldo
            cols_saldo_comunes = [c for c in cols_comunes if buscar_columna_saldo([c])]
            if cols_saldo_comunes:
                columna_clave = cols_saldo_comunes[0]
                print(f"✓ Usando columna de saldo común: '{columna_clave}'")
            else:
                columna_clave = list(cols_comunes)[0]
                print(f"✓ Usando columna común: '{columna_clave}'")
        else:
            # Si no hay columnas comunes, usar el índice como clave
            print(f"⚠️  No hay columnas comunes entre los archivos.")
            print(f"   Usando el índice de filas como clave de comparación.")
            # Crear una columna temporal con el índice
            df1['_indice_temp'] = df1.index.astype(str)
            df2['_indice_temp'] = df2.index.astype(str)
            columna_clave = '_indice_temp'
    
    # Verificar que la columna existe en ambos antes de usarla
    if columna_clave not in df1.columns or columna_clave not in df2.columns:
        print(f"❌ Error: La columna '{columna_clave}' no está disponible en ambos archivos.")
        return False
    
    # Convertir a string para comparación (solo si no es una columna temporal ya creada)
    if columna_clave not in ['_clave_compuesta', '_saldo_comparacion', '_indice_temp']:
        df1[columna_clave] = df1[columna_clave].astype(str).str.strip()
        df2[columna_clave] = df2[columna_clave].astype(str).str.strip()
    
    # Obtener valores únicos
    valores1 = set(df1[columna_clave].dropna().unique())
    valores2 = set(df2[columna_clave].dropna().unique())
    
    # Encontrar faltantes y conciliados
    faltantes_en_1 = valores2 - valores1
    faltantes_en_2 = valores1 - valores2
    conciliados = valores1 & valores2  # Intersección: registros en ambos archivos
    
    print(f"\n{'='*60}")
    print(f"RESUMEN DE COMPARACIÓN")
    print(f"{'='*60}")
    print(f"Total registros en archivo 1: {len(df1)}")
    print(f"Total registros en archivo 2: {len(df2)}")
    print(f"Valores únicos en archivo 1: {len(valores1)}")
    print(f"Valores únicos en archivo 2: {len(valores2)}")
    print(f"\nFaltantes en archivo 1: {len(faltantes_en_1)}")
    print(f"Faltantes en archivo 2: {len(faltantes_en_2)}")
    print(f"Retenciones conciliadas: {len(conciliados)}")
    print(f"{'='*60}\n")
    
    # Definir columnas temporales que deben eliminarse
    columnas_temp = ['_indice_temp', '_saldo_comparacion', '_cuit_norm', '_saldo_norm', '_clave_compuesta']
    
    # Crear DataFrames con faltantes y conciliados ANTES de eliminar columnas temporales
    df_faltantes_1 = df2[df2[columna_clave].isin(faltantes_en_1)].copy() if faltantes_en_1 else pd.DataFrame(columns=df2.columns)
    df_faltantes_2 = df1[df1[columna_clave].isin(faltantes_en_2)].copy() if faltantes_en_2 else pd.DataFrame(columns=df1.columns)
    
    # Crear DataFrame con retenciones conciliadas (presentes en ambos archivos)
    # Tomar los registros del archivo 1 que están conciliados
    df_conciliados_1 = df1[df1[columna_clave].isin(conciliados)].copy()
    df_conciliados_2 = df2[df2[columna_clave].isin(conciliados)].copy()
    
    # Eliminar columnas temporales si se usaron (después de crear todos los DataFrames)
    for col_temp in columnas_temp:
        if col_temp in df_faltantes_1.columns:
            df_faltantes_1 = df_faltantes_1.drop(columns=[col_temp], errors='ignore')
        if col_temp in df_faltantes_2.columns:
            df_faltantes_2 = df_faltantes_2.drop(columns=[col_temp], errors='ignore')
        if col_temp in df_conciliados_1.columns:
            df_conciliados_1 = df_conciliados_1.drop(columns=[col_temp], errors='ignore')
        if col_temp in df_conciliados_2.columns:
            df_conciliados_2 = df_conciliados_2.drop(columns=[col_temp], errors='ignore')
        # Eliminar también de los DataFrames originales para la consolidación
        if col_temp in df1.columns:
            df1 = df1.drop(columns=[col_temp], errors='ignore')
        if col_temp in df2.columns:
            df2 = df2.drop(columns=[col_temp], errors='ignore')
    
    # Para las retenciones conciliadas, usar el archivo que tenga más información (más columnas)
    # O combinar inteligentemente las columnas de ambos
    if not df_conciliados_1.empty and not df_conciliados_2.empty:
        # Usar el archivo 2 (que generalmente tiene más columnas) como base
        # y agregar columnas del archivo 1 que no existan
        df_conciliados = df_conciliados_2.copy()
        
        # Agregar columnas del archivo 1 que no estén en el archivo 2
        columnas_faltantes = [c for c in df_conciliados_1.columns if c not in df_conciliados.columns and c not in columnas_temp]
        if columnas_faltantes:
            # Hacer un merge basado en la columna clave para agregar las columnas faltantes
            if columna_clave in df_conciliados.columns and columna_clave in df_conciliados_1.columns:
                df_conciliados = df_conciliados.merge(
                    df_conciliados_1[[columna_clave] + columnas_faltantes],
                    on=columna_clave,
                    how='left',
                    suffixes=('', '_archivo1')
                )
    elif not df_conciliados_1.empty:
        df_conciliados = df_conciliados_1.copy()
    elif not df_conciliados_2.empty:
        df_conciliados = df_conciliados_2.copy()
    else:
        # Si no hay conciliados, crear DataFrame vacío con columnas combinadas
        todas_columnas = list(df1.columns) + [c for c in df2.columns if c not in df1.columns]
        df_conciliados = pd.DataFrame(columns=todas_columnas)
    
    # Eliminar columnas temporales de los conciliados (si aún existen)
    for col_temp in columnas_temp:
        if col_temp in df_conciliados.columns:
            df_conciliados = df_conciliados.drop(columns=[col_temp], errors='ignore')
    
    # Crear DataFrame consolidado con TODAS las transacciones de ambos archivos
    # La idea es unificar todas las transacciones completas, sin eliminar duplicados
    # Obtener todas las columnas únicas de ambos archivos originales
    todas_columnas_consolidadas = set()
    if not df1.empty:
        todas_columnas_consolidadas.update([c for c in df1.columns if c not in columnas_temp])
    if not df2.empty:
        todas_columnas_consolidadas.update([c for c in df2.columns if c not in columnas_temp])
    
    # Convertir set a lista ordenada
    lista_columnas_consolidadas = sorted(list(todas_columnas_consolidadas))
    
    # Preparar DataFrames originales (sin columnas temporales) para consolidar
    df1_consolidado = df1.copy()
    df2_consolidado = df2.copy()
    
    # Asegurar que ambos DataFrames tengan las mismas columnas
    for col in lista_columnas_consolidadas:
        if col not in df1_consolidado.columns:
            df1_consolidado[col] = None
        if col not in df2_consolidado.columns:
            df2_consolidado[col] = None
    
    # Consolidar TODAS las transacciones de ambos archivos
    dfs_para_consolidar = []
    
    # Agregar TODAS las transacciones del archivo 1
    if not df1_consolidado.empty:
        dfs_para_consolidar.append(df1_consolidado[lista_columnas_consolidadas])
    
    # Agregar TODAS las transacciones del archivo 2
    if not df2_consolidado.empty:
        dfs_para_consolidar.append(df2_consolidado[lista_columnas_consolidadas])
    
    # Consolidar todos los DataFrames (TODAS las transacciones)
    if dfs_para_consolidar:
        df_consolidado = pd.concat(dfs_para_consolidar, ignore_index=True)
        
        # Ordenar columnas de manera consistente (priorizar columnas del archivo 2, luego del 1)
        columnas_ordenadas = []
        if not df2.empty:
            columnas_ordenadas.extend([c for c in df2.columns if c in df_consolidado.columns and c not in columnas_temp])
        if not df1.empty:
            columnas_ordenadas.extend([c for c in df1.columns if c in df_consolidado.columns and c not in columnas_temp and c not in columnas_ordenadas])
        # Agregar cualquier columna restante
        columnas_ordenadas.extend([c for c in df_consolidado.columns if c not in columnas_ordenadas and c not in columnas_temp])
        
        # Reordenar columnas
        df_consolidado = df_consolidado[columnas_ordenadas]
        
        # Recrear la clave compuesta si es necesario para eliminar duplicados
        # Buscar columnas de CUIT e Importe en el DataFrame consolidado
        def buscar_columna_cuit(columnas):
            for col in columnas:
                if col and 'cuit' in str(col).lower():
                    return col
            return None
        
        def buscar_columna_importe(columnas):
            for col in columnas:
                if col and any(palabra in str(col).lower() for palabra in ['importe', 'saldo', 'retenido', 'monto']):
                    return col
            return None
        
        # Buscar todas las columnas de CUIT e Importe (puede haber de ambos archivos)
        col_cuit_1 = buscar_columna_cuit([c for c in df_consolidado.columns if 'Agente' in str(c) or 'Ret./Perc' in str(c)])
        col_cuit_2 = buscar_columna_cuit([c for c in df_consolidado.columns if c not in [col_cuit_1] and 'cuit' in str(c).lower()])
        col_importe_1 = buscar_columna_importe([c for c in df_consolidado.columns if 'Ret./Perc' in str(c)])
        col_importe_2 = buscar_columna_importe([c for c in df_consolidado.columns if c not in [col_importe_1] and any(p in str(c).lower() for p in ['importe', 'retenido', 'saldo'])])
        
        # Si tenemos CUIT e Importe, crear clave compuesta para eliminar duplicados
        # Combinar ambas columnas (usar la que tenga valor)
        if (col_cuit_1 or col_cuit_2) and (col_importe_1 or col_importe_2):
            def normalizar_cuit(valor):
                if pd.isna(valor):
                    return ''
                return str(valor).replace('-', '').replace('.', '').strip()
            
            def normalizar_importe(valor):
                try:
                    if pd.isna(valor):
                        return ''
                    if isinstance(valor, str):
                        valor = valor.replace(',', '').replace('$', '').replace(' ', '')
                    return str(round(float(valor), 2))
                except:
                    return str(valor).strip() if not pd.isna(valor) else ''
            
            # Combinar CUITs de ambas columnas (usar la que tenga valor, o combinar si ambas tienen)
            def obtener_cuit(row):
                cuit_val = ''
                if col_cuit_1 and not pd.isna(row[col_cuit_1]):
                    cuit_val = str(row[col_cuit_1])
                elif col_cuit_2 and not pd.isna(row[col_cuit_2]):
                    cuit_val = str(row[col_cuit_2])
                return normalizar_cuit(cuit_val)
            
            # Combinar Importes de ambas columnas (usar la que tenga valor)
            def obtener_importe(row):
                importe_val = ''
                if col_importe_1 and not pd.isna(row[col_importe_1]):
                    importe_val = row[col_importe_1]
                elif col_importe_2 and not pd.isna(row[col_importe_2]):
                    importe_val = row[col_importe_2]
                return normalizar_importe(importe_val)
            
            # Crear clave combinada
            df_consolidado['_cuit_norm'] = df_consolidado.apply(obtener_cuit, axis=1)
            df_consolidado['_importe_norm'] = df_consolidado.apply(obtener_importe, axis=1)
            df_consolidado['_clave_dup'] = df_consolidado['_cuit_norm'] + '|' + df_consolidado['_importe_norm']
            
            # Ordenar para que los registros del archivo 1 (con más información) aparezcan primero
            # Crear columna auxiliar para ordenar: 1 si tiene datos del archivo 1, 2 si solo tiene del archivo 2
            def tiene_datos_archivo1(row):
                if col_cuit_1 and not pd.isna(row[col_cuit_1]):
                    return 1
                if col_importe_1 and not pd.isna(row[col_importe_1]):
                    return 1
                return 2
            
            df_consolidado['_orden_prioridad'] = df_consolidado.apply(tiene_datos_archivo1, axis=1)
            df_consolidado = df_consolidado.sort_values('_orden_prioridad')
            
            # Agrupar por clave y combinar datos de ambas fuentes
            # Priorizar datos del archivo 1, pero completar con datos del archivo 2 donde falten
            def combinar_columnas(serie):
                # Eliminar valores NaN y vacíos
                valores = serie.dropna()
                valores = valores[valores != '']
                if len(valores) > 0:
                    # Retornar el primer valor no nulo (priorizar archivo 1)
                    return valores.iloc[0]
                return None
            
            # Agrupar por clave y combinar todas las columnas
            df_consolidado = df_consolidado.groupby('_clave_dup').agg(combinar_columnas).reset_index()
            
            # Eliminar las columnas temporales
            df_consolidado = df_consolidado.drop(columns=['_clave_dup', '_cuit_norm', '_importe_norm', '_orden_prioridad'], errors='ignore')
        elif columna_clave in df_consolidado.columns and columna_clave not in columnas_temp:
            # Usar la columna clave original si existe
            df_consolidado = df_consolidado.drop_duplicates(subset=[columna_clave], keep='first')
        else:
            # Si no hay columna clave, eliminar duplicados completos
            df_consolidado = df_consolidado.drop_duplicates(keep='first')
    else:
        # Si no hay datos, crear DataFrame vacío
        df_consolidado = pd.DataFrame(columns=lista_columnas_consolidadas)
    
    print(f"Total retenciones conciliadas: {len(df_conciliados)}")
    print(f"Total transacciones archivo 1: {len(df1)}")
    print(f"Total transacciones archivo 2: {len(df2)}")
    print(f"Total retenciones consolidadas (únicas, sin duplicados): {len(df_consolidado)}")
    
    # Función para eliminar filas que contengan "Total"
    def eliminar_filas_total(df):
        if df.empty:
            return df
        # Buscar filas que tengan "Total" en cualquier columna (case insensitive)
        mask = df.astype(str).apply(lambda row: row.str.contains('Total', case=False, na=False).any(), axis=1)
        df_filtrado = df[~mask].copy()
        return df_filtrado
    
    # Eliminar filas con "Total" de todos los DataFrames
    df_faltantes_1 = eliminar_filas_total(df_faltantes_1)
    df_faltantes_2 = eliminar_filas_total(df_faltantes_2)
    df_consolidado = eliminar_filas_total(df_consolidado)
    
    # Función para limpiar y organizar DataFrame
    def limpiar_y_organizar(df):
        if df.empty:
            return df
        
        # Eliminar columnas completamente vacías (todas NaN o vacías)
        df = df.dropna(axis=1, how='all')
        df = df.loc[:, ~(df.astype(str).apply(lambda x: x.str.strip().eq('').all()))]
        
        # Reemplazar NaN con cadenas vacías en columnas de texto para mejor presentación
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].fillna('')
        
        # Ordenar columnas de manera lógica (priorizar columnas importantes)
        columnas_importantes = []
        otras_columnas = []
        
        # Identificar columnas importantes
        for col in df.columns:
            col_lower = str(col).lower()
            if any(palabra in col_lower for palabra in ['cuit', 'agente', 'razon', 'denominacion', 'nombre']):
                columnas_importantes.insert(0, col)  # Al principio
            elif any(palabra in col_lower for palabra in ['importe', 'saldo', 'retenido', 'monto', 'total']):
                columnas_importantes.append(col)  # Después de nombres
            elif any(palabra in col_lower for palabra in ['fecha', 'date']):
                columnas_importantes.append(col)  # Después de importes
            else:
                otras_columnas.append(col)
        
        # Reordenar: importantes primero, luego las demás
        columnas_ordenadas = columnas_importantes + otras_columnas
        # Solo mantener las columnas que existen
        columnas_ordenadas = [c for c in columnas_ordenadas if c in df.columns]
        # Agregar cualquier columna que falte
        for col in df.columns:
            if col not in columnas_ordenadas:
                columnas_ordenadas.append(col)
        
        df = df[columnas_ordenadas]
        
        # Eliminar columnas duplicadas (por nombre)
        df = df.loc[:, ~df.columns.duplicated()]
        
        # Ordenar filas de manera lógica
        try:
            col_cuit_orden = None
            for col in df.columns:
                if 'cuit' in str(col).lower() and 'agente' in str(col).lower():
                    col_cuit_orden = col
                    break
            
            if not col_cuit_orden:
                for col in df.columns:
                    if 'cuit' in str(col).lower():
                        col_cuit_orden = col
                        break
            
            if col_cuit_orden and col_cuit_orden in df.columns:
                # Convertir CUIT a string y limpiar para ordenar
                df_temp = df.copy()
                df_temp['_cuit_orden'] = df_temp[col_cuit_orden].astype(str).str.replace('-', '').str.replace('.', '').str.strip()
                df_temp = df_temp.sort_values(by='_cuit_orden', na_position='last')
                df = df_temp.drop(columns=['_cuit_orden'])
            else:
                # Ordenar por primera columna con datos
                for col in df.columns:
                    if not df[col].isna().all():
                        try:
                            df = df.sort_values(by=col, na_position='last')
                            break
                        except:
                            continue
        except Exception as e:
            # Si hay error al ordenar, continuar sin ordenar
            pass
        
        # Resetear índice
        df = df.reset_index(drop=True)
        
        # Limpiar espacios en blanco al inicio y final de strings
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].astype(str).str.strip()
                # Reemplazar 'nan' string con vacío
                df[col] = df[col].replace('nan', '')
        
        return df
    
    # Limpiar y organizar todos los DataFrames
    df_faltantes_1 = limpiar_y_organizar(df_faltantes_1)
    df_faltantes_2 = limpiar_y_organizar(df_faltantes_2)
    df_consolidado = limpiar_y_organizar(df_consolidado)
    
    # Generar archivo de salida
    archivo_salida = 'resultado_comparacion.xlsx'
    print(f"\nGenerando archivo: {archivo_salida}...")
    
    try:
        with pd.ExcelWriter(archivo_salida, engine='openpyxl') as writer:
            # Hoja 1: Faltantes en archivo1
            if not df_faltantes_1.empty:
                df_faltantes_1.to_excel(writer, sheet_name='Faltantes en Archivo 1', index=False)
                print(f"  ✓ Hoja 1: {len(df_faltantes_1)} registros faltantes en archivo 1")
            else:
                pd.DataFrame(columns=df2.columns).to_excel(
                    writer, sheet_name='Faltantes en Archivo 1', index=False
                )
                print(f"  ✓ Hoja 1: No hay faltantes en archivo 1")
            
            # Hoja 2: Faltantes en archivo2
            if not df_faltantes_2.empty:
                df_faltantes_2.to_excel(writer, sheet_name='Faltantes en Archivo 2', index=False)
                print(f"  ✓ Hoja 2: {len(df_faltantes_2)} registros faltantes en archivo 2")
            else:
                pd.DataFrame(columns=df1.columns).to_excel(
                    writer, sheet_name='Faltantes en Archivo 2', index=False
                )
                print(f"  ✓ Hoja 2: No hay faltantes en archivo 2")
            
            # Hoja 3: Retenciones consolidadas (todas las transacciones únicas, sin duplicados)
            df_consolidado.to_excel(writer, sheet_name='Retenciones consolidadas', index=False)
            print(f"  ✓ Hoja 3: {len(df_consolidado)} retenciones consolidadas (únicas, sin duplicados)")
        
        print(f"\n{'='*60}")
        print(f"✓ Archivo generado exitosamente: {archivo_salida}")
        print(f"{'='*60}")
        return True
        
    except Exception as e:
        print(f"Error al generar el archivo: {e}")
        return False

if __name__ == "__main__":
    comparar_archivos_actuales()

