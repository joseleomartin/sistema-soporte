#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import camelot
import pandas as pd
import re
import os
import pdfplumber

def safe_print(texto):
    """Imprimir texto de forma segura en Windows"""
    try:
        mensaje = str(texto)
        mensaje = mensaje.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        mensaje = mensaje.replace('\U0001f504', '')
        mensaje = mensaje.replace('\U0001f4ca', '')
        mensaje = mensaje.replace('\U0001f4c4', '')
        mensaje = mensaje.replace('\u2705', 'OK')
        mensaje = mensaje.replace('\u274c', 'ERROR')
        mensaje = mensaje.replace('\u26a0', 'WARNING')
        mensaje = mensaje.replace('\U0001f4b0', '')
        try:
            print(mensaje)
        except UnicodeEncodeError:
            print(mensaje.encode('ascii', errors='replace').decode('ascii'))
    except Exception:
        try:
            print(str(texto).encode('ascii', errors='replace').decode('ascii'))
        except Exception:
            print("Error al imprimir mensaje")

def extraer_datos_banco_galicia(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco Galicia"""
    try:
        if not os.path.exists(pdf_path):
            safe_print(f"ERROR: El archivo PDF no existe: {pdf_path}")
            return pd.DataFrame()
        
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Extraer Saldo Deudores y Saldo Inicial del texto del PDF
        saldo_deudores_promedio = ''
        saldo_deudores_intereses = ''
        saldo_inicial = ''
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                texto_completo = ''
                texto_primera_pagina = ''
                
                # Primero intentar extraer tablas de la primera página con pdfplumber
                if len(pdf.pages) > 0:
                    primera_pagina = pdf.pages[0]
                    texto_primera_pagina = primera_pagina.extract_text() or ''
                    
                    # Intentar extraer tablas de la primera página
                    try:
                        tablas_primera = primera_pagina.extract_tables()
                        if tablas_primera:
                            safe_print(f"Encontradas {len(tablas_primera)} tablas en la primera página")
                            for tabla_idx, tabla in enumerate(tablas_primera):
                                # Buscar "Saldo inicial" en todas las celdas de la tabla
                                for fila in tabla:
                                    if fila:
                                        fila_texto = ' '.join([str(celda) if celda else '' for celda in fila]).lower()
                                        if 'saldo' in fila_texto and 'inicial' in fila_texto:
                                            # Buscar número en esta fila
                                            for celda in fila:
                                                if celda:
                                                    match_saldo = re.search(r'([\d]{1,3}(?:\.\d{3})*,\d{2})', str(celda))
                                                    if match_saldo:
                                                        saldo_inicial = match_saldo.group(1).strip()
                                                        safe_print(f"Saldo Inicial encontrado en tabla de primera página: {saldo_inicial}")
                                                        break
                                        if saldo_inicial:
                                            break
                                    if saldo_inicial:
                                        break
                                if saldo_inicial:
                                    break
                    except Exception as e:
                        safe_print(f"Error extrayendo tablas de primera página: {e}")
                
                for page_num, page in enumerate(pdf.pages):
                    texto_pagina = page.extract_text() or ''
                    texto_completo += texto_pagina
                
                # Buscar Saldo Inicial - primero en la primera página (donde suele estar)
                # Patrones múltiples para capturar diferentes formatos
                patrones_saldo_inicial = [
                    r'Saldo\s+inicial[:\s]*\$?\s*([\d]{1,3}(?:\.\d{3})*,\d{2})',  # Formato estándar
                    r'Saldo\s+inicial[^\d]*\$?\s*([\d]{1,3}(?:\.\d{3})*,\d{2})',  # Con caracteres intermedios
                    r'Saldo\s+inicial.*?([\d]{1,3}(?:\.\d{3}){1,},\d{2})',  # Búsqueda más amplia
                    r'Saldo\s+inicial[^\d]*([\d]{1,3}(?:\.\d{3}){1,},\d{2})',  # Sin $ explícito
                    r'(?:Saldo|saldo)\s+(?:inicial|Inicial)[:\s]*\$?\s*([\d]{1,3}(?:\.\d{3})*,\d{2})',  # Variaciones de mayúsculas
                ]
                
                # Intentar primero en la primera página
                for patron in patrones_saldo_inicial:
                    match_saldo_inicial = re.search(patron, texto_primera_pagina, re.IGNORECASE | re.DOTALL)
                    if match_saldo_inicial:
                        saldo_inicial = match_saldo_inicial.group(1).strip()
                        safe_print(f"Saldo Inicial encontrado en primera página: {saldo_inicial}")
                        break
                
                # Si no se encontró en la primera página, buscar en todo el texto
                if not saldo_inicial:
                    for patron in patrones_saldo_inicial:
                        match_saldo_inicial = re.search(patron, texto_completo, re.IGNORECASE | re.DOTALL)
                        if match_saldo_inicial:
                            saldo_inicial = match_saldo_inicial.group(1).strip()
                            safe_print(f"Saldo Inicial encontrado en texto completo: {saldo_inicial}")
                            break
                
                # Si aún no se encontró, buscar por líneas individuales
                if not saldo_inicial and texto_primera_pagina:
                    lineas = texto_primera_pagina.split('\n')
                    for i, linea in enumerate(lineas):
                        linea_lower = linea.lower()
                        if 'saldo' in linea_lower and 'inicial' in linea_lower:
                            # Buscar número en la misma línea o en las siguientes
                            for j in range(i, min(i + 3, len(lineas))):
                                match_num = re.search(r'([\d]{1,3}(?:\.\d{3})*,\d{2})', lineas[j])
                                if match_num:
                                    saldo_inicial = match_num.group(1).strip()
                                    safe_print(f"Saldo Inicial encontrado en líneas: {saldo_inicial}")
                                    break
                            if saldo_inicial:
                                break
                    
                    # Si aún no se encontró, buscar "saldo" e "inicial" en líneas cercanas
                    if not saldo_inicial:
                        for i, linea in enumerate(lineas):
                            linea_lower = linea.lower()
                            if 'saldo' in linea_lower:
                                # Buscar "inicial" en las siguientes 2 líneas
                                for j in range(i + 1, min(i + 3, len(lineas))):
                                    if 'inicial' in lineas[j].lower():
                                        # Buscar número en estas líneas
                                        for k in range(i, min(j + 2, len(lineas))):
                                            match_num = re.search(r'([\d]{1,3}(?:\.\d{3})*,\d{2})', lineas[k])
                                            if match_num:
                                                saldo_inicial = match_num.group(1).strip()
                                                safe_print(f"Saldo Inicial encontrado en líneas cercanas: {saldo_inicial}")
                                                break
                                        if saldo_inicial:
                                            break
                                if saldo_inicial:
                                    break
                
                # Mensaje si no se encontró el saldo inicial
                if not saldo_inicial:
                    safe_print("ADVERTENCIA: No se pudo encontrar el Saldo Inicial en el PDF")
                    # Mostrar un fragmento del texto de la primera página para depuración
                    if texto_primera_pagina:
                        # Buscar líneas que contengan "saldo" para depuración
                        lineas = texto_primera_pagina.split('\n')
                        lineas_con_saldo = [linea for linea in lineas if 'saldo' in linea.lower()]
                        if lineas_con_saldo:
                            safe_print("Líneas que contienen 'saldo' en la primera página:")
                            for linea in lineas_con_saldo[:5]:  # Mostrar máximo 5 líneas
                                safe_print(f"  - {linea[:100]}")
                        else:
                            fragmento = texto_primera_pagina[:1000].replace('\n', ' ')
                            safe_print(f"Fragmento de primera página (primeros 1000 caracteres): {fragmento}")
                
                # Buscar Saldo Deudores - Promedio
                match_promedio = re.search(r'Promedio\s+\d{6}\s*\$?\s*([\d]{1,3}(?:\.\d{3})*,\d{2})', texto_completo, re.IGNORECASE)
                if match_promedio:
                    saldo_deudores_promedio = match_promedio.group(1).strip()
                    safe_print(f"Saldo Deudores Promedio encontrado: {saldo_deudores_promedio}")
                
                # Buscar Saldo Deudores - Intereses
                match_intereses = re.search(r'Intereses\s*\$?\s*([\d]{1,3}(?:\.\d{3})*,\d{2})', texto_completo, re.IGNORECASE)
                if match_intereses:
                    saldo_deudores_intereses = match_intereses.group(1).strip()
                    safe_print(f"Saldo Deudores Intereses encontrado: {saldo_deudores_intereses}")
        except Exception as e:
            safe_print(f"Error extrayendo Saldo Deudores: {e}")
        
        # Extraer tablas con camelot
        tables = None
        
        try:
            safe_print("Intentando extracción con método 'lattice'...")
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
            if tables:
                safe_print(f"Lattice: Se encontraron {len(tables)} tablas")
        except Exception as e:
            safe_print(f"Error con lattice: {e}")
        
        if not tables:
            try:
                safe_print("Intentando extracción con método 'stream'...")
                tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
                if tables:
                    safe_print(f"Stream: Se encontraron {len(tables)} tablas")
            except Exception as e:
                safe_print(f"Error con stream: {e}")
        
        if not tables:
            safe_print("No se encontraron tablas en el PDF")
            return pd.DataFrame()
        
        safe_print(f"Total de tablas encontradas: {len(tables)}")
        
        # Si aún no se encontró el saldo inicial, buscar en las tablas extraídas por Camelot
        if not saldo_inicial and tables:
            safe_print("Buscando Saldo Inicial en tablas extraídas...")
            for i, table in enumerate(tables):
                try:
                    df_temp = table.df
                    # Buscar en todas las celdas de la tabla
                    for idx, row in df_temp.iterrows():
                        fila_texto = ' '.join([str(val) if pd.notna(val) else '' for val in row]).lower()
                        if 'saldo' in fila_texto and 'inicial' in fila_texto:
                            # Buscar número en esta fila
                            for val in row:
                                if pd.notna(val):
                                    match_saldo = re.search(r'([\d]{1,3}(?:\.\d{3})*,\d{2})', str(val))
                                    if match_saldo:
                                        saldo_inicial = match_saldo.group(1).strip()
                                        safe_print(f"Saldo Inicial encontrado en tabla {i+1} (Camelot): {saldo_inicial}")
                                        break
                            if saldo_inicial:
                                break
                        if saldo_inicial:
                            break
                    if saldo_inicial:
                        break
                except Exception as e:
                    safe_print(f"Error buscando saldo inicial en tabla {i+1}: {e}")
                    continue
        
        # Buscar dónde comienza "Movimientos"
        indice_inicio_movimientos = None
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    texto_pagina = page.extract_text() or ''
                    if 'movimientos' in texto_pagina.lower():
                        indice_inicio_movimientos = page_num
                        safe_print(f"Sección 'Movimientos' encontrada en la página {page_num + 1}")
                        break
        except Exception as e:
            safe_print(f"Error buscando sección Movimientos: {e}")
        
        # Procesar todas las tablas desde "Movimientos" hacia abajo
        all_data = []
        
        for i, table in enumerate(tables):
            try:
                df = table.df
                if df.empty or len(df) == 0:
                    continue
                
                if len(df.columns) < 2:
                    safe_print(f"  Tabla {i+1}: Omitida (solo {len(df.columns)} columna)")
                    continue
                
                texto_completo = ' '.join([str(valor) for valor in df.values.flatten() if pd.notna(valor)]).lower()
                
                # Verificar si es tabla de movimientos
                es_tabla_movimientos = any(palabra in texto_completo for palabra in [
                    'fecha', 'movimiento', 'débito', 'crédito', 'saldo', 'concepto', 'descripción',
                    'importe', 'monto', 'detalle', 'operación', 'operacion'
                ])
                
                # Verificar si tiene fechas (incluso si tiene pocas columnas)
                tiene_fechas = False
                for val in df.values.flatten():
                    if pd.notna(val):
                        if re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', str(val)):
                            tiene_fechas = True
                            break
                
                # Decidir si procesar: es tabla de movimientos O tiene fechas
                debe_procesar = es_tabla_movimientos or (tiene_fechas and len(df.columns) >= 3)
                
                if indice_inicio_movimientos is not None:
                    try:
                        tabla_page = table.page - 1
                        if tabla_page >= indice_inicio_movimientos:
                            debe_procesar = True
                    except:
                        debe_procesar = es_tabla_movimientos or (tiene_fechas and len(df.columns) >= 3)
                
                if not debe_procesar:
                    continue
                
                safe_print(f"Procesando tabla {i+1}/{len(tables)}... (Dimensiones: {df.shape[0]} filas x {df.shape[1]} columnas)")
                
                # Obtener número de página y posición de tabla
                try:
                    tabla_page = table.page if hasattr(table, 'page') else 0
                    tabla_order = i  # Orden de aparición de la tabla
                except:
                    tabla_page = 0
                    tabla_order = i
                
                # Procesar tabla manteniendo orden original
                df_procesado = procesar_tabla_galicia(df, tabla_page, tabla_order)
                if not df_procesado.empty:
                    all_data.append(df_procesado)
                    safe_print(f"  Tabla {i+1}: {len(df_procesado)} registros extraídos")
                else:
                    safe_print(f"  Tabla {i+1}: Sin datos válidos procesados")
                    
            except Exception as e:
                safe_print(f"  Error procesando tabla {i+1}: {e}")
                import traceback
                safe_print(traceback.format_exc())
                continue
        
        # Extraer transacciones adicionales del texto si Camelot no las detectó (página 10)
        transacciones_texto = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Buscar específicamente en la página 10 (índice 9)
                if len(pdf.pages) >= 10:
                    page = pdf.pages[9]
                    texto = page.extract_text() or ''
                    
                    # Buscar líneas con formato: 30/09/25 + descripción + importes
                    lineas = texto.split('\n')
                    for linea in lineas:
                        linea_clean = linea.strip()
                        if not linea_clean or len(linea_clean) < 10:
                            continue
                        
                        # Buscar fecha del 30/09
                        match_fecha = re.search(r'(30[/-]09[/-]\d{2,4})', linea_clean)
                        if match_fecha:
                            fecha = match_fecha.group(1).replace('-', '/')  # Normalizar separador
                            # Normalizar formato de fecha
                            partes_fecha = fecha.split('/')
                            if len(partes_fecha) == 3:
                                if len(partes_fecha[2]) == 2:
                                    fecha = f"{partes_fecha[0]}/{partes_fecha[1]}/25"
                                else:
                                    fecha = f"{partes_fecha[0]}/{partes_fecha[1]}/{partes_fecha[2]}"
                            
                            # Buscar descripción e importes
                            resto = linea_clean[match_fecha.end():].strip()
                            
                            # Buscar todos los importes
                            match_importes = re.findall(r'(-?\d{1,3}(?:\.\d{3})*,\d{2})', resto)
                            
                            if match_importes and len(match_importes) >= 2:
                                # Último valor es saldo, penúltimo es débito/crédito
                                saldo = match_importes[-1]
                                importe = match_importes[-2]
                                
                                # Extraer descripción (remover importes)
                                descripcion = resto
                                for imp in match_importes:
                                    descripcion = descripcion.replace(imp, '', 1)
                                descripcion = descripcion.strip()
                                
                                # Limpiar descripción eliminando códigos numéricos largos
                                descripcion = limpiar_descripcion_galicia(descripcion)
                                
                                # Filtrar líneas que son solo rangos de fechas (no transacciones reales)
                                if 'PERIODO COMPRENDIDO' in descripcion.upper() or 'ENTRE EL' in descripcion.upper():
                                    continue
                                
                                # Filtrar filas con CBU (está fuera de la tabla y no debe extraerse)
                                if 'CBU' in descripcion.upper():
                                    continue
                                
                                # Determinar si es débito o crédito
                                debito = ''
                                credito = ''
                                if importe.startswith('-'):
                                    debito = importe
                                else:
                                    credito = importe
                                
                                # Verificar que no esté duplicada (buscar por descripción exacta y saldo, para evitar duplicados exactos pero permitir múltiples transacciones del mismo tipo)
                                es_duplicada = False
                                if all_data:
                                    for df_existente in all_data:
                                        if len(df_existente) > 0 and 'Fecha' in df_existente.columns and 'Descripcion' in df_existente.columns:
                                            # Buscar por fecha, descripción exacta Y saldo (para evitar duplicados reales)
                                            for idx_existente, row_existente in df_existente.iterrows():
                                                fecha_existente = str(row_existente.get('Fecha', '')).strip()
                                                desc_existente = str(row_existente.get('Descripcion', '')).strip()
                                                saldo_existente = str(row_existente.get('Saldo', '')).strip()
                                                
                                                # Normalizar fechas para comparar
                                                fecha_norm = fecha.replace('-', '/')
                                                fecha_exist_norm = fecha_existente.replace('-', '/')
                                                
                                                if fecha_norm == fecha_exist_norm:
                                                    # Solo marcar como duplicada si las descripciones Y los saldos son exactos (misma transacción)
                                                    if descripcion.lower().strip() == desc_existente.lower().strip() and saldo == saldo_existente:
                                                        es_duplicada = True
                                                        break
                                        
                                        if es_duplicada:
                                            break
                                
                                if not es_duplicada and descripcion and len(descripcion) > 3:
                                    transacciones_texto.append({
                                        'Fecha': fecha.replace('-', '/') if '-' in fecha else fecha,
                                        'Descripcion': descripcion,
                                        'Debito': debito,
                                        'Credito': credito,
                                        'Saldo': saldo,
                                        'Importe': ''
                                    })
                                    safe_print(f"Transacción adicional encontrada en texto: {fecha} - {descripcion[:50]}")
        except Exception as e:
            safe_print(f"Error extrayendo transacciones del texto: {e}")
            import traceback
            safe_print(traceback.format_exc())
        
        if transacciones_texto:
            safe_print(f"Encontradas {len(transacciones_texto)} transacciones adicionales en texto")
            all_data.append(pd.DataFrame(transacciones_texto))
        
        if not all_data:
            safe_print("No se pudieron procesar los datos de ninguna tabla")
            df_final = pd.DataFrame()
        else:
            # Concatenar todas las tablas MANTENIENDO EL ORDEN ORIGINAL
            df_final = pd.concat(all_data, ignore_index=True)
            safe_print(f"Procesadas {len(all_data)} tablas con datos válidos. Total registros: {len(df_final)}")
            
            # NO REORDENAR - Mantener el orden exacto del PDF
            safe_print(f"Primera fecha: {df_final['Fecha'].iloc[0] if len(df_final) > 0 and 'Fecha' in df_final.columns else 'N/A'}, Última fecha: {df_final['Fecha'].iloc[-1] if len(df_final) > 0 and 'Fecha' in df_final.columns else 'N/A'}")
        
        if df_final.empty:
            safe_print("No se pudieron procesar los datos")
            if excel_path and (saldo_deudores_promedio or saldo_deudores_intereses or saldo_inicial):
                df_totales = crear_totales_galicia(pd.DataFrame(), saldo_inicial, saldo_deudores_promedio, saldo_deudores_intereses)
                with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                    df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
            return pd.DataFrame()
        
        # Guardar Excel
        if excel_path:
            guardar_excel_galicia(df_final, excel_path, saldo_inicial, saldo_deudores_promedio, saldo_deudores_intereses)
        
        safe_print(f"Total de registros extraídos: {len(df_final)}")
        return df_final
        
    except Exception as e:
        safe_print(f"Error extrayendo datos: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return pd.DataFrame()

def procesar_tabla_galicia(df, tabla_page, tabla_order):
    """Procesar tabla de Galicia manteniendo orden original"""
    try:
        # Buscar encabezados
        headers_row = None
        column_mapping = {}
        
        for i, row in df.iterrows():
            contenido_completo = ' '.join([str(val) for val in row if pd.notna(val)]).lower()
            
            if any(palabra in contenido_completo for palabra in ['fecha', 'movimiento', 'concepto', 'descripción', 'débito', 'crédito', 'saldo', 'importe']):
                headers_row = i
                safe_print(f"Encabezados encontrados en fila {i}")
                
                for j, val in enumerate(row):
                    val_str = str(val).lower().strip() if pd.notna(val) else ''
                    if 'fecha' in val_str:
                        column_mapping['fecha'] = j
                    elif 'crédito' in val_str or 'credito' in val_str:
                        column_mapping['credito'] = j
                    elif 'débito' in val_str or 'debito' in val_str:
                        column_mapping['debito'] = j
                    elif 'saldo' in val_str and 'importe' not in val_str:
                        column_mapping['saldo'] = j
                    elif 'concepto' in val_str or 'descripción' in val_str or 'descripcion' in val_str:
                        column_mapping['descripcion'] = j
                
                break
        
        if headers_row is None:
            safe_print("No se encontraron encabezados específicos, intentando detectar desde la primera fila")
            headers_row = -1
            if len(df.columns) >= 3:
                column_mapping['fecha'] = 0
            elif len(df.columns) == 3:
                # Tabla compacta: asumir formato Fecha | Descripción | Importe/Saldo
                column_mapping['fecha'] = 0
                # El saldo puede estar en la última columna
                if 'saldo' not in column_mapping:
                    column_mapping['saldo'] = 2
        
        # Extraer datos
        datos_filas = []
        start_row = headers_row + 1 if headers_row != -1 else 0
        
        safe_print(f"Procesando desde fila {start_row} hasta {len(df)}")
        
        for i in range(start_row, len(df)):
            try:
                fecha = ''
                descripcion = ''
                debito = ''
                credito = ''
                saldo = ''
                
                # Extraer fecha
                if 'fecha' in column_mapping:
                    fecha_val = str(df.iloc[i, column_mapping['fecha']]).strip() if pd.notna(df.iloc[i, column_mapping['fecha']]) else ''
                    if fecha_val:
                        match_fecha = re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', fecha_val)
                        if match_fecha:
                            fecha = match_fecha.group(0)
                
                if not fecha:
                    # Buscar fecha en cualquier columna
                    for j in range(len(df.columns)):
                        valor = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor:
                            match_fecha = re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', valor)
                            if match_fecha:
                                fecha = match_fecha.group(0)
                                break
                
                # Extraer descripción
                if 'descripcion' in column_mapping:
                    descripcion = str(df.iloc[i, column_mapping['descripcion']]).strip() if pd.notna(df.iloc[i, column_mapping['descripcion']]) else ''
                else:
                    # Buscar descripción en columnas intermedias
                    descripcion_parts = []
                    fecha_col = column_mapping.get('fecha', -1)
                    for j in range(len(df.columns)):
                        if j == fecha_col:
                            continue
                        if j >= len(df.columns) - 3:  # Omitir últimas 3 columnas (débito, crédito, saldo)
                            continue
                        valor = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor and valor != 'nan':
                            if not re.match(r'^\d{2}[/-]\d{2}[/-]\d{2,4}$', valor):
                                if not re.match(r'^-?\d{1,3}(?:\.\d{3})*,\d{2}$', valor):
                                    if len(valor) > 2:
                                        descripcion_parts.append(valor)
                    descripcion = ' '.join(descripcion_parts).strip()
                
                # Limpiar descripción eliminando códigos numéricos largos
                descripcion = limpiar_descripcion_galicia(descripcion)
                
                # Filtrar filas con CBU (está fuera de la tabla y no debe extraerse)
                if 'cbu' in descripcion.lower():
                    continue
                
                # Extraer SALDO primero (última columna típicamente)
                if 'saldo' in column_mapping:
                    saldo_val = str(df.iloc[i, column_mapping['saldo']]).strip() if pd.notna(df.iloc[i, column_mapping['saldo']]) else ''
                    if saldo_val and saldo_val != 'nan':
                        match_saldo = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', saldo_val)
                        if match_saldo:
                            saldo = match_saldo.group(1)
                
                # Si no encontramos saldo en su columna, buscar en la última columna
                if not saldo and len(df.columns) > 0:
                    ultima_col = len(df.columns) - 1
                    saldo_val = str(df.iloc[i, ultima_col]).strip() if pd.notna(df.iloc[i, ultima_col]) else ''
                    if saldo_val and saldo_val != 'nan':
                        match_saldo = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', saldo_val)
                        if match_saldo:
                            saldo = match_saldo.group(1)
                
                # Extraer DÉBITO primero (puede ser negativo)
                # Buscar en la columna mapeada como débito
                if 'debito' in column_mapping:
                    debito_val = str(df.iloc[i, column_mapping['debito']]).strip() if pd.notna(df.iloc[i, column_mapping['debito']]) else ''
                    if debito_val and debito_val != 'nan':
                        # Buscar número con signo negativo opcional
                        match_debito = re.search(r'(-?\d{1,3}(?:\.\d{3})*,\d{2})', debito_val)
                        if match_debito:
                            debito_temp = match_debito.group(1)
                            # Si tiene signo negativo o el texto contiene "-", es débito
                            if debito_temp.startswith('-') or '-' in debito_val:
                                debito = debito_temp if debito_temp.startswith('-') else '-' + debito_temp
                            else:
                                # Si no tiene signo pero está en columna débito vacía, puede ser débito
                                # Pero solo si no hay nada en crédito
                                pass
                
                # Si no encontramos débito en su columna, buscar en todas las columnas
                # pero solo si encontramos un número negativo
                if not debito:
                    for j in range(len(df.columns)):
                        if j == column_mapping.get('saldo', -1):
                            continue
                        valor_col = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor_col and valor_col != 'nan':
                            # Buscar números negativos explícitos
                            match_negativo = re.search(r'(-\d{1,3}(?:\.\d{3})*,\d{2})', valor_col)
                            if match_negativo:
                                debito = match_negativo.group(1)
                                break
                
                # Extraer CRÉDITO (solo positivo, NO es saldo, y SOLO si NO hay débito)
                if not debito and 'credito' in column_mapping:
                    credito_val = str(df.iloc[i, column_mapping['credito']]).strip() if pd.notna(df.iloc[i, column_mapping['credito']]) else ''
                    if credito_val and credito_val != 'nan':
                        # Solo buscar números positivos (sin signo negativo)
                        match_credito = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', credito_val)
                        if match_credito:
                            credito_candidato = match_credito.group(1)
                            # Verificar que NO sea el saldo y que NO tenga signo negativo
                            if credito_candidato != saldo and '-' not in credito_val:
                                credito = credito_candidato
                
                # Si no encontramos crédito en su columna y NO hay débito, buscar en otras columnas
                # pero solo números positivos
                if not credito and not debito:
                    for j in range(len(df.columns)):
                        if j == column_mapping.get('saldo', -1):
                            continue
                        if j == column_mapping.get('debito', -1):
                            continue
                        valor_col = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor_col and valor_col != 'nan':
                            # Solo buscar números positivos (sin signo negativo)
                            if '-' not in valor_col:
                                match_credito = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', valor_col)
                                if match_credito:
                                    credito_candidato = match_credito.group(1)
                                    if credito_candidato != saldo:
                                        credito = credito_candidato
                                        break
                
                # Construir texto completo para filtrado
                texto_completo = ' '.join([str(df.iloc[i, j]) for j in range(len(df.columns)) if pd.notna(df.iloc[i, j])]).upper()
                
                # Filtrar filas con CBU (está fuera de la tabla y no debe extraerse)
                if 'CBU' in texto_completo:
                    continue
                
                # Filtrar encabezados/totales
                tiene_palabra_excluir = any(palabra in texto_completo for palabra in [
                    'FECHA', 'MOVIMIENTO', 'CONCEPTO', 'DESCRIPCIÓN', 'DÉBITO', 'CRÉDITO', 'SALDO', 
                    'TOTAL', 'SUBTOTAL', 'SALDO INICIAL', 'SALDO FINAL'
                ])
                tiene_importe = bool(debito or credito)
                tiene_saldo = bool(saldo)
                
                # Filtrar filas sin fecha que no tienen importe ni son realmente transacciones
                if tiene_palabra_excluir and not fecha and not tiene_importe:
                    continue
                
                # Solo procesar si tiene fecha Y (importe o saldo)
                # Esto evita filas que solo tienen saldo sin ser transacciones reales
                if fecha and (tiene_importe or tiene_saldo):
                    datos_filas.append({
                        'Fecha': fecha,
                        'Descripcion': descripcion,
                        'Debito': debito,
                        'Credito': credito,
                        'Saldo': saldo,
                        'Importe': ''
                    })
            
            except Exception as e:
                safe_print(f"Error procesando fila {i}: {e}")
                continue
        
        if datos_filas:
            df_resultado = pd.DataFrame(datos_filas)
            safe_print(f"  {len(df_resultado)} registros extraídos (orden original)")
            return df_resultado
        else:
            return pd.DataFrame()
            
    except Exception as e:
        safe_print(f"Error procesando tabla: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return pd.DataFrame()

def guardar_excel_galicia(df, excel_path, saldo_inicial='', saldo_deudores_promedio='', saldo_deudores_intereses=''):
    """Guardar datos en Excel con formato"""
    try:
        # Crear copia del DataFrame y eliminar columnas internas
        df_exportar = df.copy()
        columnas_a_eliminar = ['_Pagina', '_OrdenTabla', '_OrdenFila', 'Pagina', 'OrdenTabla', 'OrdenFila', 'OrdenTabl']
        for col in columnas_a_eliminar:
            if col in df_exportar.columns:
                df_exportar = df_exportar.drop(columns=[col])
        
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            df_exportar.to_excel(writer, sheet_name='Tablas Extraídas', index=False)
            df_exportar.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            df_totales = crear_totales_galicia(df, saldo_inicial, saldo_deudores_promedio, saldo_deudores_intereses)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")
        import traceback
        safe_print(traceback.format_exc())

def crear_totales_galicia(df, saldo_inicial='', saldo_deudores_promedio='', saldo_deudores_intereses=''):
    """Crear resumen de totales"""
    try:
        safe_print(f"crear_totales_galicia - Saldo inicial recibido: '{saldo_inicial}'")
        
        # Calcular saldo inicial a partir de la primera transacción (método inverso)
        saldo_inicial_num = 0
        if not saldo_inicial and not df.empty:
            # Obtener la primera fila con datos válidos
            primera_fila = None
            for _, row in df.iterrows():
                saldo_str = str(row.get('Saldo', '')).strip()
                if saldo_str and saldo_str != 'nan':
                    primera_fila = row
                    break
            
            if primera_fila is not None:
                saldo_actual_str = str(primera_fila.get('Saldo', '')).strip()
                debito_str = str(primera_fila.get('Debito', '')).strip()
                credito_str = str(primera_fila.get('Credito', '')).strip()
                
                if saldo_actual_str and saldo_actual_str != 'nan':
                    saldo_actual = convertir_valor_a_numero(saldo_actual_str)
                    
                    # Calcular saldo inicial: Saldo inicial = Saldo actual - Crédito + Débito
                    # (porque débito es negativo, entonces se suma)
                    if debito_str and debito_str != 'nan':
                        debito_val = convertir_valor_a_numero(debito_str)
                        # Débito es negativo, entonces sumamos su valor absoluto
                        saldo_inicial_num = saldo_actual - debito_val  # Restar negativo = sumar
                        safe_print(f"Saldo inicial calculado desde primera transacción (con débito): {saldo_inicial_num}")
                    elif credito_str and credito_str != 'nan':
                        credito_val = convertir_valor_a_numero(credito_str)
                        # Crédito es positivo, entonces restamos
                        saldo_inicial_num = saldo_actual - credito_val
                        safe_print(f"Saldo inicial calculado desde primera transacción (con crédito): {saldo_inicial_num}")
                    else:
                        # Si no hay débito ni crédito, usar el saldo actual como inicial
                        saldo_inicial_num = saldo_actual
                        safe_print(f"Saldo inicial igual al saldo de primera transacción: {saldo_inicial_num}")
        
        # Si se pasó saldo_inicial como parámetro, usarlo (tiene prioridad)
        if saldo_inicial:
            saldo_inicial_num = convertir_valor_a_numero(saldo_inicial)
            safe_print(f"Saldo inicial desde parámetro convertido a número: {saldo_inicial_num}")
        
        total_debitos = 0
        total_creditos = 0
        
        for _, row in df.iterrows():
            debito_str = str(row.get('Debito', '')).strip()
            credito_str = str(row.get('Credito', '')).strip()
            
            if debito_str:
                debito_val = convertir_valor_a_numero(debito_str)
                if debito_val:
                    total_debitos += abs(debito_val)
            
            if credito_str:
                credito_val = convertir_valor_a_numero(credito_str)
                if credito_val:
                    total_creditos += credito_val
        
        saldo_final = saldo_inicial_num + total_creditos - total_debitos
        
        # Formatear saldo inicial
        if saldo_inicial_num > 0:
            saldo_inicial_formateado = f"${saldo_inicial_num:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        elif saldo_inicial:
            saldo_inicial_formateado = saldo_inicial if saldo_inicial.startswith('$') else f"${saldo_inicial}"
        else:
            saldo_inicial_formateado = "$0,00"
        
        conceptos = ['Saldo Inicial', 'Total Débitos', 'Total Créditos', 'Saldo Final']
        valores = [
            saldo_inicial_formateado,
            f"${total_debitos:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            f"${total_creditos:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            f"${saldo_final:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        ]
        
        if saldo_deudores_promedio:
            conceptos.append('Saldo Deudores - Promedio')
            valores.append(saldo_deudores_promedio if saldo_deudores_promedio.startswith('$') else f"${saldo_deudores_promedio}")
        
        if saldo_deudores_intereses:
            conceptos.append('Saldo Deudores - Intereses')
            valores.append(saldo_deudores_intereses if saldo_deudores_intereses.startswith('$') else f"${saldo_deudores_intereses}")
        
        df_totales = pd.DataFrame({
            'Concepto': conceptos,
            'Valor': valores
        })
        
        return df_totales
    except Exception as e:
        safe_print(f"Error creando totales: {e}")
        return pd.DataFrame({'Concepto': ['Error'], 'Valor': [str(e)]})

def limpiar_descripcion_galicia(descripcion):
    """Limpiar descripción eliminando códigos numéricos largos que no son parte de la descripción"""
    try:
        if not descripcion or descripcion == 'nan':
            return ''
        
        descripcion = str(descripcion).strip()
        
        # Eliminar códigos numéricos largos que no son parte de la descripción
        # Estos suelen ser números de 10-18 dígitos que aparecen al final o en medio de la descripción
        
        # Patrón 1: Números de 10-12 dígitos (códigos de referencia)
        # Ejemplo: "307174664181", "008194881387"
        descripcion = re.sub(r'\b\d{10,12}\b', '', descripcion)
        
        # Patrón 2: Números muy largos de 15-18 dígitos (códigos de transacción)
        # Ejemplo: "589244000760985364"
        descripcion = re.sub(r'\b\d{15,18}\b', '', descripcion)
        
        # Limpiar espacios múltiples que quedan después de eliminar los códigos
        descripcion = re.sub(r'\s+', ' ', descripcion)
        descripcion = descripcion.strip()
        
        return descripcion
    except Exception as e:
        safe_print(f"Error limpiando descripción: {e}")
        return str(descripcion).strip() if descripcion else ''

def convertir_valor_a_numero(valor_str):
    """Convertir valor de texto a número"""
    try:
        if not valor_str or valor_str == 'nan':
            return 0
        valor_str = str(valor_str).strip()
        valor_str = valor_str.replace('$', '').replace(' ', '')
        valor_str = valor_str.replace('.', '').replace(',', '.')
        return float(valor_str)
    except:
        return 0
