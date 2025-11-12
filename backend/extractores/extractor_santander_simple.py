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
        print(f"Extrayendo tablas del PDF: {pdf_path}")
        
        # Extraer tablas
        tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
        
        if not tables:
            print("No se encontraron tablas con bordes definidos, intentando con método 'stream'...")
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
        
        if not tables:
            print("No se encontraron tablas en el PDF")
            return pd.DataFrame()
        
        print(f"Se encontraron {len(tables)} tablas")
        
        # Buscar todas las tablas de movimientos
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
                tablas_movimientos.append(df)
        
        if not tablas_movimientos:
            print("No se encontraron tablas de movimientos")
            return pd.DataFrame()
        
        # Procesar todas las tablas de movimientos
        df_procesado = pd.DataFrame()
        for i, tabla in enumerate(tablas_movimientos):
            print(f"Procesando tabla de movimientos {i+1}/{len(tablas_movimientos)}")
            df_tabla = procesar_tabla_santander(tabla)
            if not df_tabla.empty:
                df_procesado = pd.concat([df_procesado, df_tabla], ignore_index=True)
        
        if df_procesado.empty:
            print("No se pudieron procesar los datos")
            return pd.DataFrame()
        
        # Guardar Excel
        if excel_path:
            guardar_excel_santander(df_procesado, excel_path)
        
        print(f"Total de registros extraídos: {len(df_procesado)}")
        return df_procesado
        
    except Exception as e:
        safe_print(f"Error extrayendo datos: {e}")
        return pd.DataFrame()

def procesar_tabla_santander(df):
    """Procesar tabla de Santander"""
    try:
        print(f"Procesando tabla con {len(df)} filas y {len(df.columns)} columnas")
        
        # Buscar la fila que contiene los encabezados
        headers_row = None
        for i, row in df.iterrows():
            contenido = str(row.iloc[0]).lower()
            if any(palabra in contenido for palabra in ['fecha', 'concepto', 'movimiento', 'debito', 'credito', 'saldo']):
                headers_row = i
                print(f"Encabezados encontrados en fila {i}")
                break
        
        if headers_row is None:
            # Si no se encuentran encabezados, intentar procesar toda la tabla
            headers_row = -1
            print("No se encontraron encabezados, procesando toda la tabla")
        
        # Extraer datos
        datos_filas = []
        start_row = headers_row + 1 if headers_row != -1 else 0
        
        print(f"Procesando filas desde {start_row} hasta {len(df)}")
        
        for i in range(start_row, len(df)):
            # Procesar cada fila
            fila_datos = []
            for j in range(len(df.columns)):
                valor = str(df.iloc[i, j]).strip()
                if valor and valor != 'nan':
                    fila_datos.append(valor)
            
            if len(fila_datos) >= 2:  # Mínimo 2 columnas con datos
                # Intentar parsear la fila
                fila_procesada = parsear_fila_santander(fila_datos)
                if fila_procesada:
                    datos_filas.append(fila_procesada)
                    safe_print(f"Fila {i} procesada correctamente")
        
        if datos_filas:
            df_procesado = pd.DataFrame(datos_filas)
            print(f"Procesadas {len(df_procesado)} filas de movimientos")
            return df_procesado
        else:
            print("No se pudieron procesar filas de datos")
            return pd.DataFrame()
        
    except Exception as e:
        safe_print(f"Error procesando tabla: {e}")
        return pd.DataFrame()

def parsear_fila_santander(fila_datos):
    """Parsear una fila de datos de Santander"""
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
            saldo = montos[-1]
            
            # Clasificar movimientos basándose en la descripción
            descripcion_upper = descripcion.upper()
            
            if len(montos) >= 2:
                # Determinar si es débito o crédito por la descripción
                if any(palabra in descripcion_upper for palabra in ['TRANSFERENCIA', 'DEPOSITO', 'COBRO', 'INGRESO', 'ABONO']):
                    # Movimientos que aumentan el saldo (créditos)
                    credito = montos[0] if montos[0] != '0,00' else ''
                elif any(palabra in descripcion_upper for palabra in ['DEBITO', 'PAGO', 'RETIRO', 'EGRESO', 'COMISION', 'INTERES', 'IMPUESTO', 'LEY']):
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
