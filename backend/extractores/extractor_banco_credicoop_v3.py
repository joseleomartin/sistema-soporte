#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Extractor para Banco Credicoop V3
Reescrito completamente para respetar la estructura real del PDF
"""

import camelot
import pandas as pd
import re
import os
import fitz # Importar PyMuPDF
import pdfplumber
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

def limpiar_monto_credicoop_v3(monto_str):
    """
    Limpia y valida un monto de manera segura.
    Preserva los datos originales y solo elimina códigos claramente identificables.
    """
    if not monto_str or not isinstance(monto_str, str):
        return "0"
    
    monto_original = monto_str.strip()
    
    # Si es solo un código como "01" o "09", devolver "0"
    if monto_original in ['01', '09', '0', '']:
        return "0"
    
    # Limpiar caracteres problemáticos pero preservar el monto
    monto_limpio = monto_original
    
    # Solo eliminar códigos claramente separados del monto
    # Patrones seguros:
    monto_limpio = re.sub(r':0[19]$', '', monto_limpio)      # ":01" o ":09" al final
    monto_limpio = re.sub(r'\(0[19]$', '', monto_limpio)    # "(01" o "(09" al final  
    monto_limpio = re.sub(r' 0[19]$', '', monto_limpio)     # " 01" o " 09" al final
    
    # Solo eliminar "01" o "09" al final si es claramente un código (muy corto)
    if len(monto_limpio) <= 3 and re.search(r'0[19]$', monto_limpio):
        monto_limpio = re.sub(r'0[19]$', '', monto_limpio)
    
    # Validar que el monto resultante sea válido
    try:
        # Intentar convertir a número para validar
        monto_num = monto_limpio.replace('.', '').replace(',', '.')
        valor = float(monto_num)
        
        # Si es un número válido, devolverlo formateado
        if valor >= 0:
            return monto_limpio
        else:
            return "0"
    except:
        # Si no se puede convertir, devolver el original si parece un monto
        if re.search(r'[\d.,]+', monto_limpio):
            return monto_limpio
        else:
            return "0"

def extraer_datos_banco_credicoop(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco Credicoop V3"""
    try:
        print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Verificar que el archivo existe
        if not os.path.exists(pdf_path):
            print(f"Error: El archivo PDF no existe: {pdf_path}")
            return pd.DataFrame()
        
        # Obtener número de páginas del PDF
        doc = fitz.open(pdf_path)
        total_paginas = len(doc)
        doc.close()
        print(f"PDF tiene {total_paginas} páginas")
        
        # Intentar con diferentes métodos de extracción
        tables = None
        
        # Método 1: Camelot con parámetros específicos para Credicoop
        print("Intentando extracción con Camelot...")
        try:
            tables = camelot.read_pdf(
                pdf_path, 
                pages='all', 
                flavor='stream',
                table_areas=None,
                columns=None,
                split_text=True,
                flag_size=True,
                edge_tol=500,
                row_tol=10
            )
            if tables:
                print(f"Camelot Stream: Se encontraron {len(tables)} tablas")
        except Exception as e:
            print(f"Error con Camelot Stream: {e}")
            tables = None
        
        # Método 2: PDFPlumber como fallback
        if not tables:
            print("Camelot no encontró tablas, intentando con PDFPlumber...")
            try:
                tables = extraer_con_pdfplumber_fallback(pdf_path)
                if tables:
                    print(f"PDFPlumber: Se encontraron {len(tables)} tablas")
            except Exception as e:
                print(f"Error con PDFPlumber: {e}")
                tables = None
        
        if not tables:
            print("No se encontraron tablas en el PDF")
            return pd.DataFrame()
        
        print(f"Total de tablas encontradas: {len(tables)}")
        
        # Procesar todas las tablas encontradas
        print("Procesando todas las tablas encontradas...")
        all_data = []
        
        for i, table in enumerate(tables):
            print(f"Procesando tabla {i+1}/{len(tables)}...")
            
            # Mostrar información de la tabla
            print(f"  Tabla {i+1}: {len(table.df)} filas, {len(table.df.columns)} columnas")
            
            # Procesar la tabla
            df_procesado = procesar_tabla_credicoop_v3(table.df)
            if not df_procesado.empty:
                all_data.append(df_procesado)
                print(f"  Tabla {i+1}: {len(df_procesado)} registros extraídos")
            else:
                print(f"  Tabla {i+1}: Sin datos válidos")
            
            # Mostrar progreso cada 5 tablas
            if (i + 1) % 5 == 0:
                porcentaje = ((i + 1) / len(tables)) * 100
                total_registros = sum(len(df) for df in all_data)
                print(f"   PROGRESO: {i+1}/{len(tables)} tablas ({porcentaje:.1f}%) - {len(all_data)} tablas con datos - {total_registros} registros totales")
        
        if all_data:
            df_final = pd.concat(all_data, ignore_index=True)
            print(f"TODAS las tablas procesadas: {len(all_data)} tablas con datos")
        else:
            print("No se pudieron procesar los datos de ninguna tabla")
            return pd.DataFrame()
        
        if df_final.empty:
            print("No se pudieron procesar los datos")
            return pd.DataFrame()
        
        # Guardar Excel
        if excel_path:
            try:
                # Verificar que el directorio existe
                excel_dir = os.path.dirname(excel_path)
                if excel_dir and not os.path.exists(excel_dir):
                    os.makedirs(excel_dir, exist_ok=True)
                
                guardar_excel_credicoop_v3(df_final, excel_path)
                print(f"Excel guardado exitosamente en: {excel_path}")
            except Exception as e:
                print(f"Error guardando Excel: {e}")
                # Intentar con un nombre de archivo más simple
                try:
                    simple_path = excel_path.replace('\\', '_').replace('/', '_')
                    guardar_excel_credicoop_v3(df_final, simple_path)
                    print(f"Excel guardado con nombre alternativo: {simple_path}")
                except Exception as e2:
                    print(f"Error guardando Excel con nombre alternativo: {e2}")
        
        print(f"=== RESUMEN FINAL ===")
        print(f"Total de tablas encontradas: {len(tables) if tables else 0}")
        print(f"Total de tablas con transacciones procesadas: {len(all_data)}")
        print(f"Total de registros extraídos: {len(df_final)}")
        if len(all_data) > 0:
            print(f"Promedio de registros por tabla de transacciones: {len(df_final)/len(all_data):.1f}")
        print(f"=====================")
        return df_final
        
    except Exception as e:
        print(f"Error extrayendo datos: {e}")
        return pd.DataFrame()

def procesar_tabla_credicoop_v3(df):
    """Procesar tabla de Credicoop V3 - Respeta estructura del PDF"""
    try:
        print(f"Procesando tabla con {len(df)} filas y {len(df.columns)} columnas")
        
        # Mostrar estructura de la tabla
        print("=== ESTRUCTURA DE LA TABLA ===")
        for i, row in df.iterrows():
            try:
                fila_datos = []
                for cell in row:
                    if pd.notna(cell) and str(cell).strip() != 'nan':
                        # Limpiar caracteres problemáticos
                        cell_str = str(cell).strip()
                        cell_str = cell_str.replace('\u2212', '-')
                        cell_str = cell_str.replace('\u2013', '-')
                        cell_str = cell_str.replace('\u2014', '-')
                        cell_str = cell_str.replace('\u00a0', ' ')
                        fila_datos.append(cell_str)
                print(f"Fila {i}: {fila_datos}")
            except Exception as e:
                print(f"Fila {i}: Error mostrando datos - {e}")
        print("=====================================")
        
        # Procesar todas las filas de la tabla
        datos_filas = []
        
        for i in range(len(df)):
            fila = df.iloc[i]
            
            # Verificar que la fila tenga datos válidos
            fila_datos = []
            for cell in fila:
                if pd.notna(cell) and str(cell).strip() != 'nan':
                    # Limpiar caracteres problemáticos
                    cell_str = str(cell).strip()
                    cell_str = cell_str.replace('\u2212', '-')
                    cell_str = cell_str.replace('\u2013', '-')
                    cell_str = cell_str.replace('\u2014', '-')
                    cell_str = cell_str.replace('\u00a0', ' ')
                    fila_datos.append(cell_str)
            
            if len(fila_datos) >= 1:
                # Intentar procesar la fila
                fila_procesada = parsear_fila_credicoop_v3(fila_datos)
                if fila_procesada:
                    datos_filas.append(fila_procesada)
                    print(f"Fila {i} procesada: {fila_procesada}")
                else:
                    print(f"Fila {i} NO procesada: {fila_datos}")
        
        if datos_filas:
            df_procesado = pd.DataFrame(datos_filas)
            print(f"Procesadas {len(df_procesado)} filas de movimientos")
            return df_procesado
        
        return pd.DataFrame()
        
    except Exception as e:
        print(f"Error procesando tabla: {e}")
        return pd.DataFrame()

def detectar_saldo_anterior(texto_completo):
    """
    Detecta específicamente el SALDO ANTERIOR con múltiples patrones
    """
    texto_upper = texto_completo.upper()
    
    if 'SALDO ANTERIOR' not in texto_upper:
        return None
    
    # Patrones específicos para Credicoop
    patrones_saldo = [
        # Patrón 1: SALDO ANTERIOR seguido de número
        r'SALDO ANTERIOR\s*:?\s*([\d.,]+)',
        # Patrón 2: SALDO ANTERIOR con formato específico
        r'SALDO ANTERIOR.*?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)',
        # Patrón 3: Cualquier número después de SALDO ANTERIOR
        r'SALDO ANTERIOR.*?(\d+)',
        # Patrón 4: Número antes de SALDO ANTERIOR
        r'([\d.,]+).*?SALDO ANTERIOR'
    ]
    
    for patron in patrones_saldo:
        match = re.search(patron, texto_completo, re.IGNORECASE)
        if match:
            saldo = match.group(1)
            safe_print(f"OK SALDO ANTERIOR detectado con patrón '{patron}': {saldo}")
            return {
                'Fecha': '',
                'Origen': '',
                'Descripcion': 'SALDO ANTERIOR',
                'Debito': '',
                'Credito': '',
                'Saldo': saldo,
                'Movimiento': ''
            }
    
    return None

def parsear_fila_credicoop_v3(fila_datos):
    """Parsear una fila de datos de Credicoop V3 - Respeta estructura del PDF"""
    try:
        if not fila_datos or len(fila_datos) == 0:
            return None
        
        # Unir todos los datos en una sola cadena para análisis
        texto_completo = ' '.join(fila_datos)
        
        # Log para debugging (solo si hay datos interesantes)
        if re.search(r'\d{2}/\d{2}/\d{2}', texto_completo) or re.search(r'[\d.,]+', texto_completo):
            print(f"Procesando fila: {texto_completo[:100]}...")
        
        # Buscar patrones específicos de Credicoop
        
        # 1. SALDO ANTERIOR - PRIORIDAD MÁXIMA
        saldo_anterior = detectar_saldo_anterior(texto_completo)
        if saldo_anterior:
            return saldo_anterior
        
        # 2. TRANSACCIONES CON ESTRUCTURA COMPLETA DEL PDF
        # Patrón: DD/MM/YY COMBTE DESCRIPCION DEBITO CREDITO SALDO
        # Buscar múltiples montos en la línea para separar débitos y créditos
        
        # Primero buscar fecha y COMBTE
        fecha_combte_match = re.search(r'(\d{2}/\d{2}/\d{2})\s+(\d+)', texto_completo)
        if fecha_combte_match:
            fecha = fecha_combte_match.group(1)
            combte = fecha_combte_match.group(2)
            
            # Buscar todos los montos en la línea
            montos = re.findall(r'([\d.,]+)', texto_completo)
            
            # Filtrar montos válidos (excluir fechas, COMBTE, etc.)
            montos_validos = []
            for monto in montos:
                # Verificar que sea un monto válido (no fecha, no COMBTE)
                if not re.match(r'\d{2}/\d{2}/\d{2}', monto) and not re.match(r'^\d{6,8}$', monto):
                    # Convertir a número para validar
                    try:
                        monto_limpio = monto.replace('.', '').replace(',', '.')
                        valor = float(monto_limpio)
                        if 0.01 <= valor <= 100000000:  # Rango razonable para montos
                            montos_validos.append(monto)
                    except:
                        pass
            
            if len(montos_validos) >= 2:
                # Extraer descripción (entre COMBTE y el primer monto)
                descripcion_match = re.search(rf'{combte}\s+(.+?)\s+{montos_validos[0]}', texto_completo)
                if descripcion_match:
                    descripcion = descripcion_match.group(1).strip()
                else:
                    descripcion = texto_completo.split(combte)[1].split(montos_validos[0])[0].strip()
                
                # Clasificar montos basado en la descripción
                descripcion_lower = descripcion.lower()
                
                # Palabras clave para DÉBITOS
                palabras_debito = [
                    'recaudacion', 'recaudación', 'sircreb', 'comision', 'comisión', 
                    'cargo', 'impuesto', 'iva', 'intereses', 'echeq', 'camara',
                    'pago', 'debito', 'débito', 'cheque', 'transferencia enviada',
                    'retiro', 'extraccion', 'extracción', 'consumo', 'compra'
                ]
                
                # Palabras clave para CRÉDITOS  
                palabras_credito = [
                    'tii', 'pago ct pei', 'dist tit', 'credito', 'crédito', 
                    'transferencia recibida', 'cobranza', 'deposito', 'depósito', 
                    'ingreso', 'abono', 'transferencia', 'haberes', 'sueldo', 'jubilacion'
                ]
                
                debito = ''
                credito = ''
                
                # Analizar el texto completo para determinar si es débito o crédito
                texto_completo_lower = texto_completo.lower()
                
                # Separar montos por tamaño
                montos_pequeños = []
                montos_grandes = []
                
                for monto in montos_validos:
                    try:
                        # Usar la función segura de limpieza de montos
                        monto_limpio = limpiar_monto_credicoop_v3(monto)
                        
                        valor = float(monto_limpio.replace('.', '').replace(',', '.'))
                        if valor < 1000:
                            montos_pequeños.append(monto_limpio)
                        else:
                            montos_grandes.append(monto_limpio)
                    except:
                        pass
                
                # Clasificar según el contenido del texto
                if any(palabra in texto_completo_lower for palabra in palabras_debito):
                    # Es un débito - montos pequeños van a débito
                    if montos_pequeños:
                        debito = montos_pequeños[0]
                    if montos_grandes:
                        credito = montos_grandes[0]
                elif any(palabra in texto_completo_lower for palabra in palabras_credito):
                    # Es un crédito - montos grandes van a crédito
                    if montos_grandes:
                        credito = montos_grandes[0]
                    if montos_pequeños:
                        debito = montos_pequeños[0]
                else:
                    # Por defecto: monto pequeño como débito, grande como crédito
                    if montos_pequeños:
                        debito = montos_pequeños[0]
                    if montos_grandes:
                        credito = montos_grandes[0]
                
                return {
                    'Fecha': fecha,
                    'Origen': combte,
                    'Descripcion': descripcion,
                    'Debito': debito,
                    'Credito': credito,
                    'Saldo': '',
                    'Movimiento': ''
                }
        
        # 3. TRANSACCIONES SIN COMBTE (solo fecha y descripción)
        # Patrón: DD/MM/YY DESCRIPCION DEBITO/CREDITO
        transaccion_sin_combte = re.search(r'(\d{2}/\d{2}/\d{2})\s+(.+?)\s+([\d.,]+)', texto_completo)
        if transaccion_sin_combte:
            fecha = transaccion_sin_combte.group(1)
            descripcion = transaccion_sin_combte.group(2).strip()
            monto = transaccion_sin_combte.group(3)
            
            # Usar la función segura de limpieza de montos
            monto_limpio = limpiar_monto_credicoop_v3(monto)
            
            # Determinar si es débito o crédito basado en la descripción
            descripcion_lower = descripcion.lower()
            
            # Palabras clave para DÉBITOS
            palabras_debito = [
                'recaudacion', 'recaudación', 'sircreb', 'comision', 'comisión', 
                'cargo', 'impuesto', 'iva', 'intereses', 'echeq', 'camara',
                'pago', 'debito', 'débito', 'cheque', 'transferencia enviada',
                'retiro', 'extraccion', 'extracción', 'consumo', 'compra'
            ]
            
            # Palabras clave para CRÉDITOS  
            palabras_credito = [
                'tii', 'pago ct pei', 'dist tit', 'credito', 'crédito', 
                'transferencia recibida', 'cobranza', 'deposito', 'depósito', 
                'ingreso', 'abono', 'transferencia', 'haberes', 'sueldo', 'jubilacion'
            ]
            
            debito = ''
            credito = ''
            
            if any(palabra in descripcion_lower for palabra in palabras_debito):
                debito = monto_limpio
            elif any(palabra in descripcion_lower for palabra in palabras_credito):
                credito = monto_limpio
            else:
                # Por defecto como débito
                debito = monto_limpio
            
            return {
                'Fecha': fecha,
                'Origen': '',
                'Descripcion': descripcion,
                'Debito': debito,
                'Credito': credito,
                'Saldo': '',
                'Movimiento': ''
            }
        
        # 4. LÍNEAS DE CONTINUACIÓN (sin fecha, solo descripción adicional)
        # Patrón: CUIT-PCT-NOMBRE o similar
        continuacion_match = re.search(r'(\d{8,11})-PCT-(.+)', texto_completo)
        if continuacion_match:
            cuit = continuacion_match.group(1)
            nombre = continuacion_match.group(2).strip()
            
            return {
                'Fecha': '',
                'Origen': cuit,
                'Descripcion': f"PCT-{nombre}",
                'Debito': '',
                'Credito': '',
                'Saldo': '',
                'Movimiento': ''
            }
        
        # 5. FILTRAR METADATA Y PÁGINAS
        # Ignorar líneas que contengan metadata del PDF
        metadata_patterns = [
            r'PAGINA\s+\d+/\d+',
            r'>>>>>>\s+VIENE\s+DE\s+PAGINA',
            r'CONTINUA\s+EN\s+PAGINA\s+SIGUIENTE',
            r'Banco\s+Credicoop\s+Cooperativo',
            r'Calidad\s+de\s+Servicios',
            r'TRANSFERENCIAS\s+PESOS',
            r'Debito\s+directo\s+-\s+CBU',
            r'YAPAY\s+NEASA\s+SRL',
            r'<s>.*?</s>',
            r'<.*?>',
            r'^[_\s]+$'  # Líneas solo con guiones y espacios
        ]
        
        for pattern in metadata_patterns:
            if re.search(pattern, texto_completo, re.IGNORECASE):
                return None
        
        # Si no coincide con ningún patrón conocido, ignorar
        return None
        
    except Exception as e:
        print(f"Error parseando fila: {e}")
        return None

def extraer_con_pdfplumber_fallback(pdf_path):
    """Extraer tablas con PDFPlumber como fallback"""
    try:
        tables = []
        
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                print(f"Procesando página {page_num + 1} con PDFPlumber...")
                
                # Extraer tablas de la página
                page_tables = page.extract_tables()
                
                for table_num, table in enumerate(page_tables):
                    if table and len(table) > 0:
                        # Convertir a DataFrame
                        df = pd.DataFrame(table[1:], columns=table[0] if table[0] else None)
                        
                        # Crear objeto MockTable para compatibilidad
                        class MockTable:
                            def __init__(self, df):
                                self.df = df
                        
                        tables.append(MockTable(df))
                        print(f"  Tabla {len(tables)} extraída de página {page_num + 1}")
        
        return tables
        
    except Exception as e:
        print(f"Error con PDFPlumber: {e}")
        return None

def guardar_excel_credicoop_v3(df, excel_path):
    """Guardar Excel con formato específico para Credicoop V3"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # Hoja principal con transacciones
            df.to_excel(writer, sheet_name='Transacciones Credicoop', index=False)
            
            # Hoja de totales
            totales_df = crear_totales_credicoop_v3(df)
            totales_df.to_excel(writer, sheet_name='Totales', index=False)
            
            # Ajustar columnas
            worksheet = writer.sheets['Transacciones Credicoop']
            column_widths = {
                'A': 15,  # Fecha
                'B': 15,  # Origen
                'C': 50,  # Descripción
                'D': 15,  # Débito
                'E': 15,  # Crédito
                'F': 15,  # Saldo
                'G': 15   # Movimiento
            }
            
            for col, width in column_widths.items():
                if col in worksheet.column_dimensions:
                    worksheet.column_dimensions[col].width = width
        
        print(f"Excel guardado: {excel_path}")
        
    except Exception as e:
        print(f"Error guardando Excel: {e}")

def crear_totales_credicoop_v3(df):
    """Crear hoja de totales para Credicoop V3"""
    try:
        # Calcular totales
        saldo_inicial = 0.0
        total_debitos = 0.0
        total_creditos = 0.0
        
        # Buscar saldo inicial
        saldo_anterior = df[df['Descripcion'] == 'SALDO ANTERIOR']
        if not saldo_anterior.empty and saldo_anterior.iloc[0]['Saldo']:
            try:
                saldo_str = str(saldo_anterior.iloc[0]['Saldo']).replace('.', '').replace(',', '.')
                saldo_inicial = float(saldo_str)
            except:
                saldo_inicial = 0.0
        
        # Calcular totales de débitos y créditos
        for _, row in df.iterrows():
            if row['Debito'] and str(row['Debito']).strip():
                try:
                    debito_str = str(row['Debito']).replace('.', '').replace(',', '.')
                    total_debitos += float(debito_str)
                except:
                    pass
            
            if row['Credito'] and str(row['Credito']).strip():
                try:
                    credito_str = str(row['Credito']).replace('.', '').replace(',', '.')
                    total_creditos += float(credito_str)
                except:
                    pass
        
        saldo_final = saldo_inicial + total_creditos - total_debitos
        
        # Crear DataFrame de totales
        totales_data = {
            'Concepto': ['Saldo Inicial', 'Total Débitos', 'Total Créditos', 'Saldo Final'],
            'Importe': [f"${saldo_inicial:,.2f}", f"${total_debitos:,.2f}", f"${total_creditos:,.2f}", f"${saldo_final:,.2f}"]
        }
        
        totales_df = pd.DataFrame(totales_data)
        
        print(f"Balance: Saldo Inicial: ${saldo_inicial:,.2f}, Débitos: ${total_debitos:,.2f}, Créditos: ${total_creditos:,.2f}, Saldo Final: ${saldo_final:,.2f}")
        
        return totales_df
        
    except Exception as e:
        print(f"Error creando totales: {e}")
        return pd.DataFrame({'Concepto': ['Error'], 'Importe': ['Error calculando totales']})
