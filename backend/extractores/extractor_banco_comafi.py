import pdfplumber
import pandas as pd
import re
from datetime import datetime

def safe_print(texto):
    """Imprimir de forma segura en Windows"""
    try:
        print(texto)
    except UnicodeEncodeError:
        print(texto.encode('utf-8', errors='ignore').decode('utf-8'))

def extraer_datos_banco_comafi(pdf_path, excel_path=None):
    """Extraer datos del PDF de Banco Comafi"""
    try:
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Extraer datos usando pdfplumber
        df = extraer_con_pdfplumber_comafi(pdf_path)
        
        if df is None or df.empty:
            safe_print("No se encontraron datos para extraer")
            return None
        
        safe_print(f"Total de transacciones extraídas: {len(df)}")
        
        # Calcular balance
        saldo_inicial = 0
        total_debitos = df['Debitos'].fillna(0).sum()
        total_creditos = df['Creditos'].fillna(0).sum()
        saldo_final = saldo_inicial + total_creditos - total_debitos
        
        safe_print(f"Balance: Saldo Inicial: ${saldo_inicial:,.2f}, Débitos: ${total_debitos:,.2f}, Créditos: ${total_creditos:,.2f}, Saldo Final: ${saldo_final:,.2f}")
        
        # Guardar Excel si se especifica
        if excel_path:
            guardar_excel_comafi(df, excel_path)
        
        return df
        
    except Exception as e:
        safe_print(f"Error en extracción: {e}")
        return None

def extraer_con_pdfplumber_comafi(pdf_path):
    """Extraer datos usando pdfplumber - Comafi"""
    try:
        transacciones = []
        
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                safe_print(f"Procesando página {page_num + 1}...")
                texto = page.extract_text() or ''
                lineas = texto.split('\n')
                
                # Buscar el encabezado de la tabla
                inicio_tabla = None
                for i, linea in enumerate(lineas):
                    if 'Fecha' in linea and 'Conceptos' in linea and 'Referencias' in linea and 'Débitos' in linea and 'Créditos' in linea and 'Saldo' in linea:
                        inicio_tabla = i + 1
                        safe_print(f"Encontrado encabezado de tabla en línea {i}")
                        break
                
                if inicio_tabla is None:
                    continue
                
                # Procesar líneas de transacciones
                i = inicio_tabla
                while i < len(lineas):
                    linea = lineas[i].strip()
                    if not linea:
                        i += 1
                        continue
                    
                    # Buscar líneas que empiecen con fecha
                    if re.match(r'\d{1,2}/\d{1,2}/\d{2,4}', linea):
                        # Esta es una línea con fecha, procesarla
                        transaccion = parsear_transaccion_comafi(linea, lineas, i)
                        if transaccion:
                            transacciones.append(transaccion)
                    
                    i += 1
        
        if not transacciones:
            safe_print("No se encontraron transacciones")
            return None
        
        # Crear DataFrame
        df = pd.DataFrame(transacciones)
        
        # Ordenar por fecha
        df = df.sort_values('Fecha Transaccion')
        
        return df
        
    except Exception as e:
        safe_print(f"Error en extracción con pdfplumber: {e}")
        return None

def parsear_transaccion_comafi(linea_fecha, lineas, indice):
    """Parsear una transacción de Comafi"""
    try:
        # Extraer fecha
        match_fecha = re.match(r'(\d{1,2}/\d{1,2}/\d{2,4})', linea_fecha)
        if not match_fecha:
            return None
        
        fecha_str = match_fecha.group(1)
        fecha = convertir_fecha_comafi(fecha_str)
        
        # Extraer el resto de la línea después de la fecha
        resto_linea = linea_fecha[match_fecha.end():].strip()
        
        # Buscar montos usando el patrón correcto
        # Patrón: número con punto como separador de miles y coma como decimal
        # Solo capturar números que tengan coma decimal (montos reales)
        patron_monto = r'(\d{1,3}(?:\.\d{3})*,\d{2})'
        montos = re.findall(patron_monto, resto_linea)
        
        # Si no hay montos en la línea actual, buscar en la siguiente línea
        if not montos and indice + 1 < len(lineas):
            siguiente_linea = lineas[indice + 1].strip()
            if siguiente_linea and not re.match(r'\d{1,2}/\d{1,2}/\d{2,4}', siguiente_linea):
                # Esta línea no tiene fecha, puede ser continuación
                montos = re.findall(patron_monto, siguiente_linea)
                if montos:
                    resto_linea += " " + siguiente_linea
        
        # Procesar montos
        debito = None
        credito = None
        saldo = None
        
        if montos:
            # Convertir montos a números
            montos_numericos = []
            for monto in montos:
                try:
                    # Formato argentino: punto para miles, coma para decimales
                    # Ejemplo: "1.193.600,00" -> 1193600.00
                    # Ejemplo: "94.442.093,32" -> 94442093.32
                    monto_limpio = monto.replace('.', '').replace(',', '.')
                    numero = float(monto_limpio)
                    montos_numericos.append(numero)
                except:
                    continue
            
            if montos_numericos:
                # El último monto es generalmente el saldo
                saldo = montos_numericos[-1]
                
                # Si hay más de un monto, el penúltimo puede ser débito o crédito
                if len(montos_numericos) > 1:
                    monto_principal = montos_numericos[-2]
                    
                    # Determinar si es débito o crédito basado en la descripción
                    desc_lower = resto_linea.lower()
                    if any(palabra in desc_lower for palabra in ['impuesto', 'debito', 'cargo', 'gasto', 'imp.', 'comision']):
                        debito = monto_principal
                    elif any(palabra in desc_lower for palabra in ['credito', 'transferencia', 'deposito', 'ingreso', 'transf', 'debin']):
                        credito = monto_principal
                    else:
                        # Si no está claro, asumir que es crédito si es positivo
                        if monto_principal > 0:
                            credito = monto_principal
                        else:
                            debito = abs(monto_principal)
                else:
                    # Solo hay un monto, determinar si es débito o crédito
                    monto_principal = montos_numericos[0]
                    desc_lower = resto_linea.lower()
                    if any(palabra in desc_lower for palabra in ['impuesto', 'debito', 'cargo', 'gasto', 'imp.', 'comision']):
                        debito = monto_principal
                    elif any(palabra in desc_lower for palabra in ['credito', 'transferencia', 'deposito', 'ingreso', 'transf', 'debin']):
                        credito = monto_principal
                    else:
                        # Si no está claro, asumir que es crédito si es positivo
                        if monto_principal > 0:
                            credito = monto_principal
                        else:
                            debito = abs(monto_principal)
        
        # Limpiar descripción de montos y referencias
        descripcion_limpia = re.sub(r'[\d.,]+', '', resto_linea).strip()
        descripcion_limpia = re.sub(r'\s+', ' ', descripcion_limpia)  # Limpiar espacios múltiples
        
        # Extraer referencias (códigos alfanuméricos de 6+ caracteres)
        referencias = re.findall(r'[A-Z0-9]{6,}', resto_linea)
        referencia = ' '.join(referencias) if referencias else ''
        
        # Limpiar descripción de referencias también
        descripcion_limpia = re.sub(r'[A-Z0-9]{6,}', '', descripcion_limpia).strip()
        descripcion_limpia = re.sub(r'\s+', ' ', descripcion_limpia)  # Limpiar espacios múltiples
        
        return {
            'Descripcion': descripcion_limpia,
            'Fecha Transaccion': fecha,
            'Referencias': referencia,
            'Debitos': debito,
            'Creditos': credito,
            'Saldo': saldo
        }
        
    except Exception as e:
        safe_print(f"Error parseando transacción: {e}")
        return None

def convertir_fecha_comafi(fecha_str):
    """Convertir fecha de formato Comafi a estándar"""
    try:
        # Formato: DD/MM/YY o DD/MM/YYYY
        if len(fecha_str.split('/')[2]) == 2:
            # Año de 2 dígitos, asumir 20XX
            fecha_str = fecha_str.replace(f"/{fecha_str.split('/')[2]}", f"/20{fecha_str.split('/')[2]}")
        
        fecha = datetime.strptime(fecha_str, '%d/%m/%Y')
        return fecha.strftime('%d/%m/%Y')
    except:
        return fecha_str

def guardar_excel_comafi(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_comafi(df)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")

def crear_totales_comafi(df):
    """Crear totales por concepto"""
    try:
        # Agrupar por descripción
        resumen = df.groupby('Descripcion').agg({
            'Debitos': 'sum',
            'Creditos': 'sum',
            'Descripcion': 'count'
        }).rename(columns={'Descripcion': 'Cantidad'})
        
        # Calcular totales
        resumen['Total'] = resumen['Debitos'].fillna(0) + resumen['Creditos'].fillna(0)
        
        # Ordenar por total descendente
        resumen = resumen.sort_values('Total', ascending=False)
        
        # Agregar fila de totales
        total_general = pd.DataFrame({
            'Descripcion': ['TOTAL GENERAL'],
            'Debitos': [df['Debitos'].fillna(0).sum()],
            'Creditos': [df['Creditos'].fillna(0).sum()],
            'Cantidad': [len(df)],
            'Total': [df['Debitos'].fillna(0).sum() + df['Creditos'].fillna(0).sum()]
        })
        
        resumen = pd.concat([resumen.reset_index(), total_general], ignore_index=True)
        
        return resumen
        
    except Exception as e:
        safe_print(f"Error creando totales: {e}")
        return pd.DataFrame()

if __name__ == "__main__":
    # Prueba del extractor
    df = extraer_datos_banco_comafi('PDF/Extracto Banco Comafi.pdf', 'test_comafi_final.xlsx')
    if df is not None:
        print("\nPrimeras 5 transacciones:")
        print(df.head().to_string())