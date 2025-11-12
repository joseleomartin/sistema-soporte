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

def extraer_datos_banco_bind(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco BIND"""
    try:
        if not os.path.exists(pdf_path):
            safe_print(f"ERROR: El archivo PDF no existe: {pdf_path}")
            return pd.DataFrame()
        
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Usar pdfplumber para extraer texto directamente
        transacciones = extraer_con_pdfplumber_bind(pdf_path)
        
        if not transacciones:
            safe_print("No se encontraron transacciones en el PDF")
            if excel_path:
                guardar_excel_bind(pd.DataFrame(), excel_path)
            return pd.DataFrame()
        
        df_final = pd.DataFrame(transacciones)
        safe_print(f"Total de transacciones extraídas: {len(df_final)}")
        
        # Guardar Excel
        if excel_path:
            guardar_excel_bind(df_final, excel_path)
        
        return df_final
        
    except Exception as e:
        safe_print(f"Error extrayendo datos: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return pd.DataFrame()

def extraer_con_pdfplumber_bind(pdf_path):
    """Extraer transacciones usando pdfplumber"""
    try:
        transacciones = []
        saldo_inicial = None
        
        with pdfplumber.open(pdf_path) as pdf:
            # Primero buscar el saldo inicial en la primera página
            if len(pdf.pages) > 0:
                texto_primera = pdf.pages[0].extract_text() or ''
                match_saldo = re.search(r'SALDO INICIAL\s+([\d.,]+)', texto_primera)
                if match_saldo:
                    saldo_inicial = match_saldo.group(1)
            
            # Procesar todas las páginas
            for page_num, page in enumerate(pdf.pages):
                texto = page.extract_text() or ''
                lineas = texto.split('\n')
                
                # Buscar sección de movimientos en cada página
                en_seccion_movimientos = False
                
                for i, linea in enumerate(lineas):
                    linea_clean = linea.strip()
                    
                    # Detectar inicio de movimientos (puede aparecer en cualquier página)
                    if 'FECHA DETALLE REFERENCIA DEBITOS CREDITOS SALDO' in linea_clean:
                        en_seccion_movimientos = True
                        continue
                    
                    # Detectar fin de sección (nueva página o resumen)
                    if ('Página' in linea_clean and ('/' in linea_clean or 'de' in linea_clean)) or \
                       ('SALDO INICIAL' in linea_clean and page_num > 0):
                        en_seccion_movimientos = False
                        continue
                    
                    # Procesar transacciones - detectar por patrón de fecha o si estamos en sección de movimientos
                    es_transaccion = False
                    if en_seccion_movimientos and linea_clean:
                        es_transaccion = True
                    elif re.match(r'^\d{1,2}/\d{1,2}/\d{2,4}\s+', linea_clean):
                        # También detectar transacciones por patrón de fecha al inicio de línea
                        es_transaccion = True
                    
                    if es_transaccion and linea_clean:
                        # Patrón para transacciones con referencia: fecha descripción referencia importe saldo
                        # Ejemplo: "6/08/25 Transf. Proveedores Datanet 0265251 109,782.15 10,334,804.52"
                        match_transaccion_ref = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)', linea_clean)
                        
                        if match_transaccion_ref:
                            fecha_str = match_transaccion_ref.group(1)
                            detalle = match_transaccion_ref.group(2).strip()
                            referencia = match_transaccion_ref.group(3)
                            importe = match_transaccion_ref.group(4)  # Este es el importe real
                            saldo = match_transaccion_ref.group(5)
                            
                            # Convertir fecha
                            fecha = convertir_fecha_bind(fecha_str)
                            
                            # Determinar si es débito o crédito basándose en el contexto
                            es_credito = any(palabra in detalle.lower() for palabra in [
                                'transferencia credito', 'credito', 'ingreso', 'deposito', 'acredit'
                            ])
                            
                            if es_credito:
                                transacciones.append({
                                    'Fecha': fecha,
                                    'Descripcion': detalle,
                                    'Debito': '',
                                    'Credito': importe,
                                    'Saldo': saldo,
                                    'Importe': referencia
                                })
                            else:
                                transacciones.append({
                                    'Fecha': fecha,
                                    'Descripcion': detalle,
                                    'Debito': importe,
                                    'Credito': '',
                                    'Saldo': saldo,
                                    'Importe': referencia
                                })
                        else:
                            # Patrón para transacciones SIN referencia: fecha descripción importe saldo
                            # Ejemplo: "1/08/25 Comis. Mantenimiento de Cuenta 61,696.04 10,239,886.80"
                            match_transaccion = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)', linea_clean)
                            
                            if match_transaccion:
                                fecha_str = match_transaccion.group(1)
                                detalle_con_importe = match_transaccion.group(2).strip()
                                importe = match_transaccion.group(3)  # Este es el importe real (no el saldo)
                                saldo = match_transaccion.group(4)
                                
                                # Convertir fecha
                                fecha = convertir_fecha_bind(fecha_str)
                                
                                # Remover el importe de la descripción si está presente
                                # La descripción puede tener el importe al final o no tenerlo
                                detalle_sin_importe = re.sub(r'\s+' + re.escape(importe) + r'\s*$', '', detalle_con_importe).strip()
                                # Si no se removió nada, significa que el importe no estaba en la descripción
                                if detalle_sin_importe == detalle_con_importe:
                                    detalle_sin_importe = detalle_con_importe
                                
                                # Determinar si es débito o crédito basándose en el contexto
                                es_credito = any(palabra in detalle_sin_importe.lower() for palabra in [
                                    'transferencia credito', 'credito', 'ingreso', 'deposito', 'acredit'
                                ])
                                
                                if es_credito:
                                    transacciones.append({
                                        'Fecha': fecha,
                                        'Descripcion': detalle_sin_importe,
                                        'Debito': '',
                                        'Credito': importe,
                                        'Saldo': saldo,
                                        'Importe': ''
                                    })
                                else:
                                    transacciones.append({
                                        'Fecha': fecha,
                                        'Descripcion': detalle_sin_importe,
                                        'Debito': importe,
                                        'Credito': '',
                                        'Saldo': saldo,
                                        'Importe': ''
                                    })
        
        return transacciones
        
    except Exception as e:
        safe_print(f"Error extrayendo con pdfplumber: {e}")
        return []

def convertir_fecha_bind(fecha_str):
    """Convertir fecha de formato DD/MM/YY a DD/MM/YYYY"""
    try:
        partes = fecha_str.split('/')
        if len(partes) == 3:
            dia, mes, año = partes
            # Asumir años 20xx si es menor a 50, 19xx si es mayor
            if len(año) == 2:
                año_int = int(año)
                if año_int < 50:
                    año = f"20{año}"
                else:
                    año = f"19{año}"
            return f"{dia}/{mes}/{año}"
        return fecha_str
    except Exception:
        return fecha_str

def guardar_excel_bind(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_bind(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")

def crear_totales_bind(df):
    """Crear totales por concepto"""
    try:
        saldo_inicial = 0
        total_debitos = 0
        total_creditos = 0
        
        # Sumar débitos y créditos
        for _, row in df.iterrows():
            debito_valor = str(row.get('Debito', '')).strip()
            if debito_valor and debito_valor != 'nan' and debito_valor != '':
                monto = convertir_valor_a_numero_bind(debito_valor)
                if monto is not None:
                    total_debitos += monto
            
            credito_valor = str(row.get('Credito', '')).strip()
            if credito_valor and credito_valor != 'nan' and credito_valor != '':
                monto = convertir_valor_a_numero_bind(credito_valor)
                if monto is not None:
                    total_creditos += monto
        
        # Buscar saldo inicial (primera fila con saldo)
        for _, row in df.iterrows():
            saldo_valor = str(row.get('Saldo', '')).strip()
            if saldo_valor and saldo_valor != 'nan' and saldo_valor != '':
                monto = convertir_valor_a_numero_bind(saldo_valor)
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

def convertir_valor_a_numero_bind(valor_str):
    """Convertir valor de texto a número - maneja formatos americano y argentino"""
    try:
        if not valor_str or valor_str == 'nan':
            return None
        
        # Limpiar el valor
        valor_limpio = str(valor_str).strip().replace('$', '').replace(' ', '')
        
        # Detectar formato basado en la posición de comas y puntos
        if ',' in valor_limpio and '.' in valor_limpio:
            # Determinar si es formato americano o argentino
            ultima_coma = valor_limpio.rfind(',')
            ultimo_punto = valor_limpio.rfind('.')
            
            if ultima_coma > ultimo_punto:
                # Formato argentino: "10.239.886,80" -> 10239886.80
                partes = valor_limpio.split(',')
                parte_entera = partes[0].replace('.', '')
                parte_decimal = partes[1] if len(partes) > 1 else '00'
                valor_limpio = f"{parte_entera}.{parte_decimal}"
            else:
                # Formato americano: "10,239,886.80" -> 10239886.80
                valor_limpio = valor_limpio.replace(',', '')
        elif ',' in valor_limpio:
            # Solo coma - verificar si es decimal o miles
            partes = valor_limpio.split(',')
            if len(partes) == 2 and len(partes[1]) <= 2:
                # Formato argentino: "10239886,80" -> 10239886.80
                parte_entera = partes[0].replace('.', '')
                parte_decimal = partes[1]
                valor_limpio = f"{parte_entera}.{parte_decimal}"
            else:
                # Formato americano: "10,239,886" -> 10239886
                valor_limpio = valor_limpio.replace(',', '')
        else:
            # Solo punto - puede ser miles o decimal
            if '.' in valor_limpio:
                partes = valor_limpio.split('.')
                if len(partes) == 2 and len(partes[1]) <= 2:
                    # Formato americano: "10239886.80" -> 10239886.80
                    pass  # Ya está en formato correcto
                else:
                    # Formato argentino: "10.239.886" -> 10239886
                    valor_limpio = valor_limpio.replace('.', '')
        
        return float(valor_limpio)
    except Exception as e:
        safe_print(f"Error convirtiendo valor '{valor_str}': {e}")
        return None
