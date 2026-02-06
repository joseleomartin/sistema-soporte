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
        mensaje = mensaje.replace('\U0001f4c4', '')
        mensaje = mensaje.replace('\U0001f4ca', '')
        mensaje = mensaje.replace('\u2705', 'OK')
        mensaje = mensaje.replace('\u274c', 'ERROR')
        mensaje = mensaje.replace('\u26a0', 'WARNING')
        print(mensaje)
    except Exception:
        # Si todo falla, imprimir solo texto ASCII
        print(str(texto).encode('ascii', errors='replace').decode('ascii'))

def extraer_datos_santander_v3(pdf_path, excel_path=None):
    """Función principal para extraer datos de Santander"""
    try:
        # Validar que el archivo existe
        if not os.path.exists(pdf_path):
            safe_print(f"Error: El archivo PDF no existe: {pdf_path}")
            return pd.DataFrame()
        
        safe_print(f"Extrayendo tablas del PDF: {pdf_path}")
        
        # Extraer tablas con manejo de errores mejorado
        tables = None
        try:
            safe_print("Intentando extraer con método 'lattice'...")
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
        except Exception as e:
            safe_print(f"Error con método 'lattice': {str(e)}")
            tables = None
        
        if not tables or len(tables) == 0:
            safe_print("No se encontraron tablas con bordes definidos, intentando con método 'stream'...")
            try:
                tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
            except Exception as e:
                safe_print(f"Error con método 'stream': {str(e)}")
                tables = None
        
        if not tables or len(tables) == 0:
            safe_print("No se encontraron tablas en el PDF")
            # Intentar crear un Excel vacío para que el servidor no falle
            if excel_path:
                try:
                    df_vacio = pd.DataFrame(columns=['Fecha', 'Origen', 'Descripcion', 'Debito', 'Credito', 'Saldo', 'Movimiento'])
                    df_vacio.to_excel(excel_path, index=False)
                    safe_print(f"Excel vacío creado en: {excel_path}")
                except Exception as e:
                    safe_print(f"Error creando Excel vacío: {str(e)}")
            return pd.DataFrame()
        
        print(f"Se encontraron {len(tables)} tablas")
        
        # Buscar todas las tablas de movimientos manteniendo el orden del PDF
        tablas_movimientos = []
        for i, table in enumerate(tables):
            df = table.df
            texto_completo = ' '.join([str(valor) for valor in df.values.flatten() if pd.notna(valor)]).lower()
            
            # Buscar patrones específicos de Santander
            if (('movimiento' in texto_completo and 'saldo' in texto_completo) or
                ('fecha' in texto_completo and 'concepto' in texto_completo) or
                ('resumen' in texto_completo and 'cuenta' in texto_completo) or
                ('debito' in texto_completo and 'credito' in texto_completo)):
                print(f"Tabla {i+1} es de movimientos bancarios")
                # Guardar también el número de página y orden para mantener el orden del PDF
                tablas_movimientos.append((i, table.page, df))  # (índice, página, dataframe)
        
        if not tablas_movimientos:
            print("No se encontraron tablas de movimientos")
            return pd.DataFrame()
        
        # Procesar todas las tablas de movimientos manteniendo el orden del PDF
        df_procesado = pd.DataFrame()
        orden_global = 0  # Contador para mantener el orden original
        
        # Ordenar tablas por página e índice para mantener el orden del PDF
        tablas_ordenadas = sorted(tablas_movimientos, key=lambda x: (x[1], x[0]))  # Ordenar por página, luego por índice
        
        for idx_tabla, (tabla_idx, pagina, tabla) in enumerate(tablas_ordenadas):
            print(f"Procesando tabla de movimientos {idx_tabla+1}/{len(tablas_ordenadas)} (página {pagina}, índice {tabla_idx})")
            df_tabla = procesar_tabla_santander(tabla, orden_inicial=orden_global)
            if not df_tabla.empty:
                orden_global = df_tabla['_orden_original'].max() + 1 if '_orden_original' in df_tabla.columns else orden_global + len(df_tabla)
                df_procesado = pd.concat([df_procesado, df_tabla], ignore_index=True)
        
        if df_procesado.empty:
            print("No se pudieron procesar los datos")
            return pd.DataFrame()
        
        # Eliminar duplicados de TODAS las tablas combinadas (al final) manteniendo el orden
        print(f"\nEliminando duplicados de {len(df_procesado)} registros totales...")
        df_procesado = eliminar_duplicados_santander(df_procesado)
        print(f"Quedaron {len(df_procesado)} registros únicos después de eliminar duplicados")
        
        # Ordenar por orden original para mantener el orden del PDF
        if '_orden_original' in df_procesado.columns:
            df_procesado = df_procesado.sort_values('_orden_original').reset_index(drop=True)
            df_procesado = df_procesado.drop(columns=['_orden_original'])
        
        # Guardar Excel
        if excel_path:
            try:
                guardar_excel_santander(df_procesado, excel_path)
            except Exception as e:
                safe_print(f"Error guardando Excel: {str(e)}")
                # Intentar guardar un Excel básico
                try:
                    df_procesado.to_excel(excel_path, index=False)
                    safe_print(f"Excel básico guardado en: {excel_path}")
                except Exception as e2:
                    safe_print(f"Error guardando Excel básico: {str(e2)}")
        
        safe_print(f"Total de registros extraídos: {len(df_procesado)}")
        return df_procesado
        
    except Exception as e:
        import traceback
        safe_print(f"Error extrayendo datos: {str(e)}")
        safe_print(f"Traceback: {traceback.format_exc()}")
        # Asegurar que siempre se retorne un DataFrame, incluso si está vacío
        try:
            if excel_path:
                df_vacio = pd.DataFrame(columns=['Fecha', 'Origen', 'Descripcion', 'Debito', 'Credito', 'Saldo', 'Movimiento'])
                df_vacio.to_excel(excel_path, index=False)
                safe_print(f"Excel vacío creado debido al error en: {excel_path}")
        except Exception as e2:
            safe_print(f"Error creando Excel vacío: {str(e2)}")
        return pd.DataFrame()

def procesar_tabla_santander(df, orden_inicial=0):
    """Procesar tabla de Santander manteniendo el orden original"""
    try:
        print(f"Procesando tabla con {len(df)} filas y {len(df.columns)} columnas")
        
        # Buscar la fila que contiene los encabezados y mapear columnas
        headers_row = None
        column_mapping = {}
        
        for i, row in df.iterrows():
            contenido_completo = ' '.join([str(val) for val in row if pd.notna(val)]).lower()
            
            # Buscar fila con encabezados
            if any(palabra in contenido_completo for palabra in ['fecha', 'concepto', 'movimiento', 'débito', 'crédito', 'debito', 'credito', 'saldo', 'importe']):
                headers_row = i
                print(f"Encabezados encontrados en fila {i}")
                
                # Identificar columnas - buscar palabras clave más específicas
                for j in range(len(df.columns)):
                    celda = str(df.iloc[i, j]).strip().lower() if pd.notna(df.iloc[i, j]) else ''
                    celda_original = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                    
                    if 'fecha' in celda:
                        column_mapping['fecha'] = j
                        print(f"  Columna {j} mapeada como FECHA: '{celda_original}'")
                    elif 'comprobante' in celda:
                        column_mapping['comprobante'] = j
                        print(f"  Columna {j} mapeada como COMPROBANTE: '{celda_original}'")
                    elif 'concepto' in celda or 'descripcion' in celda or 'detalle' in celda or 'movimiento' in celda:
                        column_mapping['concepto'] = j
                        print(f"  Columna {j} mapeada como CONCEPTO: '{celda_original}'")
                    elif 'débito' in celda or 'debito' in celda or 'debit' in celda:
                        column_mapping['debito'] = j
                        print(f"  Columna {j} mapeada como DÉBITO: '{celda_original}'")
                    elif 'crédito' in celda or 'credito' in celda or 'credit' in celda:
                        column_mapping['credito'] = j
                        print(f"  Columna {j} mapeada como CRÉDITO: '{celda_original}'")
                    elif 'saldo' in celda and 'cuenta' in celda:
                        column_mapping['saldo'] = j
                        print(f"  Columna {j} mapeada como SALDO: '{celda_original}'")
                    elif 'saldo' in celda:
                        # Solo mapear como saldo si no hay otra columna de saldo
                        if 'saldo' not in column_mapping:
                            column_mapping['saldo'] = j
                            print(f"  Columna {j} mapeada como SALDO: '{celda_original}'")
                    elif 'importe' in celda:
                        # Si hay una columna "importe", puede ser débito o crédito
                        if 'debito' not in column_mapping and 'credito' not in column_mapping:
                            column_mapping['importe'] = j
                            print(f"  Columna {j} mapeada como IMPORTE: '{celda_original}'")
                
                break
        
        if headers_row is None:
            # Si no se encuentran encabezados, intentar procesar toda la tabla
            headers_row = -1
            print("No se encontraron encabezados, procesando toda la tabla")
            # Intentar mapeo por posición común
            if len(df.columns) >= 4:
                column_mapping = {'fecha': 0, 'concepto': 1}
                # Las últimas columnas suelen ser débito, crédito y saldo
                if len(df.columns) >= 5:
                    column_mapping['debito'] = len(df.columns) - 3
                    column_mapping['credito'] = len(df.columns) - 2
                    column_mapping['saldo'] = len(df.columns) - 1
                elif len(df.columns) >= 4:
                    column_mapping['saldo'] = len(df.columns) - 1
        
        # Extraer datos con manejo de fechas heredadas
        datos_filas = []
        start_row = headers_row + 1 if headers_row != -1 else 0
        fecha_actual = ''  # Para heredar fechas
        
        print(f"Procesando filas desde {start_row} hasta {len(df)}")
        
        # Procesar TODAS las filas para no perder ninguna transacción
        for i in range(start_row, len(df)):
            # Procesar cada fila usando el mapeo de columnas
            fila_procesada = parsear_fila_santander_mejorado(df, i, column_mapping, fecha_actual)
            if fila_procesada:
                # Agregar orden original para mantener el orden del PDF
                fila_procesada['_orden_original'] = orden_inicial + len(datos_filas)
                # Actualizar fecha actual si la fila tiene fecha
                if fila_procesada.get('Fecha'):
                    fecha_actual = fila_procesada['Fecha']
                datos_filas.append(fila_procesada)
            # Si la fila no se procesó pero tiene algún monto, intentar procesarla de nuevo sin filtros estrictos
            elif i < len(df):
                # Verificar si la fila tiene algún monto que indique que es una transacción
                tiene_monto_en_fila = False
                for j in range(len(df.columns)):
                    valor = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                    if valor and re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', valor.replace('$', '').replace(' ', '')):
                        tiene_monto_en_fila = True
                        break
                
                # Si tiene monto pero no se procesó, intentar procesarla con menos restricciones
                if tiene_monto_en_fila:
                    # Crear un mapeo más permisivo si no hay mapeo
                    if not column_mapping:
                        # Intentar mapeo básico por posición
                        if len(df.columns) >= 3:
                            column_mapping_temp = {'fecha': 0, 'concepto': 1}
                            if len(df.columns) >= 5:
                                column_mapping_temp['debito'] = len(df.columns) - 3
                                column_mapping_temp['credito'] = len(df.columns) - 2
                                column_mapping_temp['saldo'] = len(df.columns) - 1
                            elif len(df.columns) >= 4:
                                column_mapping_temp['saldo'] = len(df.columns) - 1
                            fila_procesada = parsear_fila_santander_mejorado(df, i, column_mapping_temp, fecha_actual)
                            if fila_procesada:
                                fila_procesada['_orden_original'] = orden_inicial + len(datos_filas)
                                if fila_procesada.get('Fecha'):
                                    fecha_actual = fila_procesada['Fecha']
                                datos_filas.append(fila_procesada)
        
        if datos_filas:
            df_procesado = pd.DataFrame(datos_filas)
            print(f"Procesadas {len(df_procesado)} filas de movimientos")
            
            # Combinar filas que son continuación de descripciones (tienen descripción pero no débito/crédito/saldo)
            df_procesado = combinar_filas_descripcion(df_procesado)
            print(f"Después de combinar descripciones: {len(df_procesado)} filas")
            
            # No eliminar duplicados aquí, se hará al final después de combinar todas las tablas
            return df_procesado
        else:
            print("No se pudieron procesar filas de datos")
            return pd.DataFrame()
        
    except Exception as e:
        safe_print(f"Error procesando tabla: {e}")
        import traceback
        safe_print(f"Traceback: {traceback.format_exc()}")
        return pd.DataFrame()

def parsear_fila_santander_mejorado(df, row_index, column_mapping, fecha_heredada=''):
    """Parsear una fila de datos de Santander usando mapeo de columnas"""
    try:
        # Construir texto completo de la fila para filtrado
        texto_completo = ' '.join([str(df.iloc[row_index, j]) for j in range(len(df.columns)) if pd.notna(df.iloc[row_index, j])]).upper()
        
        # Filtrar encabezados/totales/resúmenes (solo si es exactamente un encabezado)
        palabras_excluir = [
            'FECHA', 'COMPROBANTE', 'MOVIMIENTO', 'DÉBITO', 'CRÉDITO', 'DEBITO', 'CREDITO', 'SALDO EN CUENTA',
            'TOTAL', 'RESUMEN', 'SALDO FINAL', 'MOVIMIENTOS', 'PAGINA', 'CUENTA CORRIENTE'
        ]
        # Solo excluir si TODA la fila es un encabezado (no si solo contiene una palabra)
        es_encabezado = False
        texto_limpio = texto_completo.strip()
        if len(texto_limpio.split()) <= 3:  # Si tiene muy pocas palabras, probablemente es encabezado
            if any(palabra in texto_limpio for palabra in palabras_excluir):
                es_encabezado = True
        
        # Filtrar filas que son encabezados de sección o información no relevante
        if any(frase in texto_limpio for frase in ['DESDE:', 'HASTA:', 'SR.L', 'SRL DESDE', 'SRL HASTA', 'CBU:']):
            # Verificar si tiene algún monto, si no, es probablemente un encabezado
            tiene_monto = False
            for j in range(len(df.columns)):
                valor = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                if valor and re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', valor):
                    tiene_monto = True
                    break
            if not tiene_monto:
                return None  # Es un encabezado sin monto
        
        if es_encabezado:
            return None
        
        # Extraer fecha (puede estar vacía, se heredará)
        fecha = ''
        if 'fecha' in column_mapping:
            fecha_val = str(df.iloc[row_index, column_mapping['fecha']]).strip() if pd.notna(df.iloc[row_index, column_mapping['fecha']]) else ''
            # Buscar fecha en formato DD/MM/YYYY o DD/MM/YY
            match_fecha = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', fecha_val)
            if match_fecha:
                fecha = match_fecha.group(1)
        
        # Si no encontramos fecha en la columna mapeada, buscar en todas las columnas
        if not fecha:
            for j in range(len(df.columns)):
                valor = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                match_fecha = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', valor)
                if match_fecha:
                    fecha = match_fecha.group(1)
                break
        
        # Si no hay fecha, usar la heredada
        if not fecha:
            fecha = fecha_heredada
        
        # Extraer DÉBITO y CRÉDITO primero para determinar si es una fila válida
        # Extraer SALDO primero
        saldo = ''
        if 'saldo' in column_mapping:
            saldo_col = column_mapping['saldo']
            saldo_val = str(df.iloc[row_index, saldo_col]).strip() if pd.notna(df.iloc[row_index, saldo_col]) else ''
            saldo_val = saldo_val.replace('nan', '').replace('$', '').replace(' ', '').strip()
            if saldo_val and saldo_val != '':
                # Buscar TODOS los montos en la celda (puede haber múltiples valores)
                matches_saldo = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', saldo_val)
                if matches_saldo:
                    # Usar el último monto encontrado (normalmente el saldo está al final)
                    saldo = matches_saldo[-1]
        
        # Si no encontramos saldo en su columna, buscar en la última columna
        if not saldo and len(df.columns) > 0:
            ultima_col = len(df.columns) - 1
            saldo_val = str(df.iloc[row_index, ultima_col]).strip() if pd.notna(df.iloc[row_index, ultima_col]) else ''
            saldo_val = saldo_val.replace('nan', '').replace('$', '').replace(' ', '').strip()
            if saldo_val and saldo_val != '':
                # Buscar TODOS los montos en la celda (puede haber múltiples valores)
                matches_saldo = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', saldo_val)
                if matches_saldo:
                    # Usar el último monto encontrado (normalmente el saldo está al final)
                    saldo = matches_saldo[-1]
        
        # Extraer DÉBITO usando la columna mapeada (PRIORITARIO)
        debito = ''
        if 'debito' in column_mapping:
            debito_col = column_mapping['debito']
            debito_val = str(df.iloc[row_index, debito_col]).strip() if pd.notna(df.iloc[row_index, debito_col]) else ''
            debito_val = debito_val.replace('nan', '').replace('$', '').replace(' ', '').strip()
            
            if debito_val and debito_val != '0,00' and debito_val != '':
                match_debito = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', debito_val)
                if match_debito:
                    candidato = match_debito.group(1)
                    if candidato != saldo:
                        debito = candidato
        
        # Extraer CRÉDITO usando la columna mapeada (PRIORITARIO)
        credito = ''
        if 'credito' in column_mapping:
            credito_col = column_mapping['credito']
            credito_val = str(df.iloc[row_index, credito_col]).strip() if pd.notna(df.iloc[row_index, credito_col]) else ''
            credito_val = credito_val.replace('nan', '').replace('$', '').replace(' ', '').strip()
            
            if credito_val and credito_val != '0,00' and credito_val != '':
                match_credito = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', credito_val)
                if match_credito:
                    candidato = match_credito.group(1)
                    if candidato != saldo and candidato != debito:
                        credito = candidato
        
        # Si no encontramos débito o crédito en las columnas mapeadas, buscar en TODAS las columnas
        # Esto es CRÍTICO para capturar el 100% de las transacciones
        if not debito and not credito:
            fecha_col = column_mapping.get('fecha', -1)
            saldo_col = column_mapping.get('saldo', -1)
            debito_col = column_mapping.get('debito', -1)
            credito_col = column_mapping.get('credito', -1)
            concepto_col = column_mapping.get('concepto', -1)
            comprobante_col = column_mapping.get('comprobante', -1)
            
            montos_encontrados = []
            for j in range(len(df.columns)):
                # Saltar columnas ya revisadas
                if j in [fecha_col, saldo_col, debito_col, credito_col, concepto_col, comprobante_col]:
                    continue
                
                valor = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                valor = valor.replace('nan', '').replace('$', '').replace(' ', '').strip()
                
                if valor and valor != '0,00' and valor != '':
                    match_monto = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', valor)
                    if match_monto:
                        monto_candidato = match_monto.group(1)
                        # No usar el saldo como débito o crédito
                        if monto_candidato != saldo:
                            montos_encontrados.append((j, monto_candidato))
            
            # Si encontramos montos, determinar cuál es débito y cuál crédito
            if montos_encontrados:
                # Construir texto completo de todas las columnas de texto para determinar tipo
                texto_completo_fila = ''
                for j in range(len(df.columns)):
                    if j not in [fecha_col, saldo_col, debito_col, credito_col]:
                        valor_texto = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                        if valor_texto and valor_texto != 'nan' and not re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', valor_texto.replace('$', '').replace(' ', '')):
                            texto_completo_fila += ' ' + valor_texto
                texto_completo_fila = texto_completo_fila.upper()
                
                # Si hay un solo monto, intentar determinar si es débito o crédito por descripción
                if len(montos_encontrados) == 1:
                    monto = montos_encontrados[0][1]
                    
                    # Palabras clave para crédito
                    palabras_credito = ['RECIBID', 'CREDITO', 'CRÉDITO', 'INGRESO', 'DEPOSITO', 'DEPÓSITO', 'TRANSF RECIBID', 'TRANSFERENCIA RECIBID']
                    # Palabras clave para débito
                    palabras_debito = ['DEBITO', 'DÉBITO', 'PAGO', 'TRANSFERENCIA REALIZAD', 'TRANSF REALIZAD', 'EGRESO', 'RETIRO', 'REALIZAD']
                    
                    es_credito = any(palabra in texto_completo_fila for palabra in palabras_credito)
                    es_debito = any(palabra in texto_completo_fila for palabra in palabras_debito)
                    
                    if es_credito and not es_debito:
                        credito = monto
                    elif es_debito:
                        debito = monto
                    else:
                        # Por defecto, si no se puede determinar, usar posición relativa
                        # Si la columna está antes del saldo, probablemente es débito
                        col_idx_monto = montos_encontrados[0][0]
                        if saldo_col >= 0 and col_idx_monto < saldo_col:
                            debito = monto
                        else:
                            # Si no hay saldo o está después, intentar determinar por posición
                            # En extractos bancarios, típicamente: Fecha | Concepto | Débito | Crédito | Saldo
                            if col_idx_monto < len(df.columns) / 2:
                                debito = monto
                            else:
                                credito = monto
                elif len(montos_encontrados) >= 2:
                    # Si hay múltiples montos, usar posición y descripción
                    for idx, (col_idx, monto) in enumerate(montos_encontrados):
                        # Verificar si este monto específico es crédito o débito por descripción
                        es_credito_monto = any(palabra in texto_completo_fila for palabra in ['RECIBID', 'CREDITO', 'CRÉDITO', 'INGRESO', 'DEPOSITO'])
                        es_debito_monto = any(palabra in texto_completo_fila for palabra in ['DEBITO', 'DÉBITO', 'PAGO', 'REALIZAD', 'EGRESO'])
                        
                        if es_credito_monto and not credito:
                            credito = monto
                        elif es_debito_monto and not debito:
                            debito = monto
                        elif col_idx < saldo_col if saldo_col >= 0 else col_idx < len(df.columns) / 2:
                            if not debito:
                                debito = monto
                        else:
                            if not credito:
                                credito = monto
        
        # NO filtrar líneas "Resp:" aquí - se combinarán después en combinar_filas_descripcion
        # Solo verificar si es una línea completamente vacía
        
        # Extraer descripción temporalmente para verificar si es "Resp:"
        descripcion_temp_check = ''
        if 'concepto' in column_mapping:
            concepto_check = str(df.iloc[row_index, column_mapping['concepto']]).strip() if pd.notna(df.iloc[row_index, column_mapping['concepto']]) else ''
            if concepto_check and concepto_check != 'nan':
                descripcion_temp_check = concepto_check
        
        # Si es una línea "Resp:" o sub-detalle, permitir que pase para combinarse después
        es_resp = (descripcion_temp_check.startswith('Resp:') or 
                  descripcion_temp_check.startswith('resp:') or
                  (len(descripcion_temp_check.split()) <= 5 and any(x in descripcion_temp_check.lower() for x in ['sobre', '%', 'resp', '0,01', '0,09'])))
        
        # PRIORIDAD ABSOLUTA: Si tiene débito, crédito o saldo, es una transacción válida
        # Esto asegura que capturemos el 100% de los movimientos
        tiene_movimiento = debito or credito or saldo
        
        # EXCLUIR líneas que solo contienen "Resp:" y no tienen movimiento
        # Estas líneas son sub-detalles que no deben aparecer como transacciones separadas
        if es_resp and not tiene_movimiento:
            return None  # Excluir completamente las líneas "Resp:" sin movimiento
        
        if tiene_movimiento:
            # Si no hay fecha pero hay movimiento, usar la heredada
            if not fecha:
                fecha = fecha_heredada
            # Continuar procesando - esta es una transacción válida (MÁXIMA PRIORIDAD)
        else:
            # No tiene débito, crédito, saldo ni es "Resp:" - verificar si tiene algún monto en cualquier columna
            # Última verificación para no perder transacciones
            tiene_cualquier_monto = False
            for j in range(len(df.columns)):
                valor = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                valor = valor.replace('nan', '').replace('$', '').replace(' ', '').strip()
                if valor and re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', valor):
                    tiene_cualquier_monto = True
                    break
            
            if tiene_cualquier_monto:
                # Tiene algún monto, es probablemente una transacción válida
                if not fecha:
                    fecha = fecha_heredada
            else:
                # No tiene ningún monto ni es "Resp:" - no es una transacción válida
                return None
        
        # Extraer descripción - incluir TODAS las columnas de texto (comprobante, movimiento, etc.)
        descripcion_parts = []
        
        # Extraer comprobante primero (si está mapeado)
        if 'comprobante' in column_mapping:
            comprobante = str(df.iloc[row_index, column_mapping['comprobante']]).strip() if pd.notna(df.iloc[row_index, column_mapping['comprobante']]) else ''
            if comprobante and comprobante != 'nan' and comprobante.strip():
                descripcion_parts.append(comprobante)
        
        # Si no hay comprobante mapeado, buscar en columnas entre fecha y movimiento
        if not descripcion_parts or (descripcion_parts and len(descripcion_parts[0]) < 6):
            fecha_col = column_mapping.get('fecha', -1)
            concepto_col = column_mapping.get('concepto', -1)
            for j in range(len(df.columns)):
                if j == fecha_col or j == concepto_col:
                    continue
                if j == column_mapping.get('debito', -1) or j == column_mapping.get('credito', -1) or j == column_mapping.get('saldo', -1):
                    continue
                valor = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                # Si es un número que parece comprobante (6-10 dígitos), es comprobante
                if valor and valor != 'nan' and re.match(r'^\d{6,10}$', valor.replace(' ', '')):
                    if not descripcion_parts or descripcion_parts[0] != valor:
                        descripcion_parts.insert(0, valor)  # Comprobante al inicio
                        break
        
        # Extraer descripción de la columna de concepto/movimiento
        if 'concepto' in column_mapping:
            concepto = str(df.iloc[row_index, column_mapping['concepto']]).strip() if pd.notna(df.iloc[row_index, column_mapping['concepto']]) else ''
            if concepto and concepto != 'nan' and len(concepto) > 2:
                descripcion_parts.append(concepto)
        
        # Si no hay descripción en la columna mapeada, buscar en otras columnas
        if not descripcion_parts or len(descripcion_parts) == 1:  # Si solo tiene comprobante, buscar más
            fecha_col = column_mapping.get('fecha', -1)
            debito_col = column_mapping.get('debito', -1)
            credito_col = column_mapping.get('credito', -1)
            saldo_col = column_mapping.get('saldo', -1)
            comprobante_col = column_mapping.get('comprobante', -1)
            
            for j in range(len(df.columns)):
                if j == fecha_col or j == debito_col or j == credito_col or j == saldo_col:
                    continue
                if j == comprobante_col:  # Ya lo agregamos
                    continue
                valor = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                if valor and valor != 'nan' and len(valor) > 2:
                    # Verificar que no sea un monto
                    if not re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', valor):
                        # Verificar que no sea solo un número (comprobante ya agregado)
                        if not re.match(r'^\d{6,10}$', valor.replace(' ', '')):
                            descripcion_parts.append(valor)
        
        descripcion = ' '.join(descripcion_parts).strip()
        
        # Eliminar duplicados en la descripción (palabras o frases repetidas)
        if descripcion:
            palabras = descripcion.split()
            # Detectar y eliminar frases duplicadas consecutivas
            descripcion_sin_dup = []
            palabras_previas = []
            for i, palabra in enumerate(palabras):
                palabras_previas.append(palabra)
                # Si tenemos al menos 3 palabras previas, verificar si se repiten
                if len(palabras_previas) >= 3 and i + 1 < len(palabras):
                    # Verificar si las últimas palabras se repiten
                    if len(palabras_previas) * 2 <= len(palabras):
                        mitad = len(palabras_previas)
                        if palabras[:mitad] == palabras[mitad:mitad*2]:
                            # Hay duplicación, usar solo la primera mitad
                            descripcion = ' '.join(palabras[:mitad])
                            break
            
            # También eliminar palabras duplicadas consecutivas simples
            palabras_finales = []
            palabra_anterior = ''
            for palabra in descripcion.split():
                if palabra != palabra_anterior:
                    palabras_finales.append(palabra)
                palabra_anterior = palabra
            descripcion = ' '.join(palabras_finales).strip()
            
            # Eliminar frases completas duplicadas (ej: "texto texto")
            palabras_desc = descripcion.split()
            if len(palabras_desc) > 1:
                mitad = len(palabras_desc) // 2
                primera_mitad = ' '.join(palabras_desc[:mitad])
                segunda_mitad = ' '.join(palabras_desc[mitad:])
                if primera_mitad == segunda_mitad:
                    descripcion = primera_mitad
        
        # Si aún no tenemos débito o crédito pero tenemos descripción, buscar montos en la descripción
        # Esto es importante para capturar transacciones que tienen montos en el texto (ej: comisiones, tarifas)
        if not debito and not credito and descripcion:
            # Buscar montos en la descripción (formato: $ X.XXX,XX o X.XXX,XX)
            montos_en_desc = re.findall(r'\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})', descripcion)
            if montos_en_desc:
                # Si encontramos un monto en la descripción, puede ser el monto de la transacción
                # Determinar si es débito o crédito por palabras clave
                descripcion_upper = descripcion.upper()
                palabras_credito = ['RECIBID', 'CREDITO', 'CRÉDITO', 'INGRESO', 'DEPOSITO', 'DEPÓSITO', 'TRANSF RECIBID', 'TRANSFERENCIA RECIBID']
                palabras_debito = ['DEBITO', 'DÉBITO', 'PAGO', 'TRANSFERENCIA REALIZAD', 'TRANSF REALIZAD', 'EGRESO', 'RETIRO', 'REALIZAD', 'COMISION', 'IMPUESTO', 'SERVICIO', 'TARIFA', 'CHEQUE', 'CERTIFICACION', 'REGISTRACION', 'GESTION', 'EMISION', 'POR CADA']
                
                es_credito = any(palabra in descripcion_upper for palabra in palabras_credito)
                es_debito = any(palabra in descripcion_upper for palabra in palabras_debito)
                
                # Usar el primer monto encontrado (o el más grande si hay varios)
                montos_numericos = []
                for monto_str in montos_en_desc:
                    monto_limpio = monto_str.replace('.', '').replace(',', '.')
                    try:
                        montos_numericos.append((float(monto_limpio), monto_str))
                    except:
                        pass
                
                if montos_numericos:
                    # Usar el monto más grande (probablemente es el monto de la transacción, no una tarifa)
                    monto_principal = max(montos_numericos, key=lambda x: x[0])[1]
                    
                    if es_credito and not es_debito:
                        credito = monto_principal
                    elif es_debito:
                        debito = monto_principal
                    else:
                        # Si no se puede determinar, asumir débito (la mayoría de las comisiones son débitos)
                        debito = monto_principal
        
        # Si tiene débito o crédito, es válida aunque no tenga descripción
        # Solo filtrar si no tiene movimiento ni saldo ni descripción
        if not descripcion or len(descripcion) < 2:
            # Si no hay descripción, débito, crédito ni saldo, es una fila vacía
            if not debito and not credito and not saldo:
                return None
            # Si tiene débito o crédito pero no descripción, crear una descripción básica
            if (debito or credito) and not descripcion:
                # Buscar cualquier texto en la fila que no sea fecha ni monto
                for j in range(len(df.columns)):
                    if j == column_mapping.get('fecha', -1):
                        continue
                    if j == column_mapping.get('debito', -1):
                        continue
                    if j == column_mapping.get('credito', -1):
                        continue
                    if j == column_mapping.get('saldo', -1):
                        continue
                    valor = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                    if valor and valor != 'nan' and len(valor) > 2:
                        if not re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', valor):
                            descripcion_parts.append(valor)
                descripcion = ' '.join(descripcion_parts).strip()
                if not descripcion:
                    descripcion = 'Movimiento bancario'  # Descripción por defecto
        
        # Si NO encontramos débito ni crédito en las columnas mapeadas,
        # buscar en otras columnas como respaldo (IMPORTANTE: no perder transacciones)
        if not debito and not credito:
            # Buscar todos los montos en la fila (excluyendo saldo)
            montos = []
            saldo_col = column_mapping.get('saldo', -1)
            fecha_col = column_mapping.get('fecha', -1)
            concepto_col = column_mapping.get('concepto', -1)
            
            # Buscar en todas las columnas excepto fecha, concepto y saldo
            for j in range(len(df.columns)):
                if j == saldo_col or j == fecha_col or j == concepto_col:
                    continue
                valor = str(df.iloc[row_index, j]).strip() if pd.notna(df.iloc[row_index, j]) else ''
                if valor and valor != 'nan':
                    # Limpiar valor
                    valor_limpio = valor.replace('$', '').replace(' ', '').replace('nan', '').strip()
                    if valor_limpio:
                        # Buscar TODOS los montos en la celda (puede haber múltiples valores combinados)
                        matches_monto = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', valor_limpio)
                        for match_monto in matches_monto:
                            candidato = match_monto
                            if candidato != saldo:
                                montos.append((candidato, j))  # Guardar monto y columna
            
            # Si hay montos, determinar si es débito o crédito
            if montos:
                # Ordenar por posición de columna (los montos de movimiento suelen estar antes del saldo)
                montos.sort(key=lambda x: x[1])
                monto_movimiento = montos[0][0]  # Primer monto que no sea saldo
                descripcion_upper = descripcion.upper()
                
                # Buscar palabras clave más específicas para créditos
                palabras_credito = [
                    'TRANSFERENCIA RECIBIDA', 'TRANSF RECIBIDA', 'TRANSF RECIB', 
                    'DEPOSITO', 'DEPÓSITO', 'COBRO', 'INGRESO', 'ABONO', 
                    'CREDITO', 'CRÉDITO', 'TRANSFERENCIA CTAS', 'TRANSF CTAS'
                ]
                palabras_debito = [
                    'DEBITO AUTOMATICO', 'DÉBITO AUTOMÁTICO', 'DEBITO AUTOMAT', 
                    'DEBITO', 'DÉBITO', 'PAGO', 'RETIRO', 'EGRESO', 
                    'COMISION', 'COMISIÓN', 'INTERES', 'INTERÉS', 'IMPUESTO', 'LEY'
                ]
                
                # Determinar por descripción
                es_credito = any(palabra in descripcion_upper for palabra in palabras_credito)
                es_debito = any(palabra in descripcion_upper for palabra in palabras_debito)
                
                if es_credito and not es_debito:
                    credito = monto_movimiento
                elif es_debito:
                    debito = monto_movimiento
                else:
                    # Si no se puede determinar por descripción, usar lógica de posición
                    # En extractos bancarios, típicamente hay columnas: Fecha | Descripción | Débito | Crédito | Saldo
                    # Si el monto está en una posición antes del saldo y hay múltiples columnas, 
                    # verificar si hay otra columna con monto (podría ser débito o crédito)
                    if len(montos) >= 2:
                        # Si hay dos montos y uno es saldo, el otro es el movimiento
                        # Por defecto, si no hay indicación, asumir crédito para transferencias recibidas
                        if 'TRANSF' in descripcion_upper or 'TRANSFERENCIA' in descripcion_upper:
                            credito = monto_movimiento
                        else:
                            debito = monto_movimiento
            else:
                        # Solo un monto (además del saldo), asumir débito por defecto
                        debito = monto_movimiento
        
        # Crear fila procesada
        return {
            'Fecha': fecha,
            'Origen': '',
            'Descripcion': descripcion,
            'Debito': debito,
            'Credito': credito,
            'Saldo': saldo,
            'Movimiento': ''
        }
        
    except Exception as e:
        safe_print(f"Error parseando fila {row_index}: {e}")
        return None

def combinar_filas_descripcion(df):
    """Combinar filas que son continuación de descripciones en múltiples líneas manteniendo el orden"""
    try:
        if df.empty or len(df) <= 1:
            return df
        
        df = df.copy()
        # Asegurar que tenemos columna de orden si existe
        tiene_orden = '_orden_original' in df.columns
        if tiene_orden:
            df = df.sort_values('_orden_original').reset_index(drop=True)
        
        filas_combinadas = []
        i = 0
        
        while i < len(df):
            fila_actual = df.iloc[i].to_dict()
            
            # Si esta fila tiene movimiento (débito o crédito), es una fila principal
            # PRIORIDAD: débito y crédito son más importantes que saldo
            tiene_movimiento = (str(fila_actual.get('Debito', '')).strip() != '' or 
                              str(fila_actual.get('Credito', '')).strip() != '')
            tiene_saldo = str(fila_actual.get('Saldo', '')).strip() != ''
            
            # Si tiene movimiento (débito o crédito), SIEMPRE es una transacción válida
            if tiene_movimiento:
                # Buscar filas siguientes que sean continuación (tienen descripción pero no movimiento)
                descripcion_completa = [str(fila_actual.get('Descripcion', '')).strip()]
                j = i + 1
                
                while j < len(df):
                    fila_siguiente = df.iloc[j].to_dict()
                    debito_sig = str(fila_siguiente.get('Debito', '')).strip()
                    credito_sig = str(fila_siguiente.get('Credito', '')).strip()
                    saldo_sig = str(fila_siguiente.get('Saldo', '')).strip()
                    tiene_mov_principal_sig = (debito_sig != '' or credito_sig != '')
                    
                    # Si la siguiente fila tiene movimiento PRINCIPAL (débito o crédito), es una nueva transacción
                    if tiene_mov_principal_sig:
                        break
                    
                    # Si no tiene movimiento pero tiene descripción, es continuación
                    desc_sig = str(fila_siguiente.get('Descripcion', '')).strip()
                    fecha_sig = str(fila_siguiente.get('Fecha', '')).strip()
                    fecha_actual = str(fila_actual.get('Fecha', '')).strip()
                    
                    # Verificar si es un sub-detalle (Resp:, etc.)
                    es_subdetalle = (desc_sig.startswith('Resp:') or 
                                   desc_sig.startswith('resp:') or
                                   (len(desc_sig.split()) <= 8 and any(x in desc_sig.lower() for x in ['sobre', '%', 'resp', '0,01', '0,09', '0,01%', '0,09%', '/'])))
                    
                    # Si es sub-detalle, SIEMPRE combinarlo (incluso si tiene un monto pequeño)
                    if es_subdetalle:
                        descripcion_completa.append(desc_sig)
                        # Si el sub-detalle tiene saldo pero la fila principal no, usar ese saldo
                        if saldo_sig and not str(fila_actual.get('Saldo', '')).strip():
                            fila_actual['Saldo'] = saldo_sig
                        j += 1
                        continue
                    
                    # Verificar si es continuación de descripción (misma fecha o sin fecha, sin movimiento principal)
                    # Si tiene débito o crédito, es una nueva transacción (a menos que sea muy pequeño, probablemente es parte de la descripción)
                    tiene_mov_principal = debito_sig or credito_sig
                    es_continuacion = (not fecha_sig or fecha_sig == fecha_actual or fecha_sig == '') and desc_sig and len(desc_sig) > 2
                    
                    if es_continuacion and not tiene_mov_principal:
                        # Es continuación de descripción normal sin movimiento
                        descripcion_completa.append(desc_sig)
                        # Si tiene saldo pero la fila principal no, usar ese saldo
                        if saldo_sig and not str(fila_actual.get('Saldo', '')).strip():
                            fila_actual['Saldo'] = saldo_sig
                        j += 1
                    else:
                        # Nueva fecha, tiene movimiento principal, o sin descripción - nueva transacción
                        break
                
                # Combinar descripciones y eliminar duplicados
                descripcion_combinada = ' '.join([d for d in descripcion_completa if d]).strip()
                
                # Eliminar duplicados en la descripción combinada
                if descripcion_combinada:
                    palabras = descripcion_combinada.split()
                    # Detectar y eliminar frases duplicadas consecutivas
                    palabras_finales = []
                    palabra_anterior = ''
                    for palabra in palabras:
                        if palabra != palabra_anterior:
                            palabras_finales.append(palabra)
                        palabra_anterior = palabra
                    descripcion_combinada = ' '.join(palabras_finales).strip()
                    
                    # Eliminar frases completas duplicadas (ej: "texto texto")
                    palabras_desc = descripcion_combinada.split()
                    if len(palabras_desc) > 1:
                        mitad = len(palabras_desc) // 2
                        primera_mitad = ' '.join(palabras_desc[:mitad])
                        segunda_mitad = ' '.join(palabras_desc[mitad:])
                        if primera_mitad == segunda_mitad:
                            descripcion_combinada = primera_mitad
                
                fila_actual['Descripcion'] = descripcion_combinada
                
                # Asegurar que si tiene movimiento, tenga saldo (buscar en filas siguientes si es necesario)
                if (fila_actual.get('Debito') or fila_actual.get('Credito')) and not fila_actual.get('Saldo'):
                    # Buscar saldo en las filas que combinamos
                    for k in range(i + 1, min(j, len(df))):
                        fila_buscar = df.iloc[k].to_dict()
                        saldo_buscar = str(fila_buscar.get('Saldo', '')).strip()
                        if saldo_buscar:
                            fila_actual['Saldo'] = saldo_buscar
                            break
                
                filas_combinadas.append(fila_actual)
                i = j  # Saltar las filas que ya combinamos
            elif tiene_saldo:
                # Si no tiene movimiento pero tiene saldo, puede ser válida (ej: saldo inicial)
                desc = str(fila_actual.get('Descripcion', '')).strip()
                saldo_actual = str(fila_actual.get('Saldo', '')).strip()
                fecha_actual = str(fila_actual.get('Fecha', '')).strip()
                # Incluir si tiene saldo y (descripción o fecha)
                if saldo_actual and (desc or fecha_actual):
                    filas_combinadas.append(fila_actual)
                i += 1
            else:
                # No tiene movimiento ni saldo - probablemente es una línea de continuación
                # Solo incluir si es "Resp:" para combinarse con la anterior
                desc = str(fila_actual.get('Descripcion', '')).strip()
                if desc and (desc.startswith('Resp:') or desc.startswith('resp:')):
                    # Es una línea "Resp:" sin movimiento, intentar combinarla con la anterior
                    if filas_combinadas:
                        ultima_fila = filas_combinadas[-1]
                        desc_anterior = str(ultima_fila.get('Descripcion', '')).strip()
                        ultima_fila['Descripcion'] = f"{desc_anterior} {desc}".strip()
                i += 1
        
        if filas_combinadas:
            df_resultado = pd.DataFrame(filas_combinadas)
            # Ordenar por orden original si existe
            if '_orden_original' in df_resultado.columns:
                df_resultado = df_resultado.sort_values('_orden_original').reset_index(drop=True)
            return df_resultado
        else:
            return df
            
    except Exception as e:
        safe_print(f"Error combinando filas: {e}")
        return df

def eliminar_duplicados_santander(df):
    """Eliminar duplicados basándose en fecha + descripción + monto"""
    try:
        if df.empty:
            return df
        
        # Primero, eliminar filas completamente vacías (sin fecha, sin descripción, sin montos)
        df = df.copy()
        filas_validas = []
        for idx, row in df.iterrows():
            fecha = str(row.get('Fecha', '')).strip()
            descripcion = str(row.get('Descripcion', '')).strip()
            debito = str(row.get('Debito', '')).strip()
            credito = str(row.get('Credito', '')).strip()
            saldo = str(row.get('Saldo', '')).strip()
            
            # Si no tiene fecha, descripción, ni montos, es una fila vacía
            if not fecha and not descripcion and not debito and not credito and not saldo:
                continue  # Saltar fila vacía
            
            # Si tiene algún monto (débito, crédito o saldo), es válida aunque no tenga descripción
            if debito or credito or saldo:
                filas_validas.append(idx)
                continue
            
            # Si tiene fecha y descripción, también es válida (puede ser una línea de continuación)
            if fecha and descripcion:
                filas_validas.append(idx)
                continue
            
            filas_validas.append(idx)
        
        df = df.loc[filas_validas].copy()
        
        if df.empty:
            return df
        
        # Crear una clave única para cada fila
        def crear_clave(row):
            fecha = str(row.get('Fecha', '')).strip()
            descripcion = str(row.get('Descripcion', '')).strip()
            debito = str(row.get('Debito', '')).strip()
            credito = str(row.get('Credito', '')).strip()
            saldo = str(row.get('Saldo', '')).strip()
            
            # Normalizar fecha (remover espacios extra)
            fecha = re.sub(r'\s+', '', fecha)
            
            # Normalizar descripción (remover espacios extra, tomar primeros 60 caracteres)
            descripcion = re.sub(r'\s+', ' ', descripcion).strip()[:60]
            
            # Determinar monto de movimiento (no saldo)
            monto = debito if debito else credito
            
            # Si la clave es muy simple (solo fecha), no es útil para detectar duplicados
            if not descripcion and not monto:
                return None  # Fila sin datos suficientes
            
            # Crear clave más robusta
            # Incluir parte de la descripción para mejor detección de duplicados
            descripcion_key = descripcion[:40] if descripcion else ''
            return f"{fecha}|{descripcion_key}|{monto}"
        
        # Agregar columna temporal con la clave
        df['_clave_unica'] = df.apply(crear_clave, axis=1)
        
        # Eliminar filas sin clave válida
        df = df[df['_clave_unica'].notna()].copy()
        
        if df.empty:
            return df
        
        # Eliminar duplicados manteniendo el primero (el que tiene menor orden original)
        if '_orden_original' in df.columns:
            # Ordenar por orden original antes de eliminar duplicados
            df = df.sort_values('_orden_original').reset_index(drop=True)
        
        df_sin_duplicados = df.drop_duplicates(subset=['_clave_unica'], keep='first')
        
        # Eliminar columna temporal de clave
        if '_clave_unica' in df_sin_duplicados.columns:
            df_sin_duplicados = df_sin_duplicados.drop(columns=['_clave_unica'])
        
        # Mantener orden original si existe
        if '_orden_original' in df_sin_duplicados.columns:
            df_sin_duplicados = df_sin_duplicados.sort_values('_orden_original').reset_index(drop=True)
        
        return df_sin_duplicados
        
    except Exception as e:
        safe_print(f"Error eliminando duplicados: {e}")
        return df

def guardar_excel_santander(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_santander(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        print(f"Excel guardado: {excel_path}")
        
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")

def crear_totales_santander(df):
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
        
        print(f"Balance: Saldo Inicial: ${saldo_inicial:,.2f}, Débitos: ${total_debitos:,.2f}, Créditos: ${total_creditos:,.2f}, Saldo Final: ${saldo_final:,.2f}")
        return df_totales
        
    except Exception as e:
        safe_print(f"Error creando totales: {e}")
        return pd.DataFrame()

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
