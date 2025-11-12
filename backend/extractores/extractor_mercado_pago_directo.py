#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Extractor directo para Mercado Pago usando pdfplumber
"""

import pdfplumber
import pandas as pd
import re
import os

def safe_print(texto):
    """Imprimir de forma segura en Windows"""
    try:
        print(texto)
    except UnicodeEncodeError:
        print(texto.encode('utf-8', errors='ignore').decode('utf-8'))

def extraer_datos_mercado_pago_directo(pdf_path, excel_path=None, max_paginas=None):
    """Función principal para extraer datos de Mercado Pago"""
    try:
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Extraer datos usando pdfplumber
        df = extraer_con_pdfplumber_mercado_pago(pdf_path)
        
        if df is None or df.empty:
            safe_print("No se encontraron datos para extraer")
            return None
        
        safe_print(f"Total de transacciones extraídas: {len(df)}")
        
        # Calcular balance
        saldo_inicial = 0
        total_debitos = df['Debito'].fillna(0).sum()
        total_creditos = df['Credito'].fillna(0).sum()
        
        # Calcular saldo final basado en el último saldo registrado
        if 'Saldo' in df.columns and not df['Saldo'].isna().all():
            saldo_final = df['Saldo'].dropna().iloc[-1] if not df['Saldo'].dropna().empty else saldo_inicial + total_creditos - total_debitos
        else:
            saldo_final = saldo_inicial + total_creditos - total_debitos
        
        safe_print(f"Balance: Saldo Inicial: ${saldo_inicial:,.2f}, Débitos: ${total_debitos:,.2f}, Créditos: ${total_creditos:,.2f}, Saldo Final: ${saldo_final:,.2f}")
        
        # Guardar Excel si se especifica
        if excel_path:
            guardar_excel_mercado_pago(df, excel_path)
        
        return df
        
    except Exception as e:
        safe_print(f"Error en extracción: {e}")
        return None

def extraer_con_pdfplumber_mercado_pago(pdf_path):
    """Extraer datos usando pdfplumber - Mercado Pago optimizado"""
    try:
        transacciones = []
        
        with pdfplumber.open(pdf_path) as pdf:
            total_paginas = len(pdf.pages)
            
            safe_print(f"PDF tiene {total_paginas} páginas, procesando todas las páginas...")
            
            for page_num in range(total_paginas):
                if page_num % 25 == 0:  # Mostrar progreso cada 25 páginas
                    safe_print(f"Procesando página {page_num + 1}/{total_paginas}...")
                
                page = pdf.pages[page_num]
                texto = page.extract_text() or ''
                lineas = texto.split('\n')
                
                # Combinar líneas que pertenecen a la misma transacción
                lineas_combinadas = []
                i = 0
                while i < len(lineas):
                    linea_actual = lineas[i].strip()
                    
                    # Si la línea tiene fecha, puede ser inicio de transacción
                    if re.search(r'\d{2}-\d{2}-\d{4}', linea_actual):
                        # Combinar con líneas siguientes hasta encontrar otra fecha o monto completo
                        linea_completa = linea_actual
                        j = i + 1
                        
                        # Buscar líneas siguientes que no tengan fecha pero puedan ser continuación
                        while j < len(lineas):
                            siguiente_linea = lineas[j].strip()
                            
                            # Si la siguiente línea tiene fecha, es una nueva transacción
                            if re.search(r'\d{2}-\d{2}-\d{4}', siguiente_linea):
                                break
                            
                            # Si la siguiente línea tiene un ID de 11 dígitos y montos, es parte de la transacción
                            if re.search(r'\d{11}', siguiente_linea) and re.search(r'\$\s*[\d.,]+', siguiente_linea):
                                linea_completa += ' ' + siguiente_linea
                                break
                            
                            # Si la siguiente línea tiene montos pero no fecha, puede ser continuación
                            if re.search(r'\$\s*[\d.,]+', siguiente_linea) and not re.search(r'\d{2}-\d{2}-\d{4}', siguiente_linea):
                                # Verificar si ya tenemos montos en la línea actual
                                montos_actuales = re.findall(r'\$\s*[\d.,]+', linea_completa)
                                if len(montos_actuales) < 2:  # Si no tenemos ambos montos (valor y saldo)
                                    linea_completa += ' ' + siguiente_linea
                                    j += 1
                                    continue
                                else:
                                    break
                            
                            # Si la línea siguiente no tiene fecha ni montos, puede ser continuación de descripción
                            if not re.search(r'\d{2}-\d{2}-\d{4}', siguiente_linea) and not re.search(r'\$\s*[\d.,]+', siguiente_linea):
                                # Solo agregar si no parece ser una nueva sección
                                if len(siguiente_linea) > 0 and not siguiente_linea.startswith('Página'):
                                    linea_completa += ' ' + siguiente_linea
                                    j += 1
                                    continue
                            
                            j += 1
                        
                        lineas_combinadas.append(linea_completa)
                        i = j
                    else:
                        # Si no tiene fecha, puede ser continuación de una transacción anterior
                        # Pero si tiene montos y ID, puede ser una transacción sin fecha explícita
                        if re.search(r'\d{11}', linea_actual) and re.search(r'\$\s*[\d.,]+', linea_actual):
                            lineas_combinadas.append(linea_actual)
                        i += 1
                
                # Procesar líneas combinadas
                for i, linea in enumerate(lineas_combinadas):
                    # Buscar patrones de transacciones de Mercado Pago
                    if re.search(r'\d{2}-\d{2}-\d{4}', linea) and re.search(r'\$\s*[\d.,]+', linea):
                        transaccion = parsear_transaccion_mercado_pago(linea)
                        if transaccion:
                            transaccion["Page"] = page_num
                            transaccion["Row"] = i
                            transacciones.append(transaccion)
                    
                    # También buscar líneas con ID de operación y montos (sin fecha explícita)
                    elif re.search(r'\d{11}', linea) and re.search(r'\$\s*[\d.,]+', linea):
                        transaccion = parsear_transaccion_mercado_pago(linea)
                        if transaccion:
                            transaccion["Page"] = page_num
                            transaccion["Row"] = i
                            transacciones.append(transaccion)
        
        if not transacciones:
            safe_print("No se encontraron transacciones")
            return None
        
        # Crear DataFrame
        df = pd.DataFrame(transacciones)
        
        # Convertir fecha a datetime para ordenamiento correcto (día primero)
        df['Fecha'] = pd.to_datetime(df['Fecha'], dayfirst=True, errors='coerce')
        
        # Ordenar por fecha y, a igual fecha, por número de página y fila
        sort_cols = [col for col in ['Fecha', 'Page', 'Row'] if col in df.columns]
        df = df.sort_values(sort_cols).drop_duplicates()
        
        # Convertir fecha de vuelta a string para compatibilidad
        df['Fecha'] = df['Fecha'].dt.strftime('%d-%m-%Y')
        
        safe_print(f"Extraídas {len(transacciones)} transacciones de {total_paginas} páginas")
        return df
        
    except Exception as e:
        safe_print(f"Error en extracción con pdfplumber: {e}")
        return None

def parsear_transaccion_mercado_pago(linea):
    """Parsear una transacción de Mercado Pago"""
    try:
        # Buscar fecha
        match_fecha = re.search(r'(\d{2}-\d{2}-\d{4})', linea)
        if not match_fecha:
            return None
        
        fecha = match_fecha.group(1)
        fecha_pos = match_fecha.start()
        
        # Buscar ID de operación (9-11 dígitos, típicamente 9 dígitos)
        # Buscar primero IDs de 9 dígitos (más común), luego 10-11 dígitos
        match_id = re.search(r'\b(\d{9,11})\b', linea)
        if not match_id:
            # Si no encuentra con word boundary, buscar sin boundary
            match_id = re.search(r'(\d{9,11})', linea)
        id_operacion = match_id.group(1) if match_id else ''
        id_pos = match_id.start() if match_id else len(linea)
        
        # Buscar montos (pueden tener signo negativo)
        montos = re.findall(r'\$\s*-?\s*([\d.,]+)', linea)
        if not montos:
            return None
        
        # El primer monto es el valor, el segundo es el saldo
        # Buscar el signo del primer monto
        match_valor_completo = re.search(r'\$\s*(-?\s*[\d.,]+)', linea)
        valor_str = match_valor_completo.group(1) if match_valor_completo else montos[0]
        valor = convertir_valor_a_numero(valor_str.replace(' ', ''))
        
        # Si el valor tiene signo negativo, aplicarlo
        if match_valor_completo and '-' in match_valor_completo.group(0):
            if valor is not None:
                valor = -abs(valor)
        
        saldo = convertir_valor_a_numero(montos[1]) if len(montos) > 1 else None
        
        # Determinar si es débito o crédito
        debito = None
        credito = None
        
        if valor is not None:
            # Verificar palabras clave
            linea_lower = linea.lower()
            es_debito = any(palabra in linea_lower for palabra in ['débito por deuda', 'débito', 'cargo', 'retenido', 'devolución de dinero'])
            es_credito = any(palabra in linea_lower for palabra in ['transferencia recibida', 'devolución de dinero', 'reintegro', 'liquidación', 'bonificación'])
            
            # Si el valor es negativo, es débito
            if valor < 0:
                debito = abs(valor)
            elif es_debito:
                debito = abs(valor)
            elif es_credito or valor > 0:
                credito = abs(valor)
            else:
                # Por defecto, si es positivo es crédito
                credito = abs(valor)
        
        # Extraer descripción de forma más precisa
        # La descripción está entre la fecha y el primer monto (valor)
        # Y puede haber texto adicional después del saldo
        
        descripcion = ''
        
        # Encontrar posición del primer monto (valor)
        match_primer_monto = re.search(r'\$\s*-?\s*[\d.,]+', linea)
        primer_monto_pos = match_primer_monto.start() if match_primer_monto else len(linea)
        
        # Encontrar posición del segundo monto (saldo)
        match_segundo_monto = None
        if match_primer_monto:
            # Buscar el segundo monto después del primero
            resto_despues_primer = linea[match_primer_monto.end():]
            # Buscar el patrón del segundo monto (puede tener texto pegado después)
            match_segundo_monto = re.search(r'\$\s*-?\s*([\d.,]+)', resto_despues_primer)
        
        segundo_monto_pos = None
        segundo_monto_end = None
        texto_pegado_al_saldo = ''
        
        if match_segundo_monto:
            segundo_monto_pos = match_primer_monto.end() + match_segundo_monto.start()
            
            # Buscar el patrón completo del saldo que puede tener texto pegado
            # Buscar: $ seguido de número que puede tener texto pegado inmediatamente después
            texto_despues_primer_completo = linea[match_primer_monto.end():]
            # Patrón: $ número (texto pegado opcional)
            match_saldo_con_texto = re.search(r'\$\s*-?\s*([\d.,]+)([a-zA-Z]+)?', texto_despues_primer_completo)
            
            if match_saldo_con_texto:
                # Si hay texto pegado (grupo 2), extraerlo
                if match_saldo_con_texto.group(2):
                    texto_pegado_al_saldo = match_saldo_con_texto.group(2)
                    # El final del monto es donde termina el número (antes del texto pegado)
                    # El match completo es "$ número texto", el final del número es: inicio + longitud del match - longitud del texto pegado
                    inicio_saldo = match_primer_monto.end() + match_saldo_con_texto.start()
                    segundo_monto_end = inicio_saldo + len(match_saldo_con_texto.group(0)) - len(texto_pegado_al_saldo)
                else:
                    segundo_monto_end = match_primer_monto.end() + match_segundo_monto.end()
            else:
                segundo_monto_end = match_primer_monto.end() + match_segundo_monto.end()
        
        # Extraer descripción principal: entre fecha y primer monto
        if primer_monto_pos > fecha_pos:
            # Texto entre fecha y primer monto
            texto_principal = linea[fecha_pos + len(fecha):primer_monto_pos].strip()
            
            # Limpiar ID de operación si está presente (9-11 dígitos)
            # Eliminar el ID específico que encontramos
            if id_operacion:
                texto_principal = texto_principal.replace(id_operacion, '')
            # También eliminar cualquier otro ID que pueda quedar (por si hay múltiples)
            texto_principal = re.sub(r'\b\d{9,11}\b', '', texto_principal)
            texto_principal = re.sub(r'\d{9,11}', '', texto_principal)
            
            # Limpiar espacios múltiples
            texto_principal = re.sub(r'\s+', ' ', texto_principal).strip()
            descripcion = texto_principal
        
        # Si hay texto pegado al saldo, agregarlo a la descripción
        if texto_pegado_al_saldo:
            if descripcion:
                descripcion = descripcion + ' ' + texto_pegado_al_saldo
            else:
                descripcion = texto_pegado_al_saldo
        
        # Si hay más texto después del saldo (con espacio), agregarlo también
        if segundo_monto_end and segundo_monto_end < len(linea):
            texto_despues_saldo = linea[segundo_monto_end:].strip()
            
            # Si ya procesamos texto pegado, saltarlo
            if texto_pegado_al_saldo and texto_despues_saldo.startswith(texto_pegado_al_saldo):
                texto_despues_saldo = texto_despues_saldo[len(texto_pegado_al_saldo):].strip()
            
            # Limpiar el texto después del saldo
            # Eliminar ID de operación si está presente
            if id_operacion and id_operacion in texto_despues_saldo:
                texto_despues_saldo = texto_despues_saldo.replace(id_operacion, '')
            texto_despues_saldo = re.sub(r'\b\d{9,11}\b', '', texto_despues_saldo)
            texto_despues_saldo = re.sub(r'\d{9,11}', '', texto_despues_saldo)
            # Eliminar cualquier número que pueda quedar pegado al inicio
            texto_despues_saldo = re.sub(r'^[\d.,]+', '', texto_despues_saldo)
            texto_despues_saldo = texto_despues_saldo.strip()
            
            # Si hay texto válido después del saldo, agregarlo
            if texto_despues_saldo and len(texto_despues_saldo) > 0:
                # Verificar que no sea solo números o caracteres especiales
                if re.search(r'[a-zA-Z]', texto_despues_saldo):
                    if descripcion:
                        descripcion = descripcion + ' ' + texto_despues_saldo
                    else:
                        descripcion = texto_despues_saldo
        
        # Si la descripción está vacía, intentar extraer de otra forma
        if not descripcion or len(descripcion.strip()) == 0:
            # Extraer todo el texto excepto fecha, ID y montos
            descripcion = linea
            # Eliminar fecha
            descripcion = re.sub(r'\d{2}-\d{2}-\d{4}', '', descripcion, count=1)
            # Eliminar ID de operación (el específico y cualquier otro)
            if id_operacion:
                descripcion = descripcion.replace(id_operacion, '')
            descripcion = re.sub(r'\b\d{9,11}\b', '', descripcion)
            descripcion = re.sub(r'\d{9,11}', '', descripcion)
            # Eliminar montos (con signos) - usar lookahead para separar texto pegado
            descripcion = re.sub(r'\$\s*-?\s*[\d.,]+', ' ', descripcion)
            # Limpiar espacios múltiples
            descripcion = re.sub(r'\s+', ' ', descripcion).strip()
        
        # Limpiar descripción final: eliminar espacios al inicio y final
        descripcion = descripcion.strip()
        
        # Asegurar que no queden IDs de operación en la descripción
        # Eliminar cualquier ID que pueda haber quedado
        if id_operacion and id_operacion in descripcion:
            descripcion = descripcion.replace(id_operacion, '').strip()
        descripcion = re.sub(r'\b\d{9,11}\b', '', descripcion).strip()
        descripcion = re.sub(r'\d{9,11}', '', descripcion).strip()
        
        # Limpiar espacios múltiples nuevamente después de eliminar IDs
        descripcion = re.sub(r'\s+', ' ', descripcion).strip()
        
        # Asegurar que no queden números pegados al final
        # Si la descripción termina con un número pegado, separarlo
        match_numero_final = re.search(r'([a-zA-Z]+)([\d.,]+)$', descripcion)
        if match_numero_final:
            descripcion = match_numero_final.group(1) + ' ' + match_numero_final.group(2)
        
        return {
            'ID de la operación': id_operacion,
            'Fecha': fecha,
            'Descripción': descripcion,
            'Valor': valor,
            'Saldo': saldo,
            'Debito': debito,
            'Credito': credito
        }
        
    except Exception as e:
        safe_print(f"Error parseando transacción: {e}")
        return None

def convertir_valor_a_numero(valor_str):
    """Convierte un valor de texto a número - maneja formatos mixtos"""
    try:
        if not valor_str or valor_str == '' or str(valor_str) == 'nan':
            return None
        
        # Limpiar el valor
        valor_limpio = str(valor_str).replace('$', '').replace(' ', '')
        
        # Detectar formato mixto como "11,346.373,81" o "11.114,396,22"
        if ',' in valor_limpio and '.' in valor_limpio:
            # Contar comas y puntos para determinar el formato
            comas = valor_limpio.count(',')
            puntos = valor_limpio.count('.')
            
            if comas == 1 and puntos == 1:
                # Formato mixto: "11,346.373,81" -> 11346373.81
                # El punto es separador de miles, la coma es decimal
                valor_limpio = valor_limpio.replace('.', '').replace(',', '.')
            elif comas > 1 and puntos == 1:
                # Formato mixto: "11.114,396,22" -> 11114396.22
                # El punto es separador de miles, la última coma es decimal
                partes = valor_limpio.split('.')
                if len(partes) == 2:
                    parte_entera = partes[0]
                    parte_decimal = partes[1].replace(',', '.')
                    valor_limpio = parte_entera + '.' + parte_decimal
                else:
                    # Fallback: tratar como argentino
                    valor_limpio = valor_limpio.replace('.', '').replace(',', '.')
            else:
                # Formato argentino estándar: "26.647,09" -> 26647.09
                valor_limpio = valor_limpio.replace('.', '').replace(',', '.')
        elif ',' in valor_limpio:
            # Solo comas: formato argentino "26.647,09" -> 26647.09
            valor_limpio = valor_limpio.replace('.', '').replace(',', '.')
        elif '.' in valor_limpio:
            # Solo puntos: verificar si es decimal o miles
            partes = valor_limpio.split('.')
            if len(partes) == 2 and len(partes[1]) <= 2:
                # Es decimal: "123.45" -> 123.45
                pass
            else:
                # Son miles: "1.234" -> 1234
                valor_limpio = valor_limpio.replace('.', '')
        
        return float(valor_limpio)
        
    except Exception as e:
        safe_print(f"Error convirtiendo valor '{valor_str}': {e}")
        return None

def guardar_excel_mercado_pago(df, excel_path):
    """Guardar DataFrame en Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Conteo de Transacciones
            df_conteo = crear_conteo_transacciones(df)
            df_conteo.to_excel(writer, sheet_name='Conteo Transacciones', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")

def crear_conteo_transacciones(df):
    """Crear conteo de transacciones por tipo"""
    try:
        # Contar por descripción
        conteo = df['Descripción'].value_counts().reset_index()
        conteo.columns = ['Tipo de Transacción', 'Cantidad']
        
        # Calcular suma de valores por tipo
        suma_valores = df.groupby('Descripción')['Valor'].sum().reset_index()
        suma_valores.columns = ['Tipo de Transacción', 'Suma de Valores']
        
        # Combinar conteo y suma
        resultado = pd.merge(conteo, suma_valores, on='Tipo de Transacción')
        
        # Agregar totales
        total_fila = pd.DataFrame({
            'Tipo de Transacción': ['TOTAL'],
            'Cantidad': [len(df)],
            'Suma de Valores': [df['Valor'].sum()]
        })
        
        resultado = pd.concat([resultado, total_fila], ignore_index=True)
        
        return resultado
    except Exception as e:
        safe_print(f"Error creando conteo: {e}")
        return pd.DataFrame()

if __name__ == "__main__":
    # Test
    pdf_path = "PDF/Extracto Mercado Pago.pdf"
    if os.path.exists(pdf_path):
        resultado = extraer_datos_mercado_pago_directo(pdf_path, "resultado_mercado_pago_test.xlsx")
        if resultado is not None:
            print(f"Extraídas {len(resultado)} transacciones")
    else:
        print("Archivo PDF no encontrado")