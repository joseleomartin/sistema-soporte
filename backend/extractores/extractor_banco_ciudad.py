#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import camelot
import pandas as pd
import re
import os

def extraer_datos_banco_ciudad(pdf_path, excel_path=None):
    """Función principal para extraer datos de Banco Ciudad"""
    try:
        print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Intentar con diferentes métodos de extracción
        tables = None
        
        # Método 1: Lattice (para tablas con bordes)
        try:
            print("Intentando extracción con método 'lattice'...")
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
            if tables:
                print(f"Lattice: Se encontraron {len(tables)} tablas")
        except Exception as e:
            print(f"Error con lattice: {e}")
        
        # Método 2: Stream (si lattice falla)
        if not tables:
            try:
                print("Intentando extracción con método 'stream'...")
                tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
                if tables:
                    print(f"Stream: Se encontraron {len(tables)} tablas")
            except Exception as e:
                print(f"Error con stream: {e}")
        
        if not tables:
            print("No se encontraron tablas en el PDF")
            return pd.DataFrame()
        
        print(f"Total de tablas encontradas: {len(tables)}")
        
        # Buscar tabla de movimientos en todas las tablas
        tabla_movimientos = None
        for i, table in enumerate(tables):
            df = table.df
            texto_completo = ' '.join([str(valor) for valor in df.values.flatten() if pd.notna(valor)]).lower()
            
            # Buscar patrones específicos de Banco Ciudad
            if any(palabra in texto_completo for palabra in ['resumen de cuenta', 'movimientos', 'débito', 'crédito', 'saldo']):
                print(f"Tabla {i+1} identificada como tabla de movimientos")
                tabla_movimientos = df
                break
        
        if tabla_movimientos is None:
            print("No se encontró tabla de movimientos específica, procesando todas las tablas...")
            # Si no se encuentra una tabla específica, procesar todas
            all_data = []
            for i, table in enumerate(tables):
                print(f"Procesando tabla {i+1}/{len(tables)}...")
                df_procesado = procesar_tabla_banco_ciudad(table.df)
                if not df_procesado.empty:
                    all_data.append(df_procesado)
            
            if all_data:
                df_final = pd.concat(all_data, ignore_index=True)
            else:
                print("No se pudieron procesar los datos de ninguna tabla")
                return pd.DataFrame()
        else:
            # Procesar tabla específica de movimientos
            df_final = procesar_tabla_banco_ciudad(tabla_movimientos)
        
        if df_final.empty:
            print("No se pudieron procesar los datos")
            return pd.DataFrame()
        
        # Guardar Excel
        if excel_path:
            guardar_excel_banco_ciudad(df_final, excel_path)
        
        print(f"Total de registros extraídos: {len(df_final)}")
        return df_final
        
    except Exception as e:
        print(f"Error extrayendo datos: {e}")
        return pd.DataFrame()

def procesar_tabla_banco_ciudad(df):
    """Procesar tabla de Banco Ciudad"""
    try:
        # Buscar la fila que contiene los encabezados
        headers_row = None
        for i, row in df.iterrows():
            contenido = str(row.iloc[0])
            if 'FECHA' in contenido and 'DÉBITO' in contenido and 'CRÉDITO' in contenido:
                headers_row = i
                break
        
        if headers_row is None:
            return pd.DataFrame()
        
        # Extraer datos después de los encabezados
        datos_filas = []
        for i in range(headers_row + 1, len(df)):
            fila = str(df.iloc[i, 0])
            
            # Saltar filas vacías
            if not fila or len(fila.strip()) < 10:
                continue
            
            # Parsear la fila
            fecha_match = re.match(r'(\d{2}-\w{3}-\d{4})', fila)
            if not fecha_match:
                continue
            
            fecha = fecha_match.group(1)
            
            # Buscar todos los montos en la línea
            montos = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', fila)
            
            # Extraer descripción
            resto_linea = fila[len(fecha):].strip()
            for monto in montos:
                resto_linea = resto_linea.replace(monto, '').strip()
            
            descripcion = ' '.join(resto_linea.split())
            
            # Determinar débito y crédito
            debito = ''
            credito = ''
            saldo = ''
            
            if len(montos) >= 1:
                saldo = montos[-1]  # El último monto es siempre el saldo
                
                # Clasificar movimientos basándose en la descripción
                descripcion_upper = descripcion.upper()
                
                if len(montos) >= 2:
                    # Para transferencias con múltiples montos
                    if 'TRANSFERENCIA' in descripcion_upper and len(montos) >= 3:
                        # En transferencias, el primer monto suele ser débito y el segundo crédito
                        debito = montos[0] if montos[0] != '0,00' else ''
                        credito = montos[1] if len(montos) > 1 and montos[1] != '0,00' else ''
                    else:
                        # Para otros movimientos, determinar si es débito o crédito por la descripción
                        if any(palabra in descripcion_upper for palabra in ['TRANSFERENCIA', 'DEPOSITO', 'COBRO', 'INGRESO', 'ABONO']):
                            # Movimientos que aumentan el saldo (créditos)
                            credito = montos[0] if montos[0] != '0,00' else ''
                        elif any(palabra in descripcion_upper for palabra in ['DEBITO', 'PAGO', 'RETIRO', 'EGRESO', 'COMISION', 'INTERES', 'IMPUESTO', 'LEY']):
                            # Movimientos que disminuyen el saldo (débitos)
                            debito = montos[0] if montos[0] != '0,00' else ''
                        else:
                            # Por defecto, si no se puede determinar, asumir débito
                            debito = montos[0] if montos[0] != '0,00' else ''
            
            # Crear fila procesada
            datos_filas.append({
                'Fecha': fecha,
                'Origen': '',
                'Descripcion': descripcion,
                'Debito': debito,
                'Credito': credito,
                'Saldo': saldo,
                'Movimiento': ''
            })
        
        if datos_filas:
            df_procesado = pd.DataFrame(datos_filas)
            print(f"Procesadas {len(df_procesado)} filas de movimientos")
            return df_procesado
        
        return pd.DataFrame()
        
    except Exception as e:
        print(f"Error procesando tabla: {e}")
        return pd.DataFrame()

def guardar_excel_banco_ciudad(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_banco_ciudad(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        print(f"Excel guardado: {excel_path}")
        
    except Exception as e:
        print(f"Error guardando Excel: {e}")

def crear_totales_banco_ciudad(df):
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
        
        return None
        
    except Exception as e:
        return None