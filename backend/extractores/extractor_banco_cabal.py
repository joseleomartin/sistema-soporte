#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import camelot
import pandas as pd
import re
import os
import sys

def safe_print(texto):
    """Imprimir texto de forma segura en Windows"""
    try:
        mensaje = str(texto)
        # Limpiar caracteres problemáticos
        mensaje = mensaje.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        # Reemplazar emojis comunes
        mensaje = mensaje.replace('\U0001f504', '')
        mensaje = mensaje.replace('\U0001f4ca', '')
        mensaje = mensaje.replace('\U0001f4c4', '')
        mensaje = mensaje.replace('\u2705', 'OK')
        mensaje = mensaje.replace('\u274c', 'ERROR')
        mensaje = mensaje.replace('\u26a0', 'WARNING')
        mensaje = mensaje.replace('\U0001f4b0', '')
        # Intentar imprimir con codificación segura
        try:
            print(mensaje)
        except UnicodeEncodeError:
            # Si aún falla, usar ASCII completamente
            print(mensaje.encode('ascii', errors='replace').decode('ascii'))
    except Exception:
        # Si todo falla, imprimir solo texto ASCII
        try:
            print(str(texto).encode('ascii', errors='replace').decode('ascii'))
        except Exception:
            print("Error al imprimir mensaje")

def extraer_datos_banco_cabal(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco Cabal"""
    try:
        # Verificar que el archivo existe
        if not os.path.exists(pdf_path):
            safe_print(f"ERROR: El archivo PDF no existe: {pdf_path}")
            return pd.DataFrame()
        
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Intentar con diferentes métodos de extracción
        # Para Cabal, Stream funciona mejor según las pruebas
        tables = None
        
        # Método 1: Stream (funciona mejor para Cabal)
        try:
            safe_print("Intentando extracción con método 'stream'...")
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
            if tables:
                safe_print(f"Stream: Se encontraron {len(tables)} tablas")
        except Exception as e:
            safe_print(f"Error con stream: {e}")
        
        # Método 2: Lattice (fallback si stream falla)
        if not tables:
            try:
                safe_print("Intentando extracción con método 'lattice'...")
                tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
                if tables:
                    safe_print(f"Lattice: Se encontraron {len(tables)} tablas")
            except Exception as e:
                safe_print(f"Error con lattice: {e}")
        
        # Siempre usar pdfplumber como complemento para capturar todas las transacciones
        transacciones_pdfplumber = extraer_con_pdfplumber_cabal(pdf_path)
        df_pdfplumber = None
        if transacciones_pdfplumber and len(transacciones_pdfplumber) > 0:
            safe_print(f"PDFPlumber encontró {len(transacciones_pdfplumber)} transacciones adicionales")
            df_pdfplumber = pd.DataFrame(transacciones_pdfplumber)
        
        if not tables:
            safe_print("No se encontraron tablas en el PDF")
            return pd.DataFrame()
        
        safe_print(f"Total de tablas encontradas: {len(tables)}")
        
        # Procesar TODAS las tablas que puedan contener movimientos
        all_data = []
        tablas_movimientos_encontradas = 0
        
        for i, table in enumerate(tables):
            try:
                df = table.df
                if df.empty or len(df) == 0:
                    continue
                
                # Filtrar tablas que tienen muy pocas columnas (generalmente no son tablas de datos)
                if len(df.columns) < 2:
                    safe_print(f"  Tabla {i+1}: Omitida (solo {len(df.columns)} columna)")
                    continue
                    
                texto_completo = ' '.join([str(valor) for valor in df.values.flatten() if pd.notna(valor)]).lower()
                
                # Verificar si es una tabla de movimientos (adaptado para Cabal)
                es_tabla_movimientos = any(palabra in texto_completo for palabra in ['fecha', 'movimiento', 'débito', 'crédito', 'saldo', 'concepto', 'descripción', 'importe', 'monto', 'cabal', 'compra', 'presentación', 'cupón', 'lote', 'terminal', 'tarjeta'])
                
                # Procesar TODAS las tablas con múltiples columnas (no solo las identificadas)
                safe_print(f"Procesando tabla {i+1}/{len(tables)}... (Dimensiones: {df.shape[0]} filas x {df.shape[1]} columnas)")
                if es_tabla_movimientos:
                    tablas_movimientos_encontradas += 1
                    safe_print(f"  Tabla {i+1} identificada como tabla de movimientos")
                elif len(df.columns) >= 3:
                    # También procesar tablas con 3+ columnas que puedan tener datos
                    safe_print(f"  Tabla {i+1} tiene múltiples columnas, procesando...")
                
                # Pasar información de la tabla actual (página, orden)
                try:
                    tabla_page = table.page if hasattr(table, 'page') else 0
                except:
                    tabla_page = 0
                
                df_procesado = procesar_tabla_cabal(df, tabla_page, i)
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
        
        if all_data:
            df_final = pd.concat(all_data, ignore_index=True)
            safe_print(f"Procesadas {len(all_data)} tablas con datos válidos ({tablas_movimientos_encontradas} de movimientos)")
        else:
            safe_print("No se pudieron procesar los datos de ninguna tabla")
            return pd.DataFrame()
        
        if df_final.empty:
            safe_print("No se pudieron procesar los datos")
            return pd.DataFrame()
        
        # Guardar Excel
        if excel_path:
            guardar_excel_cabal(df_final, excel_path)
        
        safe_print(f"Total de registros extraídos: {len(df_final)}")
        return df_final
        
    except Exception as e:
        safe_print(f"Error extrayendo datos: {e}")
        return pd.DataFrame()

def procesar_tabla_cabal(df, tabla_page=0, tabla_order=0):
    """Procesar tabla de Cabal respetando la estructura de columnas"""
    try:
        # Buscar la fila que contiene los encabezados
        headers_row = None
        column_mapping = {}  # Mapeo de columnas: {'fecha': 0, 'lote': 1, etc.}
        
        for i, row in df.iterrows():
            contenido_completo = ' '.join([str(val) for val in row if pd.notna(val)]).lower()
            
            # Buscar fila con encabezados específicos de Cabal
            if any(palabra in contenido_completo for palabra in ['fecha compra', 'presentación', 'nro lote', 'nro terminal', 'nro cupón', 'nro tarjeta', 'cuota', 'importe']):
                headers_row = i
                safe_print(f"Encabezados encontrados en fila {i}")
                
                # Identificar las columnas según los encabezados
                for j in range(len(df.columns)):
                    celda = str(df.iloc[i, j]).strip().lower() if pd.notna(df.iloc[i, j]) else ''
                    if 'fecha' in celda or 'presentación' in celda or 'compra' in celda:
                        column_mapping['fecha'] = j
                    elif 'lote' in celda:
                        column_mapping['lote'] = j
                    elif 'terminal' in celda:
                        column_mapping['terminal'] = j
                    elif 'cupón' in celda or 'cupon' in celda:
                        column_mapping['cupon'] = j
                    elif 'tarjeta' in celda:
                        column_mapping['tarjeta'] = j
                    elif 'cuota' in celda:
                        column_mapping['cuota'] = j
                    elif 'importe' in celda or 'total' in celda:
                        column_mapping['importe'] = j
                
                break
        
        if headers_row is None:
            safe_print("No se encontraron encabezados específicos, usando mapeo por posición")
            # Mapeo por defecto (asumiendo estructura estándar)
            column_mapping = {'fecha': 0, 'lote': 1, 'terminal': 2, 'cupon': 3, 'tarjeta': 4, 'cuota': 5, 'importe': 6}
            headers_row = -1
        
        # Extraer datos empezando después de los encabezados
        datos_filas = []
        start_row = headers_row + 1 if headers_row != -1 else 0
        
        safe_print(f"Procesando desde fila {start_row} hasta {len(df)}")
        safe_print(f"Dimensiones de la tabla: {df.shape}")
        safe_print(f"Mapeo de columnas: {column_mapping}")
        
        # Mostrar algunas filas de ejemplo para debug
        safe_print(f"Mostrando primeras filas después de los encabezados...")
        try:
            if start_row < len(df):
                for idx in range(start_row, min(start_row + 3, len(df))):
                    fila_ejemplo = []
                    try:
                        # MOSTRAR TODAS LAS COLUMNAS (incluyendo las últimas donde están los montos)
                        for j in range(len(df.columns)):
                            try:
                                valor = str(df.iloc[idx, j]).strip() if pd.notna(df.iloc[idx, j]) else ''
                                if valor and valor != 'nan' and len(valor) > 0:
                                    fila_ejemplo.append(f"Col{j}:{valor[:40]}")
                                else:
                                    fila_ejemplo.append(f"Col{j}:(vacio)")
                            except Exception as col_err:
                                fila_ejemplo.append(f"Col{j}:(error)")
                        if fila_ejemplo:
                            safe_print(f"  Fila ejemplo {idx}: {fila_ejemplo}")
                    except Exception as row_err:
                        safe_print(f"  Error en fila {idx}: {row_err}")
            else:
                safe_print(f"  start_row ({start_row}) >= len(df) ({len(df)})")
        except Exception as e:
            safe_print(f"Error mostrando ejemplos: {e}")
            import traceback
            safe_print(traceback.format_exc())
        
        contador_procesadas = 0
        contador_no_procesadas = 0
        
        # PROCESAR TRANSACCIONES CON FORMATO MULTI-LÍNEA
        # Las transacciones tienen este formato:
        # Línea 1: DD/MM/YYYY [cupón] [tarjeta] [cuota] [importe individual]
        # Línea 2: DD/MM/YYYY [lote] [terminal] [cantidad cupones] *TOTAL* [importe total]
        
        i = start_row
        while i < len(df):
            try:
                # Extraer valores según el mapeo de columnas
                fecha = ''
                lote = ''
                terminal = ''
                cupon = ''
                tarjeta = ''
                cuota = ''
                importe = ''
                
                # Extraer fecha
                if 'fecha' in column_mapping:
                    fecha_val = str(df.iloc[i, column_mapping['fecha']]).strip() if pd.notna(df.iloc[i, column_mapping['fecha']]) else ''
                    # Limpiar espacios extra y validar fecha
                    fecha_val = fecha_val.strip()
                    if fecha_val and re.match(r'^\d{2}[/-]\d{2}[/-]\d{2,4}$', fecha_val):
                        fecha = fecha_val
                    # También intentar extraer fecha si está mezclada con otros datos
                    elif fecha_val:
                        match_fecha = re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', fecha_val)
                        if match_fecha:
                            fecha = match_fecha.group(0)
                
                # Extraer importe (monto)
                if 'importe' in column_mapping:
                    importe_val = str(df.iloc[i, column_mapping['importe']]).strip() if pd.notna(df.iloc[i, column_mapping['importe']]) else ''
                    if importe_val and re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', importe_val):
                        importe = importe_val
                
                # PROBLEMA: Camelot está fusionando todas las columnas en Col0
                # Necesitamos parsear Col0 para extraer todos los datos
                col0_val = str(df.iloc[i, 0]).strip() if pd.notna(df.iloc[i, 0]) else ''
                
                # Si no hay datos en Col0, pasar a la siguiente fila
                if not col0_val or col0_val == 'nan' or len(col0_val) < 5:
                    i += 1
                    contador_no_procesadas += 1
                    continue
                
                # VERIFICAR SI ES LÍNEA DE TOTAL (contiene *TOTAL*)
                # Si contiene *TOTAL*, es la línea que tiene el importe total de la transacción
                # Buscar específicamente *TOTAL* con asteriscos para mejor precisión
                es_linea_total = '*TOTAL*' in col0_val.upper() or ('*TOTAL' in col0_val.upper() and '*' in col0_val)
                
                # Extraer fecha de Col0 primero
                if not fecha:
                    match_fecha = re.search(r'(\d{2}[/-]\d{2}[/-]\d{2,4})', col0_val)
                    if match_fecha:
                        fecha = match_fecha.group(1)
                
                # Si es línea de TOTAL, usar esa fecha y buscar en la siguiente línea también
                if es_linea_total:
                    # La línea TOTAL tiene: fecha lote terminal cantidad *TOTAL* importe_total
                    # Extraer lote y terminal de esta línea (más confiable)
                    lote_match = re.search(r'(\d{4})\s+\d{8}', col0_val)
                    if lote_match:
                        lote = lote_match.group(1)
                    
                    terminal_match = re.search(r'\d{4}\s+(\d{8})', col0_val)
                    if terminal_match:
                        terminal = terminal_match.group(1)
                
                # Extraer números de la cadena Col0
                # Formato típico: "11/09/2025    0196       16491660              1  121731,66"
                # O: "11/09/2025    0196       16491660              1              8970,00"
                
                # Buscar TODOS los montos en Col0
                # Si es línea TOTAL, el último monto es el importe total
                # Si no es TOTAL, buscar el monto más grande
                todos_montos = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', col0_val)
                if todos_montos:
                    if es_linea_total:
                        # En línea TOTAL, usar el último monto (es el importe total)
                        importe = todos_montos[-1]
                    else:
                        # En línea individual, priorizar montos más grandes
                        montos_con_tamano = []
                        for monto in todos_montos:
                            partes = monto.split(',')
                            num_digitos = len(partes[0].replace('.', ''))
                            montos_con_tamano.append((monto, num_digitos))
                        
                        # Ordenar por tamaño (más grande primero)
                        montos_con_tamano.sort(key=lambda x: x[1], reverse=True)
                        
                        # Usar el monto más grande
                        if montos_con_tamano:
                            importe = montos_con_tamano[0][0]
                        else:
                            importe = todos_montos[-1]
                
                # Extraer lote, terminal, cupón de Col0
                # Buscar número de 4 dígitos después de la fecha (lote)
                if not lote:
                    lote_match = re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}\s+(\d{4})\b', col0_val)
                    if lote_match:
                        lote = lote_match.group(1)
                
                # Buscar número de 8 dígitos (terminal)
                if not terminal:
                    terminal_match = re.search(r'\b(\d{8})\b', col0_val)
                    if terminal_match:
                        terminal = terminal_match.group(1)
                
                # Buscar número de 4-5 dígitos que no sea lote ni terminal (cupón)
                if not cupon:
                    cupon_match = re.findall(r'\b(\d{4,5})\b', col0_val)
                    if cupon_match:
                        for cupon_val in cupon_match:
                            # Excluir si es el lote, terminal o parte de la fecha
                            if cupon_val != lote and cupon_val != terminal and not re.match(r'^\d{4}$', cupon_val[:4]):
                                cupon = cupon_val
                                break
                
                # Buscar patrón de cuota como "00/01" o "03/01"
                if not cuota:
                    cuota_match = re.search(r'\b(\d{2}/\d{2})\b', col0_val)
                    if cuota_match:
                        cuota_val = cuota_match.group(1)
                        # Asegurarse de que no sea parte de la fecha
                        if cuota_val not in col0_val[:10]:  # No está en los primeros 10 caracteres (donde está la fecha)
                            cuota = cuota_val
                
                # Si no encontramos fecha en la columna mapeada, buscar en todas las columnas
                if not fecha:
                    for j in range(len(df.columns)):
                        valor = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor:
                            # Buscar fecha exacta
                            if re.match(r'^\d{2}[/-]\d{2}[/-]\d{2,4}$', valor):
                                fecha = valor
                                break
                            # Buscar fecha dentro del texto
                            match_fecha = re.search(r'\d{2}[/-]\d{2}[/-]\d{2,4}', valor)
                            if match_fecha:
                                fecha = match_fecha.group(0)
                                break
                # Si aún no hay fecha, buscar en Col0 (donde está todo)
                if not fecha and col0_val:
                    match_fecha = re.search(r'(\d{2}[/-]\d{2}[/-]\d{2,4})', col0_val)
                    if match_fecha:
                        fecha = match_fecha.group(1)
                
                # Si no encontramos importe en la columna mapeada, buscar en todas las columnas
                # PERO primero priorizar Col0 donde está todo fusionado (ya lo procesamos arriba)
                # Si aún no encontramos importe, buscar en las otras columnas
                if not importe:
                    for j in range(len(df.columns)):
                        valor = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor and valor != 'nan':
                            # Patrón estricto: XX.XXX,XX
                            if re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', valor):
                                partes = valor.split(',')
                                if len(partes[0].replace('.', '')) >= 4:
                                    importe = valor
                                    break
                            # Buscar montos dentro de texto
                            elif re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', valor):
                                matches = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', valor)
                                if matches:
                                    for match in matches:
                                        partes = match.split(',')
                                        if len(partes[0].replace('.', '')) >= 4:
                                            importe = match
                                            break
                                    if importe:
                                        break
                
                # Filtrar filas que son encabezados o totales/resúmenes (más flexible)
                texto_completo = ' '.join([str(df.iloc[i, j]) for j in range(len(df.columns)) if pd.notna(df.iloc[i, j])]).upper()
                
                # NO excluir si contiene *TOTAL* (es una línea de transacción válida)
                # NO excluir si contiene fecha válida (puede ser transacción)
                tiene_fecha_valida = bool(fecha)
                es_resumen_general = any(palabra in texto_completo for palabra in [
                    'TOTAL DE VENTAS. CANTIDAD', 'ARANCEL DE DESCUENTO', 'IVA S/ARANCEL DE DESCUENTO',
                    'NETO A LIQUIDAR', 'RETENCION DE INGRESOS BR', 'PERCEPCION DE IVA RG',
                    'IMPORTE NETO FINAL A LIQUIDAR', 'FECHA DE PAGO', 'LIQUIDACION NRO'
                ]) and not tiene_fecha_valida
                
                if es_resumen_general:
                    i += 1
                    contador_no_procesadas += 1
                    continue
                
                # Mostrar debug para primeras filas (más detallado) - MOSTRAR TODAS LAS COLUMNAS
                if i < start_row + 5:
                    col_values = []
                    for j in range(len(df.columns)):  # Mostrar TODAS las columnas
                        val = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if val and val != 'nan':
                            col_values.append(f"Col{j}='{val[:50]}'")
                        else:
                            col_values.append(f"Col{j}=(vacio)")
                    safe_print(f"  Debug fila {i}: fecha='{fecha}', importe='{importe}'")
                    safe_print(f"    Todas las columnas: {col_values}")
                    # Mostrar específicamente las últimas 3 columnas donde deberían estar los montos
                    if len(df.columns) >= 3:
                        ultimas_cols = []
                        for j in range(len(df.columns) - 3, len(df.columns)):
                            val = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                            ultimas_cols.append(f"Col{j}={val[:50]}")
                        safe_print(f"    Últimas 3 columnas (donde deberían estar los montos): {ultimas_cols}")
                
                # Determinar si es débito o crédito ANTES de filtrar
                # Para esto, necesitamos revisar el contexto de la tabla
                texto_completo_fila = ' '.join([str(df.iloc[i, j]) for j in range(len(df.columns)) if pd.notna(df.iloc[i, j])]).upper()
                es_debito = True  # Por defecto
                es_credito = False
                
                # Buscar en filas anteriores si hay indicación de sección
                if i > 0:
                    for j in range(max(0, i-10), i):
                        texto_anterior = ' '.join([str(df.iloc[j, k]) for k in range(len(df.columns)) if pd.notna(df.iloc[j, k])]).upper()
                        if 'TARJETA DE CREDITO' in texto_anterior or 'CREDITO' in texto_anterior:
                            es_credito = True
                            es_debito = False
                            break
                        elif 'CABAL DEBITO' in texto_anterior or 'DEBITO' in texto_anterior:
                            es_debito = True
                            es_credito = False
                            break
                
                # También verificar en la fila actual
                if 'TARJETA DE CREDITO' in texto_completo_fila or 'CREDITO' in texto_completo_fila:
                    es_credito = True
                    es_debito = False
                elif 'CABAL DEBITO' in texto_completo_fila or ('DEBITO' in texto_completo_fila and 'CREDITO' not in texto_completo_fila):
                    es_debito = True
                    es_credito = False
                
                # PROCESAR TRANSACCIONES
                # Solo procesar líneas TOTAL (que tienen el importe consolidado) O líneas individuales con importe válido
                if fecha and importe:
                    # Verificar que el importe tenga formato válido
                    partes_importe = importe.split(',')
                    num_digitos = len(partes_importe[0].replace('.', ''))
                    # Solo rechazar si tiene menos de 2 dígitos
                    if num_digitos < 2:
                        i += 1
                        contador_no_procesadas += 1
                        continue
                    
                    # PRIORIZAR líneas TOTAL (tienen el importe consolidado correcto)
                    # Si encontramos una línea TOTAL, la procesamos inmediatamente
                    if es_linea_total:
                        # Esta es la línea que tiene el importe total consolidado
                        # Construir descripción con lote y terminal (más confiables en línea TOTAL)
                        descripcion_parts = []
                        if lote: descripcion_parts.append(f"Lote: {lote}")
                        if terminal: descripcion_parts.append(f"Terminal: {terminal}")
                        if cuota: descripcion_parts.append(f"Cuota: {cuota}")
                        descripcion = ' | '.join(descripcion_parts) if descripcion_parts else ''
                        
                        # Clasificar como débito o crédito
                        debito = ''
                        credito = ''
                        
                        if es_credito:
                            credito = importe
                        else:
                            debito = importe
                        
                        resultado = {
                            'Fecha': fecha,
                            'Origen': terminal if terminal else (lote if lote else ''),
                            'Descripcion': descripcion,
                            'Debito': debito,
                            'Credito': credito,
                            'Saldo': '',
                            'Movimiento': cuota if cuota else ''
                        }
                        
                        datos_filas.append(resultado)
                        contador_procesadas += 1
                        i += 1  # Avanzar a la siguiente fila
                        continue
                    else:
                        # Es una línea individual (sin TOTAL)
                        # Verificar si hay una línea TOTAL siguiente antes de procesar
                        # Si hay TOTAL, ignorar esta línea individual y esperar la TOTAL
                        tiene_total_siguiente = False
                        # Buscar hasta 5 filas adelante para encontrar TOTAL
                        for next_idx in range(i + 1, min(i + 6, len(df))):
                            if next_idx < len(df):
                                col0_siguiente = str(df.iloc[next_idx, 0]).strip() if pd.notna(df.iloc[next_idx, 0]) else ''
                                if '*TOTAL*' in col0_siguiente.upper():
                                    # Verificar que el TOTAL tenga la misma estructura (fecha y números)
                                    fecha_sig_match = re.search(r'(\d{2}/\d{2}/\d{4})', col0_siguiente)
                                    if fecha_sig_match:
                                        tiene_total_siguiente = True
                                        break
                        
                        # Si hay TOTAL siguiente, saltar esta línea individual
                        if tiene_total_siguiente:
                            i += 1
                            continue
                        
                        # Si no hay TOTAL, procesar esta línea individual
                        descripcion_parts = []
                        if lote: descripcion_parts.append(f"Lote: {lote}")
                        if terminal: descripcion_parts.append(f"Terminal: {terminal}")
                        if cupon: descripcion_parts.append(f"Cupón: {cupon}")
                        if tarjeta: descripcion_parts.append(f"Tarjeta: {tarjeta}")
                        if cuota: descripcion_parts.append(f"Cuota: {cuota}")
                        descripcion = ' | '.join(descripcion_parts) if descripcion_parts else ''
                        
                        debito = ''
                        credito = ''
                        
                        if es_credito:
                            credito = importe
                        else:
                            debito = importe
                        
                        resultado = {
                            'Fecha': fecha,
                            'Origen': terminal if terminal else (lote if lote else ''),
                            'Descripcion': descripcion,
                            'Debito': debito,
                            'Credito': credito,
                            'Saldo': '',
                            'Movimiento': cuota if cuota else ''
                        }
                        
                        datos_filas.append(resultado)
                        contador_procesadas += 1
                        
                elif fecha and not importe:
                    # Tiene fecha pero no importe - puede ser línea de información adicional
                    i += 1
                    contador_no_procesadas += 1
                    continue
                else:
                    i += 1
                    contador_no_procesadas += 1
                    continue
                
                # Avanzar al siguiente índice
                i += 1
                    
            except Exception as e:
                safe_print(f"  Error procesando fila {i}: {e}")
                i += 1
                continue
        
        safe_print(f"Resumen: {contador_procesadas} filas procesadas, {contador_no_procesadas} filas no procesadas")
        
        if datos_filas:
            df_procesado = pd.DataFrame(datos_filas)
            safe_print(f"Procesadas {len(df_procesado)} filas de movimientos")
            return df_procesado
        else:
            safe_print("No se pudieron procesar filas de datos")
            return pd.DataFrame()
        
    except Exception as e:
        safe_print(f"Error procesando tabla: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return pd.DataFrame()

def guardar_excel_cabal(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_cabal(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
        
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")

def crear_totales_cabal(df):
    """Crear totales por concepto"""
    try:
        saldo_inicial = 0
        total_debitos = 0
        total_creditos = 0
        
        # Buscar saldo inicial
        for _, row in df.iterrows():
            saldo_valor = row.get('Saldo', '')
            if saldo_valor and str(saldo_valor).strip() != '':
                monto = extraer_monto_de_texto(str(saldo_valor))
                if monto is not None and monto > 0:
                    saldo_inicial = monto
                    break
        
        # Sumar débitos y créditos
        for _, row in df.iterrows():
            debito_valor = row.get('Debito', '')
            if debito_valor and str(debito_valor).strip() != '':
                monto = extraer_monto_de_texto(str(debito_valor))
                if monto is not None and monto > 0:
                    total_debitos += monto
            
            credito_valor = row.get('Credito', '')
            if credito_valor and str(credito_valor).strip() != '':
                monto = extraer_monto_de_texto(str(credito_valor))
                if monto is not None and monto > 0:
                    total_creditos += monto
        
        # Calcular saldo final
        saldo_final = saldo_inicial - total_debitos + total_creditos
        
        # Crear DataFrame
        datos_totales = [
            {'Concepto': 'Saldo Inicial', 'Monto': round(saldo_inicial, 2)},
            {'Concepto': 'Total Débitos', 'Monto': round(total_debitos, 2)},
            {'Concepto': 'Total Créditos', 'Monto': round(total_creditos, 2)},
            {'Concepto': 'Saldo Final', 'Monto': round(saldo_final, 2)}
        ]
        
        df_totales = pd.DataFrame(datos_totales)
        
        safe_print(f"Balance: Saldo Inicial: ${saldo_inicial:,.2f}, Débitos: ${total_debitos:,.2f}, Créditos: ${total_creditos:,.2f}, Saldo Final: ${saldo_final:,.2f}")
        return df_totales
        
    except Exception as e:
        safe_print(f"Error creando totales: {e}")
        return pd.DataFrame()

def extraer_con_pdfplumber_cabal(pdf_path):
    """Extraer transacciones directamente del texto del PDF usando pdfplumber"""
    import pdfplumber
    
    transacciones = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            texto_completo = ''
            for page in pdf.pages:
                texto_completo += page.extract_text() or ''
            
            lineas = texto_completo.split('\n')
            
            en_seccion_ventas = False
            es_debito = False
            es_credito = False
            
            for i, linea in enumerate(lineas):
                linea_clean = linea.strip()
                
                # Detectar secciones
                if 'VENTAS CORRESPONDIENTES A CABAL DEBITO' in linea_clean.upper():
                    en_seccion_ventas = True
                    es_debito = True
                    es_credito = False
                    continue
                elif 'VENTAS CORRESPONDIENTES A TARJETA DE CREDITO' in linea_clean.upper():
                    en_seccion_ventas = True
                    es_debito = False
                    es_credito = True
                    continue
                elif 'CONTINUA EN PAGINA SIGUIENTE' in linea_clean.upper():
                    # Continuar en siguiente página
                    continue
                
                # Buscar líneas con *TOTAL* (estas son las transacciones consolidadas)
                if en_seccion_ventas and '*TOTAL*' in linea_clean.upper():
                    # Formato: DD/MM/YYYY LOTE TERMINAL CANTIDAD *TOTAL* IMPORTE
                    # Ejemplo: "28/08/2025 0110 16491657 1 *TOTAL* 62028,96"
                    # Patrón más flexible para capturar variaciones
                    match_total = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{4})\s+(\d{8})\s+\d+\s+\*TOTAL\*\s+(\d{1,3}(?:\.\d{3})*,\d{2})', linea_clean)
                    
                    # Si falla, intentar patrón más flexible (sin cantidad explícita)
                    if not match_total:
                        match_total = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{4})\s+(\d{8})\s+\*TOTAL\*\s+(\d{1,3}(?:\.\d{3})*,\d{2})', linea_clean)
                    
                    if match_total:
                        fecha = match_total.group(1)
                        lote = match_total.group(2)
                        terminal = match_total.group(3)
                        importe = match_total.group(4)
                        
                        # Construir descripción
                        descripcion_parts = []
                        if lote: descripcion_parts.append(f"Lote: {lote}")
                        if terminal: descripcion_parts.append(f"Terminal: {terminal}")
                        descripcion = ' | '.join(descripcion_parts) if descripcion_parts else ''
                        
                        # Clasificar como débito o crédito
                        debito = ''
                        credito = ''
                        
                        if es_credito:
                            credito = importe
                        else:
                            debito = importe
                        
                        transacciones.append({
                            'Fecha': fecha,
                            'Origen': terminal,
                            'Descripcion': descripcion,
                            'Debito': debito,
                            'Credito': credito,
                            'Saldo': '',
                            'Movimiento': ''
                        })
                
                # También buscar líneas individuales sin TOTAL si no hay TOTAL siguiente
                elif en_seccion_ventas:
                    # Formato: DD/MM/YYYY CUPON TARJETA CUOTA IMPORTE
                    # Solo procesar si NO hay TOTAL siguiente en las próximas líneas
                    tiene_total_siguiente = False
                    for j in range(i + 1, min(i + 5, len(lineas))):
                        if '*TOTAL*' in lineas[j].upper():
                            tiene_total_siguiente = True
                            break
                    
                    if not tiene_total_siguiente:
                        # Buscar línea individual con fecha e importe
                        match_individual = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{4})\s+(\d{4})\s+(\d{2}/\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})', linea_clean)
                        if match_individual:
                            fecha = match_individual.group(1)
                            cupon = match_individual.group(2)
                            tarjeta = match_individual.group(3)
                            cuota = match_individual.group(4)
                            importe = match_individual.group(5)
                            
                            descripcion_parts = []
                            if cupon: descripcion_parts.append(f"Cupón: {cupon}")
                            if tarjeta: descripcion_parts.append(f"Tarjeta: {tarjeta}")
                            if cuota: descripcion_parts.append(f"Cuota: {cuota}")
                            descripcion = ' | '.join(descripcion_parts) if descripcion_parts else ''
                            
                            debito = ''
                            credito = ''
                            
                            if es_credito:
                                credito = importe
                            else:
                                debito = importe
                            
                            transacciones.append({
                                'Fecha': fecha,
                                'Origen': '',
                                'Descripcion': descripcion,
                                'Debito': debito,
                                'Credito': credito,
                                'Saldo': '',
                                'Movimiento': cuota
                            })
        
        return transacciones
    except Exception as e:
        safe_print(f"Error en extracción con pdfplumber: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return []

def extraer_monto_de_texto(texto):
    """Extraer monto numérico de un texto"""
    try:
        if not texto or texto == 'nan':
            return None
        
        texto_limpio = str(texto).strip()
        
        # Buscar patrones de montos
        patron_monto = r'(\d{1,3}(?:\.\d{3})*,\d{2})'
        match = re.search(patron_monto, texto_limpio)
        if match:
            numero_str = match.group(1).replace('.', '').replace(',', '.')
            return float(numero_str)
        
        # Buscar patrones simples
        patron_simple = r'(\d+,\d{2})'
        match = re.search(patron_simple, texto_limpio)
        if match:
            numero_str = match.group(1).replace(',', '.')
            return float(numero_str)
        
        return None
        
    except Exception as e:
        return None

