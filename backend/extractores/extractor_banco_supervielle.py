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

def extraer_datos_banco_supervielle(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco Supervielle"""
    try:
        if not os.path.exists(pdf_path):
            safe_print(f"ERROR: El archivo PDF no existe: {pdf_path}")
            return pd.DataFrame()
        
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Intentar con diferentes métodos de extracción
        tables = None
        
        # Método 1: Stream
        try:
            safe_print("Intentando extracción con método 'stream'...")
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
            if tables:
                safe_print(f"Stream: Se encontraron {len(tables)} tablas")
        except Exception as e:
            safe_print(f"Error con stream: {e}")
        
        # Método 2: Lattice (fallback)
        if not tables:
            try:
                safe_print("Intentando extracción con método 'lattice'...")
                tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
                if tables:
                    safe_print(f"Lattice: Se encontraron {len(tables)} tablas")
            except Exception as e:
                safe_print(f"Error con lattice: {e}")
        
        if not tables:
            safe_print("No se encontraron tablas en el PDF")
            return pd.DataFrame()
        
        safe_print(f"Total de tablas encontradas: {len(tables)}")
        
        # Procesar todas las tablas
        all_data = []
        
        for i, table in enumerate(tables):
            try:
                df = table.df
                if df.empty or len(df) == 0:
                    continue
                
                # Filtrar tablas que tienen muy pocas columnas
                if len(df.columns) < 2:
                    safe_print(f"  Tabla {i+1}: Omitida (solo {len(df.columns)} columna)")
                    continue
                
                texto_completo = ' '.join([str(valor) for valor in df.values.flatten() if pd.notna(valor)]).lower()
                
                # Verificar si es una tabla de movimientos
                es_tabla_movimientos = any(palabra in texto_completo for palabra in [
                    'fecha', 'concepto', 'detalle', 'débito', 'crédito', 'debito', 'credito', 'saldo', 
                    'movimiento', 'importe', 'monto', 'transferencia'
                ])
                
                safe_print(f"Procesando tabla {i+1}/{len(tables)}... (Dimensiones: {df.shape[0]} filas x {df.shape[1]} columnas)")
                
                if es_tabla_movimientos:
                    safe_print(f"  Tabla {i+1} identificada como tabla de movimientos")
                
                # Pasar información de la tabla actual
                try:
                    tabla_page = table.page if hasattr(table, 'page') else 0
                except:
                    tabla_page = 0
                
                df_procesado = procesar_tabla_supervielle(df, tabla_page, i)
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
        
        if not all_data:
            safe_print("No se encontraron transacciones en las tablas")
            if excel_path:
                guardar_excel_supervielle(pd.DataFrame(), excel_path)
            return pd.DataFrame()
        
        # Concatenar todas las tablas
        df_final = pd.concat(all_data, ignore_index=True)
        
        safe_print(f"Procesadas {len(all_data)} tablas con datos válidos. Total registros: {len(df_final)}")
        
        # Guardar Excel
        if excel_path:
            guardar_excel_supervielle(df_final, excel_path)
        
        safe_print(f"Total de registros extraídos: {len(df_final)}")
        return df_final
        
    except Exception as e:
        safe_print(f"Error extrayendo datos: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return pd.DataFrame()

def procesar_tabla_supervielle(df, tabla_page=0, tabla_order=0):
    """Procesar tabla de Supervielle"""
    try:
        # Buscar encabezados
        headers_row = None
        column_mapping = {}
        
        for i, row in df.iterrows():
            contenido_completo = ' '.join([str(val) for val in row if pd.notna(val)]).lower()
            
            # Buscar fila con encabezados
            if any(palabra in contenido_completo for palabra in ['fecha', 'concepto', 'detalle', 'débito', 'crédito', 'debito', 'credito', 'saldo']):
                headers_row = i
                safe_print(f"Encabezados encontrados en fila {i}")
                
                # Identificar columnas
                for j in range(len(df.columns)):
                    celda = str(df.iloc[i, j]).strip().lower() if pd.notna(df.iloc[i, j]) else ''
                    if 'fecha' in celda:
                        column_mapping['fecha'] = j
                    elif 'concepto' in celda:
                        column_mapping['concepto'] = j
                    elif 'detalle' in celda:
                        column_mapping['detalle'] = j
                    elif 'débito' in celda or 'debito' in celda:
                        column_mapping['debito'] = j
                    elif 'crédito' in celda or 'credito' in celda:
                        column_mapping['credito'] = j
                    elif 'saldo' in celda:
                        column_mapping['saldo'] = j
                
                break
        
        if headers_row is None:
            safe_print("No se encontraron encabezados específicos, intentando detectar desde la primera fila")
            headers_row = -1
            # Intentar mapeo por posición
            if len(df.columns) >= 5:
                column_mapping = {'fecha': 0, 'concepto': 1, 'detalle': 2, 'debito': 3, 'credito': 4, 'saldo': 5 if len(df.columns) > 5 else 4}
        
        # Extraer datos
        datos_filas = []
        start_row = headers_row + 1 if headers_row != -1 else 0
        
        safe_print(f"Procesando desde fila {start_row} hasta {len(df)}")
        
        i = start_row
        while i < len(df):
            try:
                fecha = ''
                concepto = ''
                detalle = ''
                debito = ''
                credito = ''
                saldo = ''
                
                # Extraer fecha (formato: YYYY/MM/DD HH:MM)
                if 'fecha' in column_mapping:
                    fecha_val = str(df.iloc[i, column_mapping['fecha']]).strip() if pd.notna(df.iloc[i, column_mapping['fecha']]) else ''
                else:
                    fecha_val = str(df.iloc[i, 0]).strip() if pd.notna(df.iloc[i, 0]) else ''
                
                # Buscar fecha en el valor
                match_fecha = re.search(r'(\d{4}/\d{2}/\d{2})', fecha_val)
                if match_fecha:
                    fecha_completa = match_fecha.group(1)
                    # Convertir a formato DD/MM/YYYY
                    partes = fecha_completa.split('/')
                    if len(partes) == 3:
                        fecha = f"{partes[2]}/{partes[1]}/{partes[0]}"
                else:
                    # Buscar fecha en cualquier columna
                    for j in range(len(df.columns)):
                        valor = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        match_fecha = re.search(r'(\d{4}/\d{2}/\d{2})', valor)
                        if match_fecha:
                            fecha_completa = match_fecha.group(1)
                            partes = fecha_completa.split('/')
                            if len(partes) == 3:
                                fecha = f"{partes[2]}/{partes[1]}/{partes[0]}"
                                break
                
                # Si no hay fecha, puede ser una continuación de la descripción de la línea anterior
                if not fecha:
                    if datos_filas:
                        # Agregar a la descripción anterior
                        ultima_fila = datos_filas[-1]
                        texto_linea = ' '.join([str(df.iloc[i, j]) for j in range(len(df.columns)) if pd.notna(df.iloc[i, j])]).strip()
                        if texto_linea and len(texto_linea) > 5:
                            # Agregar texto a la descripción
                            if 'Descripcion' in ultima_fila:
                                ultima_fila['Descripcion'] = f"{ultima_fila['Descripcion']} {texto_linea}".strip()
                    i += 1
                    continue
                
                # Extraer concepto
                if 'concepto' in column_mapping:
                    concepto = str(df.iloc[i, column_mapping['concepto']]).strip() if pd.notna(df.iloc[i, column_mapping['concepto']]) else ''
                
                # Extraer detalle
                if 'detalle' in column_mapping:
                    detalle = str(df.iloc[i, column_mapping['detalle']]).strip() if pd.notna(df.iloc[i, column_mapping['detalle']]) else ''
                
                # Construir descripción combinando concepto y detalle
                descripcion_parts = []
                if concepto and concepto != 'nan' and len(concepto) > 2:
                    descripcion_parts.append(concepto)
                if detalle and detalle != 'nan' and len(detalle) > 2:
                    descripcion_parts.append(detalle)
                
                # Si no hay en columnas mapeadas, buscar en otras columnas
                if not descripcion_parts:
                    fecha_col = column_mapping.get('fecha', -1)
                    for j in range(len(df.columns)):
                        if j == fecha_col:
                            continue
                        if j in column_mapping.values():
                            continue  # Ya revisamos estas columnas
                        valor = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor and valor != 'nan' and len(valor) > 5:
                            # Verificar que no sea un monto
                            if not re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', valor):
                                descripcion_parts.append(valor)
                                if len(descripcion_parts) >= 2:
                                    break
                
                descripcion = ' '.join(descripcion_parts).strip()
                
                # Extraer SALDO primero
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
                
                # Extraer DÉBITO Y CRÉDITO (pueden estar en la misma fila)
                # Primero buscar débito
                if 'debito' in column_mapping:
                    debito_val = str(df.iloc[i, column_mapping['debito']]).strip() if pd.notna(df.iloc[i, column_mapping['debito']]) else ''
                    if debito_val and debito_val != 'nan' and debito_val != '0,00':
                        match_debito = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', debito_val)
                        if match_debito and match_debito.group(1) != saldo:
                            debito = match_debito.group(1)
                
                # Si no encontramos débito, buscar en todas las columnas numéricas
                if not debito:
                    for j in range(len(df.columns)):
                        if j == column_mapping.get('saldo', -1):
                            continue
                        if j == column_mapping.get('credito', -1):
                            continue
                        valor_col = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor_col and valor_col != 'nan':
                            match_debito = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', valor_col)
                            if match_debito:
                                candidato = match_debito.group(1)
                                if candidato != saldo:
                                    debito = candidato
                                    break
                
                # Extraer CRÉDITO (puede estar junto con débito en diferentes columnas)
                if 'credito' in column_mapping:
                    credito_val = str(df.iloc[i, column_mapping['credito']]).strip() if pd.notna(df.iloc[i, column_mapping['credito']]) else ''
                    if credito_val and credito_val != 'nan' and credito_val != '0,00':
                        match_credito = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', credito_val)
                        if match_credito and match_credito.group(1) != saldo and match_credito.group(1) != debito:
                            credito = match_credito.group(1)
                
                # Si no encontramos crédito, buscar en otras columnas
                if not credito and not debito:
                    for j in range(len(df.columns)):
                        if j == column_mapping.get('saldo', -1):
                            continue
                        if j == column_mapping.get('debito', -1):
                            continue
                        valor_col = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                        if valor_col and valor_col != 'nan':
                            match_credito = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', valor_col)
                            if match_credito:
                                candidato = match_credito.group(1)
                                if candidato != saldo:
                                    credito = candidato
                                    break
                
                # Construir texto completo para filtrado
                texto_completo = ' '.join([str(df.iloc[i, j]) for j in range(len(df.columns)) if pd.notna(df.iloc[i, j])]).upper()
                
                # Filtrar encabezados/totales
                palabras_excluir = [
                    'FECHA', 'CONCEPTO', 'DETALLE', 'DÉBITO', 'CRÉDITO', 'DEBITO', 'CREDITO', 'SALDO',
                    'TOTAL', 'SUBTOTAL', 'SALDO INICIAL', 'SALDO FINAL', 'NÚMERO', 'CUENTA', 'MONEDA',
                    'CBU', 'ALIAS', 'TITULAR'
                ]
                
                tiene_palabra_excluir = any(palabra in texto_completo for palabra in palabras_excluir)
                tiene_importe = bool(debito or credito)
                tiene_saldo = bool(saldo)
                
                # Filtrar filas sin fecha que no tienen importe ni son realmente transacciones
                if tiene_palabra_excluir and not fecha and not tiene_importe:
                    i += 1
                    continue
                
                # Solo procesar si tiene fecha Y (importe o saldo)
                if fecha and (tiene_importe or tiene_saldo):
                    datos_filas.append({
                        'Fecha': fecha,
                        'Descripcion': descripcion if descripcion else 'Sin descripción',
                        'Debito': debito,
                        'Credito': credito,
                        'Saldo': saldo,
                        'Importe': ''
                    })
                
                i += 1
                    
            except Exception as e:
                safe_print(f"  Error procesando fila {i}: {e}")
                i += 1
                continue
        
        if datos_filas:
            df_resultado = pd.DataFrame(datos_filas)
            safe_print(f"  {len(df_resultado)} registros extraídos")
            return df_resultado
        else:
            return pd.DataFrame()
            
    except Exception as e:
        safe_print(f"Error procesando tabla: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return pd.DataFrame()

def guardar_excel_supervielle(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_supervielle(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")

def crear_totales_supervielle(df):
    """Crear totales por concepto"""
    try:
        saldo_inicial = 0
        total_debitos = 0
        total_creditos = 0
        
        # Sumar débitos y créditos
        for _, row in df.iterrows():
            debito_valor = str(row.get('Debito', '')).strip()
            if debito_valor and debito_valor != 'nan' and debito_valor != '':
                monto = convertir_valor_a_numero(debito_valor)
                if monto is not None:
                    total_debitos += monto
            
            credito_valor = str(row.get('Credito', '')).strip()
            if credito_valor and credito_valor != 'nan' and credito_valor != '':
                monto = convertir_valor_a_numero(credito_valor)
                if monto is not None:
                    total_creditos += monto
        
        # Buscar saldo inicial (primera fila con saldo)
        for _, row in df.iterrows():
            saldo_valor = str(row.get('Saldo', '')).strip()
            if saldo_valor and saldo_valor != 'nan' and saldo_valor != '':
                monto = convertir_valor_a_numero(saldo_valor)
                if monto is not None and monto > 0:
                    saldo_inicial = monto
                    break
        
        # Calcular saldo final
        saldo_final = saldo_inicial - total_debitos + total_creditos
        
        # Crear DataFrame
        conceptos = ['Saldo Inicial', 'Total Débitos', 'Total Créditos', 'Saldo Final']
        valores = [
            f"${saldo_inicial:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            f"${total_debitos:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            f"${total_creditos:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
            f"${saldo_final:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        ]
        
        df_totales = pd.DataFrame({
            'Concepto': conceptos,
            'Valor': valores
        })
        
        safe_print(f"Balance: Saldo Inicial: ${saldo_inicial:,.2f}, Débitos: ${total_debitos:,.2f}, Créditos: ${total_creditos:,.2f}, Saldo Final: ${saldo_final:,.2f}")
        return df_totales
    except Exception as e:
        safe_print(f"Error creando totales: {e}")
        return pd.DataFrame()

def convertir_valor_a_numero(valor_str):
    """Convertir valor de texto a número"""
    try:
        if not valor_str or valor_str == 'nan':
            return None
        
        # Limpiar el valor
        valor_limpio = str(valor_str).strip().replace('$', '').replace(' ', '')
        
        # Formato argentino: punto para miles, coma para decimales
        # Ejemplo: "1.480.712,63" -> 1480712.63
        if ',' in valor_limpio:
            partes = valor_limpio.split(',')
            parte_entera = partes[0].replace('.', '')
            parte_decimal = partes[1] if len(partes) > 1 else '00'
            valor_limpio = f"{parte_entera}.{parte_decimal}"
        
        return float(valor_limpio)
    except Exception as e:
        return None

