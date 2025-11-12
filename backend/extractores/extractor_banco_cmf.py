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

def extraer_datos_banco_cmf(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco CMF"""
    try:
        # Verificar que el archivo existe
        if not os.path.exists(pdf_path):
            safe_print(f"ERROR: El archivo PDF no existe: {pdf_path}")
            return pd.DataFrame()
        
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Intentar con diferentes métodos de extracción
        tables = None
        
        # Método 1: Lattice (para tablas con bordes)
        try:
            safe_print("Intentando extracción con método 'lattice'...")
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
            if tables:
                safe_print(f"Lattice: Se encontraron {len(tables)} tablas")
        except Exception as e:
            safe_print(f"Error con lattice: {e}")
        
        # Método 2: Stream (si lattice falla)
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
        
        # Procesar TODAS las tablas que puedan contener movimientos
        all_data = []
        tablas_movimientos_encontradas = 0
        
        for i, table in enumerate(tables):
            try:
                df = table.df
                if df.empty or len(df) == 0:
                    continue
                    
                texto_completo = ' '.join([str(valor) for valor in df.values.flatten() if pd.notna(valor)]).lower()
                
                # Verificar si es una tabla de movimientos
                es_tabla_movimientos = any(palabra in texto_completo for palabra in ['fecha', 'movimiento', 'débito', 'crédito', 'saldo', 'concepto', 'descripción'])
                
                # Procesar todas las tablas con datos
                safe_print(f"Procesando tabla {i+1}/{len(tables)}...")
                if es_tabla_movimientos:
                    tablas_movimientos_encontradas += 1
                    safe_print(f"  Tabla {i+1} identificada como tabla de movimientos")
                
                df_procesado = procesar_tabla_cmf(df)
                if not df_procesado.empty:
                    all_data.append(df_procesado)
                    safe_print(f"  Tabla {i+1}: {len(df_procesado)} registros extraídos")
                else:
                    safe_print(f"  Tabla {i+1}: Sin datos válidos")
            except Exception as e:
                safe_print(f"  Error procesando tabla {i+1}: {e}")
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
            guardar_excel_cmf(df_final, excel_path)
        
        safe_print(f"Total de registros extraídos: {len(df_final)}")
        return df_final
        
    except Exception as e:
        safe_print(f"Error extrayendo datos: {e}")
        return pd.DataFrame()

def procesar_tabla_cmf(df):
    """Procesar tabla de CMF"""
    try:
        # Buscar la fila que contiene los encabezados
        headers_row = None
        for i, row in df.iterrows():
            contenido = str(row.iloc[0]).lower() if len(row) > 0 else ''
            contenido_completo = ' '.join([str(val) for val in row if pd.notna(val)]).lower()
            
            if any(palabra in contenido or palabra in contenido_completo for palabra in ['fecha', 'movimiento', 'concepto', 'descripción', 'débito', 'crédito', 'saldo']):
                headers_row = i
                safe_print(f"Encabezados encontrados en fila {i}")
                break
        
        if headers_row is None:
            safe_print("No se encontraron encabezados, procesando toda la tabla")
            headers_row = -1
        
        # Extraer datos
        datos_filas = []
        start_row = headers_row + 1 if headers_row != -1 else 0
        
        for i in range(start_row, len(df)):
            fila_datos = []
            for j in range(len(df.columns)):
                valor = str(df.iloc[i, j]).strip() if pd.notna(df.iloc[i, j]) else ''
                if valor and valor != 'nan':
                    fila_datos.append(valor)
            
            if len(fila_datos) >= 2:  # Mínimo 2 columnas con datos
                fila_procesada = parsear_fila_cmf(fila_datos)
                if fila_procesada:
                    datos_filas.append(fila_procesada)
        
        if datos_filas:
            df_procesado = pd.DataFrame(datos_filas)
            safe_print(f"Procesadas {len(df_procesado)} filas de movimientos")
            return df_procesado
        else:
            safe_print("No se pudieron procesar filas de datos")
            return pd.DataFrame()
        
    except Exception as e:
        safe_print(f"Error procesando tabla: {e}")
        return pd.DataFrame()

def parsear_fila_cmf(fila_datos):
    """Parsear una fila de datos de CMF"""
    try:
        if not fila_datos or len(fila_datos) < 2:
            return None
        
        # Buscar fecha en la primera posición o en cualquier parte
        fecha = ''
        for dato in fila_datos:
            if re.match(r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$', dato) or re.match(r'^\d{1,2}[/-]\d{1,2}$', dato):
                fecha = dato
                break
        
        # Buscar montos en toda la fila
        montos = []
        for dato in fila_datos:
            # Buscar números con decimales (formato argentino)
            if re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', dato):
                montos.append(dato)
            # Buscar números simples con decimales
            elif re.search(r'\d+,\d{2}', dato):
                montos.append(dato)
        
        # Reconstruir descripción (todo lo que no es fecha ni monto)
        descripcion_partes = []
        for dato in fila_datos:
            if dato != fecha and dato not in montos:
                descripcion_partes.append(dato)
        
        descripcion = ' '.join(descripcion_partes).strip()
        
        # Determinar débito y crédito
        debito = ''
        credito = ''
        saldo = ''
        
        if montos:
            # El último monto suele ser el saldo
            saldo = montos[-1] if len(montos) > 0 else ''
            
            # Clasificar movimientos basándose en la descripción
            descripcion_upper = descripcion.upper()
            
            if len(montos) >= 2:
                # Determinar si es débito o crédito por la descripción
                if any(palabra in descripcion_upper for palabra in ['TRANSFERENCIA', 'DEPOSITO', 'DEPÓSITO', 'COBRO', 'INGRESO', 'ABONO', 'CRÉDITO']):
                    # Movimientos que aumentan el saldo (créditos)
                    credito = montos[0] if montos[0] != '0,00' else ''
                elif any(palabra in descripcion_upper for palabra in ['DEBITO', 'DÉBITO', 'PAGO', 'RETIRO', 'EGRESO', 'COMISION', 'INTERES', 'IMPUESTO', 'LEY']):
                    # Movimientos que disminuyen el saldo (débitos)
                    debito = montos[0] if montos[0] != '0,00' else ''
                else:
                    # Por defecto, si no se puede determinar, asumir débito
                    debito = montos[0] if montos[0] != '0,00' else ''
            else:
                # Solo un monto, asumir débito
                debito = montos[0] if montos[0] != '0,00' else ''
        
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
        safe_print(f"Error parseando fila: {e}")
        return None

def guardar_excel_cmf(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_cmf(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
        
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")

def crear_totales_cmf(df):
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

