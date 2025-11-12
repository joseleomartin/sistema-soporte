#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pdfplumber
import pandas as pd
import re
import os

def extraer_datos_banco_icbc(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco ICBC usando pdfplumber"""
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
        movimientos = procesar_texto_banco_icbc(texto_completo)
        
        if not movimientos:
            print("No se encontraron movimientos en el PDF")
            return pd.DataFrame()
        
        # Crear DataFrame
        df_movimientos = pd.DataFrame(movimientos)
        
        # Guardar Excel
        if excel_path:
            guardar_excel_banco_icbc(df_movimientos, excel_path)
        
        print(f"Total de registros extraídos: {len(df_movimientos)}")
        return df_movimientos
        
    except Exception as e:
        print(f"Error extrayendo datos: {e}")
        return pd.DataFrame()

def procesar_texto_banco_icbc(texto):
    """Procesar texto de Banco ICBC para extraer movimientos"""
    try:
        movimientos = []
        
        # Buscar todas las secciones de movimientos
        # Patrón: "INFORMACION SOBRE SU CUENTA CORRIENTE" seguido de los datos
        secciones_movimientos = re.findall(
            r'INFORMACION SOBRE SU CUENTA CORRIENTE.*?(?=INFORMACION SOBRE Regional|$)', 
            texto, 
            re.DOTALL | re.IGNORECASE
        )
        
        for seccion in secciones_movimientos:
            # Extraer movimientos de esta sección
            movimientos_seccion = extraer_movimientos_de_seccion_icbc(seccion)
            movimientos.extend(movimientos_seccion)
        
        return movimientos
        
    except Exception as e:
        print(f"Error procesando texto: {e}")
        return []

def extraer_movimientos_de_seccion_icbc(seccion):
    """Extraer movimientos de una sección específica de Banco ICBC"""
    try:
        movimientos = []
        lineas = seccion.split('\n')
        
        # Buscar la línea de encabezados
        headers_line = None
        for i, linea in enumerate(lineas):
            if 'FECHA' in linea and 'CONCEPTO' in linea and 'DEBITOS' in linea:
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
            if any(palabra in linea.upper() for palabra in ['SALDO ULTIMO', 'SALDO FINAL', 'TOT.IMP.LEY', 'TOT.LEY']):
                continue
            
            # Saltar líneas de separación
            if '___' in linea or '---' in linea:
                continue
            
            # Parsear la línea de movimiento
            movimiento = parsear_linea_movimiento_icbc(linea)
            if movimiento:
                movimientos.append(movimiento)
        
        return movimientos
        
    except Exception as e:
        print(f"Error extrayendo movimientos de sección: {e}")
        return []

def parsear_linea_movimiento_icbc(linea):
    """Parsear una línea de movimiento de Banco ICBC"""
    try:
        # Patrón para líneas de movimiento: FECHA CONCEPTO F.VALOR COMPROBANTE ORIGEN CANAL DEBITOS CREDITOS SALDOS
        # Ejemplo: "01-09 MANTENIMIENTO DE CUENTA                        0501
        #           33.177,00-"
        
        # Buscar fecha al inicio (formato DD-MM)
        fecha_match = re.match(r'(\d{1,2}-\d{1,2})', linea)
        if not fecha_match:
            return None
        
        fecha = fecha_match.group(1)
        
        # Buscar todos los montos en la línea
        montos = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2}-?)', linea)
        
        # Extraer descripción (todo entre la fecha y los montos)
        resto_linea = linea[len(fecha):].strip()
        for monto in montos:
            resto_linea = resto_linea.replace(monto, '').strip()
        
        # Limpiar descripción
        descripcion = ' '.join(resto_linea.split())
        
        # Determinar débito, crédito y saldo
        debito = ''
        credito = ''
        saldo = ''
        
        if montos:
            # En Banco ICBC, el formato es diferente
            # Los montos con "-" al final son débitos
            # Los montos sin "-" son créditos o saldos
            
            for monto in montos:
                if monto.endswith('-'):
                    # Es un débito
                    debito = monto.rstrip('-')
                else:
                    # Es un crédito o saldo
                    if not credito:
                        credito = monto
                    else:
                        saldo = monto
        
        # Si solo hay un monto, determinar si es débito o crédito
        if len(montos) == 1 and not debito and not credito:
            monto = montos[0]
            if monto.endswith('-'):
                debito = monto.rstrip('-')
            else:
                # Determinar por la descripción
                descripcion_upper = descripcion.upper()
                if any(palabra in descripcion_upper for palabra in ['TRANS DN MTITU', 'DEPOSITO', 'COBRO', 'INGRESO']):
                    credito = monto
                else:
                    debito = monto
        
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

def guardar_excel_banco_icbc(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_banco_icbc(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        print(f"Excel guardado: {excel_path}")
        
    except Exception as e:
        print(f"Error guardando Excel: {e}")

def crear_totales_banco_icbc(df):
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