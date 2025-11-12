#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pdfplumber
import pandas as pd
import re
import os

def extraer_datos_banco_macro(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco Macro usando pdfplumber"""
    try:
        print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Extraer texto de todas las páginas
        texto_completo = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                texto_pagina = page.extract_text()
                if texto_pagina:
                    texto_completo += texto_pagina + "\n"
        
        if not texto_completo:
            print("No se pudo extraer texto del PDF")
            return pd.DataFrame()
        
        # Procesar el texto para extraer movimientos
        movimientos = procesar_texto_banco_macro(texto_completo)
        
        if not movimientos:
            print("No se encontraron movimientos en el PDF")
            return pd.DataFrame()
        
        # Crear DataFrame
        df_movimientos = pd.DataFrame(movimientos)
        
        # Guardar Excel
        if excel_path:
            guardar_excel_banco_macro(df_movimientos, excel_path)
        
        print(f"Total de registros extraídos: {len(df_movimientos)}")
        return df_movimientos
        
    except Exception as e:
        print(f"Error extrayendo datos: {e}")
        return pd.DataFrame()

def procesar_texto_banco_macro(texto):
    """Procesar texto de Banco Macro para extraer movimientos"""
    try:
        movimientos = []
        
        # Buscar todas las secciones de movimientos
        # Patrón: "DETALLE DE MOVIMIENTO" seguido de los datos
        secciones_movimientos = re.findall(
            r'DETALLE DE MOVIMIENTO.*?(?=DETALLE DE MOVIMIENTO|SALDO FINAL|TOTAL COBRADO|$)', 
            texto, 
            re.DOTALL | re.IGNORECASE
        )
        
        for seccion in secciones_movimientos:
            # Extraer movimientos de esta sección
            movimientos_seccion = extraer_movimientos_de_seccion(seccion)
            movimientos.extend(movimientos_seccion)
        
        return movimientos
        
    except Exception as e:
        print(f"Error procesando texto: {e}")
        return []

def extraer_movimientos_de_seccion(seccion):
    """Extraer movimientos de una sección específica"""
    try:
        movimientos = []
        lineas = seccion.split('\n')
        
        # Buscar la línea de encabezados
        headers_line = None
        for i, linea in enumerate(lineas):
            if 'FECHA' in linea and 'DESCRIPCION' in linea and 'DEBITOS' in linea:
                headers_line = i
                break
        
        if headers_line is None:
            return movimientos
        
        # Procesar líneas después de los encabezados
        for i in range(headers_line + 1, len(lineas)):
            linea = lineas[i].strip()
            
            # Saltar líneas vacías o que no contengan datos de movimientos
            if not linea or len(linea) < 10:
                continue
            
            # Saltar líneas que son saldos o totales
            if any(palabra in linea.upper() for palabra in ['SALDO ULTIMO', 'SALDO FINAL', 'TOTAL COBRADO']):
                continue
            
            # Parsear la línea de movimiento
            movimiento = parsear_linea_movimiento_macro(linea)
            if movimiento:
                movimientos.append(movimiento)
        
        return movimientos
        
    except Exception as e:
        print(f"Error extrayendo movimientos de sección: {e}")
        return []

def parsear_linea_movimiento_macro(linea):
    """Parsear una línea de movimiento de Banco Macro"""
    try:
        # Patrón para líneas de movimiento: FECHA DESCRIPCION REFERENCIA DEBITOS CREDITOS SALDO
        # Ejemplo: "01/09/25 N/D DBCR 25413 S/DB TASA GRAL 0 369,77 0,00"
        
        # Buscar fecha al inicio
        fecha_match = re.match(r'(\d{1,2}/\d{1,2}/\d{2,4})', linea)
        if not fecha_match:
            return None
        
        fecha = fecha_match.group(1)
        
        # Buscar todos los montos con decimales (excluyendo la fecha)
        montos = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', linea)
        
        # Buscar números individuales (para referencia)
        numeros_individuales = re.findall(r'\b\d+\b', linea)
        
        # Extraer descripción (todo entre la fecha y los montos/números)
        resto_linea = linea[len(fecha):].strip()
        
        # Remover montos de la descripción
        for monto in montos:
            resto_linea = resto_linea.replace(monto, '').strip()
        
        # Remover números de referencia
        for numero in numeros_individuales:
            if numero not in fecha and numero != '0':  # No remover la fecha ni el 0 de referencia
                resto_linea = resto_linea.replace(numero, '').strip()
        
        # Limpiar descripción
        descripcion = ' '.join(resto_linea.split())
        
        # Determinar débito, crédito y saldo
        debito = ''
        credito = ''
        saldo = ''
        
        if len(montos) >= 2:
            # El formato es: FECHA DESCRIPCION REFERENCIA MONTO SALDO
            # Los últimos 2 montos son: MONTO (débito/crédito) y SALDO
            saldo = montos[-1]
            # Determinar si el primer monto es débito o crédito por la descripción
            descripcion_upper = descripcion.upper()
            
            # Clasificación precisa basada en el formato de Banco Macro
            if 'N/D' in descripcion_upper or 'DEBITO' in descripcion_upper:
                # N/D = Débito (movimiento que resta del saldo)
                debito = montos[0] if montos[0] != '0,00' else ''
            elif 'N/C' in descripcion_upper:
                # N/C = Crédito (movimiento que suma al saldo)
                credito = montos[0] if montos[0] != '0,00' else ''
            else:
                # Por defecto, si no se puede determinar, asumir débito
                debito = montos[0] if montos[0] != '0,00' else ''
        elif len(montos) == 1:
            # Solo un monto, podría ser débito o crédito
            saldo = montos[0]
            # Determinar si es débito o crédito por la descripción
            descripcion_upper = descripcion.upper()
            
            # Clasificación precisa basada en el formato de Banco Macro
            if 'N/D' in descripcion_upper or 'DEBITO' in descripcion_upper:
                # N/D = Débito (movimiento que resta del saldo)
                debito = montos[0] if montos[0] != '0,00' else ''
            elif 'N/C' in descripcion_upper:
                # N/C = Crédito (movimiento que suma al saldo)
                credito = montos[0] if montos[0] != '0,00' else ''
            else:
                # Por defecto, si no se puede determinar, asumir débito
                debito = montos[0] if montos[0] != '0,00' else ''
        
        # Crear movimiento
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
        print(f"Error parseando línea: {e}")
        return None

def guardar_excel_banco_macro(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_banco_macro(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        print(f"Excel guardado: {excel_path}")
        
    except Exception as e:
        print(f"Error guardando Excel: {e}")

def crear_totales_banco_macro(df):
    """Crear totales por concepto"""
    try:
        saldo_inicial = 0
        total_debitos = 0
        total_creditos = 0
        
        # Buscar saldo inicial - tomar el primer saldo válido (puede ser negativo)
        for _, row in df.iterrows():
            saldo_valor = row.get('Saldo', '')
            if saldo_valor and str(saldo_valor).strip() != '':
                monto = extraer_monto_de_texto(str(saldo_valor))
                if monto is not None:  # No restringir a monto > 0
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
        
        print(f"📊 Balance: Saldo Inicial: ${saldo_inicial:,.2f}, Débitos: ${total_debitos:,.2f}, Créditos: ${total_creditos:,.2f}, Saldo Final: ${saldo_final:,.2f}")
        return df_totales
        
    except Exception as e:
        print(f"Error creando totales: {e}")
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