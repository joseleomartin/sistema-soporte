import camelot
import pandas as pd
import re
import os
import pdfplumber

def safe_print(texto):
    """Imprimir texto de forma segura en Windows"""
    try:
        print(texto)
    except UnicodeEncodeError:
        try:
            texto_encoded = texto.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
            print(texto_encoded)
        except Exception:
            print("Error al imprimir mensaje")

def extraer_datos_banco_galicia_mas(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco Galicia Mas (ex HSBC)"""
    try:
        if not os.path.exists(pdf_path):
            safe_print(f"ERROR: El archivo PDF no existe: {pdf_path}")
            return pd.DataFrame()
        
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Extraer Saldo Deudores del texto del PDF (similar a Galicia)
        saldo_deudores_promedio = ''
        saldo_deudores_intereses = ''
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                texto_completo = ''
                for page in pdf.pages:
                    texto_completo += page.extract_text() or ''
                
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
        
        # Extraer datos del texto directamente (formato específico de Galicia Mas)
        all_data = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                texto_completo = ''
                for page in pdf.pages:
                    texto_completo += page.extract_text() or ''
                
                lineas = texto_completo.split('\n')
                
                # Buscar inicio de sección "DETALLE DE OPERACIONES"
                en_seccion_operaciones = False
                transacciones = []
                
                for i, linea in enumerate(lineas):
                    linea_clean = linea.strip()
                    
                    # Detectar inicio de sección
                    if 'DETALLE DE OPERACIONES' in linea_clean.upper():
                        en_seccion_operaciones = True
                        safe_print(f"Sección 'DETALLE DE OPERACIONES' encontrada en línea {i}")
                        continue
                    
                    # Procesar movimientos mientras estemos en la sección
                    if en_seccion_operaciones:
                        # Detectar fin de sección (salto a nueva sección o página)
                        if linea_clean.startswith('HOJA'):
                            safe_print(f"Fin de sección detectado (línea {i} es HOJA)")
                            break
                        
                        # También verificar si la siguiente línea es HOJA
                        if i < len(lineas) - 1:
                            siguiente_linea = lineas[i+1].strip() if i+1 < len(lineas) else ''
                            if siguiente_linea.startswith('HOJA'):
                                safe_print(f"Fin de sección detectado (siguiente línea {i+1} es HOJA)")
                                # Procesar esta línea antes de salir si tiene datos
                                pass
                        
                        # Formato esperado: DD-MMM - DESCRIPCIÓN CÓDIGO IMPORTE SALDO
                        # Ejemplo: "05-MAY - PRESTAMOS. 00000 734,519.13 127,747.67"
                        # Formato numérico: punto como separador de miles, punto como decimal
                        # Nota: Los números tienen formato "734,519.13" (coma para miles, punto para decimal)
                        # Mejorar patrón para capturar más variaciones
                        match_movimiento = re.search(r'(\d{2}[-/]\w{3})\s*-\s*(.+?)\s+(\d{3,})\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s+(\d{1,3}(?:,\d{3})*\.\d{2})', linea_clean)
                        
                        # Si el patrón estricto falla, intentar patrón más flexible (sin código obligatorio)
                        if not match_movimiento:
                            match_movimiento = re.search(r'(\d{2}[-/]\w{3})\s*-\s*(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s+(\d{1,3}(?:,\d{3})*\.\d{2})', linea_clean)
                        
                        if match_movimiento:
                            fecha_corta = match_movimiento.group(1)  # "05-MAY"
                            descripcion = match_movimiento.group(2).strip()  # "PRESTAMOS."
                            
                            # Si tiene 5 grupos, el tercero es código y los siguientes son importe y saldo
                            # Si tiene 4 grupos, no hay código separado
                            if len(match_movimiento.groups()) == 5:
                                codigo = match_movimiento.group(3)  # "00000"
                                importe = match_movimiento.group(4)  # "734,519.13"
                                saldo = match_movimiento.group(5)  # "127,747.67"
                            else:
                                codigo = '00000'  # Código por defecto
                                importe = match_movimiento.group(3)  # "734,519.13"
                                saldo = match_movimiento.group(4)  # "127,747.67"
                            
                            # Convertir fecha de formato DD-MMM a DD/MM/YYYY
                            # Necesito obtener el año del período del extracto
                            match_periodo = re.search(r'EXTRACTO DEL (\d{2})/(\d{2})/(\d{4}) AL', texto_completo)
                            if match_periodo:
                                año = match_periodo.group(3)
                                mes_periodo = match_periodo.group(2)
                            else:
                                año = '2025'
                                mes_periodo = '05'
                            
                            # Mapeo de meses abreviados
                            meses = {
                                'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04', 'MAY': '05', 'JUN': '06',
                                'JUL': '07', 'AGO': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
                            }
                            
                            # Convertir DD-MMM a DD/MM/YYYY (formato completo)
                            partes_fecha = fecha_corta.split('-')
                            if len(partes_fecha) == 2:
                                dia = partes_fecha[0]
                                mes_abr = partes_fecha[1].upper()
                                mes = meses.get(mes_abr, mes_periodo)
                                # Formato completo DD/MM/YYYY
                                fecha = f"{dia}/{mes}/{año}"
                            else:
                                fecha = fecha_corta
                            
                            # Determinar si es débito o crédito
                            # Los débitos suelen estar en movimientos negativos o en descripciones específicas
                            debito = ''
                            credito = ''
                            
                            # El formato del importe es: "734,519.13" (coma para miles, punto para decimal)
                            # Necesitamos convertir a número: quitar comas, mantener punto decimal
                            importe_limpio = importe.replace(',', '')  # Quitar comas
                            importe_val = float(importe_limpio)
                            
                            # INTERBANKING o transferencias entrantes son créditos
                            if 'INTERBANKING' in descripcion.upper() or 'CREDITO' in descripcion.upper() or 'DEPOSITO' in descripcion.upper():
                                credito = f"{importe_val:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                            else:
                                debito = f"-{importe_val:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                            
                            # Combinar descripción con código si es relevante
                            # Preservar la descripción completa (no truncar)
                            descripcion_completa = f"{descripcion}".strip()
                            if codigo and codigo != '00000':  # Solo agregar código si no es genérico
                                descripcion_completa = f"{descripcion_completa} {codigo}".strip()
                            
                            # Convertir saldo a formato correcto (el formato original es: "734,519.13")
                            # Necesitamos: quitar coma de miles, mantener punto como decimal
                            saldo_limpio = saldo.replace(',', '')  # Quitar comas (separador de miles)
                            try:
                                saldo_num = float(saldo_limpio)
                                saldo_formateado = f"{saldo_num:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                            except:
                                saldo_formateado = saldo
                            
                            transacciones.append({
                                'Fecha': fecha,
                                'Descripcion': descripcion_completa,
                                'Debito': debito,
                                'Credito': credito,
                                'Saldo': saldo_formateado,
                                'Importe': ''
                            })
                            safe_print(f"Transacción encontrada: {fecha} - {descripcion_completa[:50]} - Debito:{debito} Credito:{credito}")
                
                if transacciones:
                    df_transacciones = pd.DataFrame(transacciones)
                    all_data.append(df_transacciones)
                    safe_print(f"Extraídas {len(transacciones)} transacciones de la sección DETALLE DE OPERACIONES")
                    
        except Exception as e:
            safe_print(f"Error extrayendo del texto: {e}")
            import traceback
            safe_print(traceback.format_exc())
        
        # Extraer transacciones adicionales del texto si Camelot no las detectó (últimas páginas)
        transacciones_texto = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                # Buscar en las últimas 3 páginas por si hay transacciones en texto
                for page_num in range(max(0, len(pdf.pages) - 3), len(pdf.pages)):
                    page = pdf.pages[page_num]
                    texto = page.extract_text() or ''
                    
                    # Buscar líneas con formato: fecha + descripción + débito/crédito + saldo
                    lineas = texto.split('\n')
                    for linea in lineas:
                        linea_clean = linea.strip()
                        if not linea_clean or len(linea_clean) < 10:
                            continue
                        
                        # Buscar fecha (últimos días del mes típicamente)
                        match_fecha = re.search(r'(\d{2}[/-]\d{2}[/-]\d{2,4})', linea_clean)
                        if match_fecha:
                            fecha = match_fecha.group(1).replace('-', '/')
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
                                
                                # Filtrar líneas que son solo rangos de fechas (no transacciones reales)
                                if 'PERIODO COMPRENDIDO' in descripcion.upper() or 'ENTRE EL' in descripcion.upper():
                                    continue
                                
                                # Determinar si es débito o crédito
                                debito = ''
                                credito = ''
                                if importe.startswith('-'):
                                    debito = importe
                                else:
                                    credito = importe
                                
                                # Verificar que no esté duplicada (buscar por descripción exacta y saldo)
                                es_duplicada = False
                                if all_data:
                                    for df_existente in all_data:
                                        if len(df_existente) > 0 and 'Fecha' in df_existente.columns and 'Descripcion' in df_existente.columns:
                                            # Buscar por fecha, descripción exacta Y saldo
                                            for idx_existente, row_existente in df_existente.iterrows():
                                                fecha_existente = str(row_existente.get('Fecha', '')).strip()
                                                desc_existente = str(row_existente.get('Descripcion', '')).strip()
                                                saldo_existente = str(row_existente.get('Saldo', '')).strip()
                                                
                                                # Normalizar fechas para comparar
                                                fecha_norm = fecha.replace('-', '/')
                                                fecha_exist_norm = fecha_existente.replace('-', '/')
                                                
                                                if fecha_norm == fecha_exist_norm:
                                                    # Solo marcar como duplicada si las descripciones Y los saldos son exactos
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
            if excel_path and (saldo_deudores_promedio or saldo_deudores_intereses):
                df_totales = crear_totales_galicia_mas(pd.DataFrame(), saldo_deudores_promedio, saldo_deudores_intereses)
                with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                    df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
            return pd.DataFrame()
        
        # Guardar Excel
        if excel_path:
            guardar_excel_galicia_mas(df_final, excel_path, saldo_deudores_promedio, saldo_deudores_intereses)
        
        safe_print(f"Total de registros extraídos: {len(df_final)}")
        return df_final
        
    except Exception as e:
        safe_print(f"Error extrayendo datos: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return pd.DataFrame()

def procesar_tabla_galicia_mas(df, tabla_page, tabla_order):
    """Procesar tabla de Galicia Mas manteniendo orden original"""
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

def guardar_excel_galicia_mas(df, excel_path, saldo_deudores_promedio='', saldo_deudores_intereses=''):
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
            df_totales = crear_totales_galicia_mas(df, saldo_deudores_promedio, saldo_deudores_intereses)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")
        import traceback
        safe_print(traceback.format_exc())

def crear_totales_galicia_mas(df, saldo_deudores_promedio='', saldo_deudores_intereses=''):
    """Crear resumen de totales"""
    try:
        saldo_inicial = 0
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
        
        saldo_final = saldo_inicial + total_creditos - total_debitos
        
        conceptos = ['Saldo Inicial', 'Total Débitos', 'Total Créditos', 'Saldo Final']
        valores = [
            f"${saldo_inicial:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.'),
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

def convertir_valor_a_numero(valor_str):
    """Convertir valor de texto a número"""
    try:
        if not valor_str or valor_str == 'nan':
            return 0.0
        
        # Limpiar el valor
        valor_limpio = str(valor_str).strip().replace('$', '').replace(' ', '')
        
        # Detectar si es negativo
        es_negativo = valor_limpio.startswith('-')
        if es_negativo:
            valor_limpio = valor_limpio[1:]
        
        # Formato argentino: punto para miles, coma para decimales
        # Ejemplo: "1.234,56" -> 1234.56
        if ',' in valor_limpio:
            partes = valor_limpio.split(',')
            parte_entera = partes[0].replace('.', '')
            parte_decimal = partes[1] if len(partes) > 1 else '00'
            valor_limpio = f"{parte_entera}.{parte_decimal}"
        
        valor_numero = float(valor_limpio)
        
        if es_negativo:
            valor_numero = -valor_numero
        
        return valor_numero
    except Exception as e:
        return 0.0

