import pandas as pd
import pdfplumber
import re
import os

def safe_print(texto):
    """Imprimir texto de forma segura en Windows"""
    try:
        print(texto.encode('cp1252', errors='replace').decode('cp1252'))
    except:
        print(str(texto))

def extraer_datos_banco_jpmorgan(pdf_path, excel_path=None):
    """Extraer datos del extracto de JPMORGAN"""
    try:
        if not os.path.exists(pdf_path):
            safe_print(f"El archivo {pdf_path} no existe")
            return pd.DataFrame()
        
        safe_print(f"Extrayendo datos del PDF: {pdf_path}")
        
        # Usar pdfplumber para extraer texto directamente
        transacciones = extraer_con_pdfplumber_jpmorgan(pdf_path)
        
        if not transacciones:
            safe_print("No se encontraron transacciones en el PDF")
            if excel_path:
                guardar_excel_jpmorgan(pd.DataFrame(), excel_path)
            return pd.DataFrame()
        
        df_final = pd.DataFrame(transacciones)
        safe_print(f"Total de transacciones extraídas: {len(df_final)}")
        
        # Guardar Excel
        if excel_path:
            guardar_excel_jpmorgan(df_final, excel_path)
        
        return df_final
        
    except Exception as e:
        safe_print(f"Error extrayendo datos: {e}")
        import traceback
        safe_print(traceback.format_exc())
        return pd.DataFrame()

def extraer_con_pdfplumber_jpmorgan(pdf_path):
    """Extraer transacciones usando pdfplumber - formato JPMORGAN real"""
    try:
        transacciones = []
        
        with pdfplumber.open(pdf_path) as pdf:
            # Procesar todas las páginas
            for page_num, page in enumerate(pdf.pages):
                texto = page.extract_text() or ''
                lineas = texto.split('\n')
                
                # Buscar inicio de tabla de transacciones
                en_tabla = False
                i = 0
                
                while i < len(lineas):
                    linea_clean = lineas[i].strip()
                    
                    # Detectar inicio de tabla: "Descripción Fecha Código Fecha Valor Débitos Créditos Saldo"
                    if 'Descripción Fecha Código Fecha Valor Débitos Créditos Saldo' in linea_clean:
                        en_tabla = True
                        i += 1
                        continue
                    
                    # Detectar fin de tabla
                    if en_tabla and ('NÚMERO DE PÁGINA' in linea_clean or 'Total Db' in linea_clean):
                        en_tabla = False
                        break
                    
                    # Procesar filas de la tabla
                    if en_tabla and linea_clean and linea_clean != '0.00':
                        # Buscar saldo inicial
                        if 'Saldo Inicial' in linea_clean:
                            transaccion = parsear_saldo_inicial_jpmorgan(linea_clean)
                            if transaccion:
                                transacciones.append(transaccion)
                        
                        # Buscar transacciones con patrón de fecha + código + fecha_valor + montos
                        elif re.search(r'\d{1,2}\s+\w{3}\s+\w+\s+\d{1,2}\s+\w{3}\s+', linea_clean):
                            # Esta línea tiene el patrón de transacción
                            transaccion = parsear_transaccion_jpmorgan_simple(linea_clean)
                            if transaccion:
                                transacciones.append(transaccion)
                    
                    i += 1
        
        return transacciones
        
    except Exception as e:
        safe_print(f"Error en extracción con pdfplumber: {e}")
        return []

def parsear_saldo_inicial_jpmorgan(linea):
    """Parsear saldo inicial"""
    try:
        # Formato: "Saldo Inicial 31 JUL 6,504,956.38"
        match = re.match(r'Saldo Inicial\s+(\d{1,2}\s+\w{3})\s+([\d,Þ.]+)', linea)
        if match:
            fecha_str = match.group(1)
            saldo = match.group(2)
            fecha = convertir_fecha_jpmorgan(fecha_str)
            
            return {
                'Descripcion': 'Saldo Inicial',
                'Fecha Transaccion': fecha,
                'Codigo Transaccion / Referencia': 'INI',
                'Fecha Valor': fecha_str,
                'Debitos': '',
                'Creditos': '',
                'Saldo': saldo
            }
        return None
    except Exception as e:
        safe_print(f"Error parseando saldo inicial: {e}")
        return None

def parsear_transaccion_jpmorgan_simple(linea):
    """Parsear transacción simple de JPMORGAN - formato real"""
    try:
        # Patrón: descripción fecha código fecha_valor montos
        # Ejemplo: "Pago Interbanking Proveedores 11 AGO TRF 11 AGO -224,392.30 224,392.30 -224,392.30 6,280,564.08"
        
        # Buscar patrón: descripción + fecha + código + fecha_valor + montos
        match = re.match(r'^(.+?)\s+(\d{1,2}\s+\w{3})\s+(\w+)\s+(\d{1,2}\s+\w{3})\s+(.+)$', linea)
        if not match:
            return None
        
        descripcion = match.group(1).strip()
        fecha_str = match.group(2)
        codigo = match.group(3)
        fecha_valor = match.group(4)
        montos_str = match.group(5)
        
        # Parsear montos: "-224,392.30 224,392.30 -224,392.30 6,280,564.08"
        montos = montos_str.split()
        
        if len(montos) >= 4:
            debitos = montos[0]  # "-224,392.30"
            creditos = montos[1]  # "224,392.30"
            saldo_anterior = montos[2]  # "-224,392.30"
            saldo = montos[3]  # "6,280,564.08"
            
            # Convertir fecha
            fecha = convertir_fecha_jpmorgan(fecha_str)
            
            # Determinar si es débito o crédito basado en los valores
            debito_valor = convertir_valor_a_numero_jpmorgan(debitos) if debitos != '0.00' else None
            credito_valor = convertir_valor_a_numero_jpmorgan(creditos) if creditos != '0.00' else None
            
            # Clasificar transacción
            if debito_valor and debito_valor < 0:
                es_debito = True
                es_credito = False
            elif credito_valor and credito_valor > 0:
                es_debito = False
                es_credito = True
            else:
                es_debito = False
                es_credito = False
            
            return {
                'Descripcion': descripcion,
                'Fecha Transaccion': fecha,
                'Codigo Transaccion / Referencia': codigo,
                'Fecha Valor': fecha_valor,
                'Debitos': debitos if es_debito else '',
                'Creditos': creditos if es_credito else '',
                'Saldo': saldo
            }
        
        return None
        
    except Exception as e:
        safe_print(f"Error parseando transacción simple: {e}")
        return None

def parsear_transaccion_jpmorgan(lineas, indice_inicio):
    """Parsear transacción completa de JPMORGAN (función legacy)"""
    try:
        # Buscar descripción en líneas anteriores
        descripcion = buscar_descripcion_completa_jpmorgan(lineas, indice_inicio)
        
        # Parsear línea actual con fechas y montos
        linea_actual = lineas[indice_inicio].strip()
        
        # Patrón: fecha código fecha_valor montos
        # Ejemplo: "11 AGO TRF 11 AGO-224,392.30 224,392.30 0.00 -224,392.30 6,280,564.08"
        match = re.match(r'(\d{1,2}\s+\w{3})\s+(\w+)\s+(\d{1,2}\s+\w{3})\s+(.+)', linea_actual)
        if not match:
            return None
        
        fecha_str = match.group(1)
        codigo = match.group(2)
        fecha_valor = match.group(3)
        montos_str = match.group(4)
        
        # Parsear montos
        montos = montos_str.split()
        if len(montos) >= 5:
            debitos = montos[0]  # "-224,392.30"
            creditos = montos[1]  # "224,392.30"
            saldo_anterior = montos[2]  # "0.00"
            saldo_anterior2 = montos[3]  # "-224,392.30"
            saldo = montos[4]  # "6,280,564.08"
            
            # Convertir fecha
            fecha = convertir_fecha_jpmorgan(fecha_str)
            
            # Determinar si es débito o crédito
            debito_valor = convertir_valor_a_numero_jpmorgan(debitos) if debitos != '0.00' else None
            credito_valor = convertir_valor_a_numero_jpmorgan(creditos) if creditos != '0.00' else None
            
            # Clasificar transacción
            if debito_valor and debito_valor < 0:
                es_debito = True
                es_credito = False
            elif credito_valor and credito_valor > 0:
                es_debito = False
                es_credito = True
            else:
                es_debito = False
                es_credito = False
            
            return {
                'Descripcion': descripcion,
                'Fecha Transaccion': fecha,
                'Codigo Transaccion / Referencia': codigo,
                'Fecha Valor': fecha_valor,
                'Debitos': debitos if es_debito else '',
                'Creditos': creditos if es_credito else '',
                'Saldo': saldo
            }
        
        return None
        
    except Exception as e:
        safe_print(f"Error parseando transacción: {e}")
        return None

def buscar_descripcion_completa_jpmorgan(lineas, indice_actual):
    """Buscar descripción completa en las líneas anteriores"""
    descripcion = 'Transacción'
    
    # Buscar hacia atrás hasta 10 líneas
    for j in range(max(0, indice_actual - 10), indice_actual):
        linea_prev = lineas[j].strip()
        
        # Si la línea no es vacía, no es un número, y no contiene fechas
        if (linea_prev and 
            not re.match(r'^\d{1,2}\s+\w{3}', linea_prev) and 
            not re.match(r'^\d{1,3}(?:[,Þ]\d{3})*[.,]\d{2}', linea_prev) and
            not re.match(r'^0\.00$', linea_prev) and
            not re.match(r'^X$', linea_prev) and
            'Descripción' not in linea_prev and
            'Fecha' not in linea_prev and
            'Total' not in linea_prev):
            
            # Si es la primera línea de descripción, usarla
            if descripcion == 'Transacción':
                descripcion = linea_prev
            else:
                # Concatenar con la descripción existente
                descripcion = f"{descripcion} {linea_prev}"
    
    return descripcion

def convertir_fecha_jpmorgan(fecha_str):
    """Convertir fecha de formato JPMORGAN a DD/MM/YYYY"""
    try:
        # Mapeo de meses
        meses = {
            'ENE': '01', 'FEB': '02', 'MAR': '03', 'ABR': '04',
            'MAY': '05', 'JUN': '06', 'JUL': '07', 'AGO': '08',
            'SEP': '09', 'OCT': '10', 'NOV': '11', 'DIC': '12'
        }
        
        # Formato: "11 AGO" -> "11/08/2025"
        match = re.match(r'(\d{1,2})\s+(\w{3})', fecha_str)
        if match:
            dia = match.group(1).zfill(2)
            mes_abrev = match.group(2).upper()
            mes = meses.get(mes_abrev, '01')
            # Asumir año 2025 para este extracto
            return f"{dia}/{mes}/2025"
        
        return fecha_str
    except:
        return fecha_str

def convertir_valor_a_numero_jpmorgan(valor_str):
    """Convertir valor de texto a número - formato JPMORGAN"""
    try:
        if not valor_str or valor_str == 'nan':
            return None
        
        # Limpiar el valor
        valor_limpio = str(valor_str).strip().replace('$', '').replace(' ', '')
        
        # Reemplazar caracteres especiales específicos que aparecen en el PDF
        valor_limpio = valor_limpio.replace('Þ', ',')  # Carácter especial que aparece en el PDF
        valor_limpio = valor_limpio.replace('p', ',')  # Carácter 'p' que aparece en lugar de comas
        
        # Usar regex para reemplazar cualquier carácter que no sea dígito, punto, coma o signo menos
        import re
        valor_limpio = re.sub(r'[^\d.,-]', '', valor_limpio)
        
        # Limpiar comas múltiples consecutivas
        valor_limpio = re.sub(r',+', ',', valor_limpio)
        
        # Formato americano: coma para miles, punto para decimales
        # Ejemplo: "6,280,564.08" -> 6280564.08
        if ',' in valor_limpio and '.' in valor_limpio:
            # Formato americano: "6,280,564.08" -> 6280564.08
            valor_limpio = valor_limpio.replace(',', '')
        elif ',' in valor_limpio:
            # Verificar si es formato americano o argentino
            partes = valor_limpio.split(',')
            if len(partes) == 2 and len(partes[1]) <= 2:
                # Formato argentino: "6280564,08" -> 6280564.08
                parte_entera = partes[0].replace('.', '')
                parte_decimal = partes[1]
                valor_limpio = f"{parte_entera}.{parte_decimal}"
            else:
                # Formato americano: "6,280,564" -> 6280564
                valor_limpio = valor_limpio.replace(',', '')
        
        return float(valor_limpio)
    except Exception as e:
        safe_print(f"Error convirtiendo valor '{valor_str}': {e}")
        return None

def guardar_excel_jpmorgan(df, excel_path):
    """Guardar Excel con múltiples hojas"""
    try:
        # Crear una copia del DataFrame para limpiar los números
        df_limpio = df.copy()
        
        # Limpiar columnas numéricas
        columnas_numericas = ['Debitos', 'Creditos', 'Saldo']
        for col in columnas_numericas:
            if col in df_limpio.columns:
                df_limpio[col] = df_limpio[col].apply(limpiar_valor_para_excel)
        
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # 1. Hoja original
            df_limpio.to_excel(writer, sheet_name='Tablas Extraidas', index=False)
            
            # 2. Hoja de Movimientos Consolidados
            df_limpio.to_excel(writer, sheet_name='Movimientos Consolidados', index=False)
            
            # 3. Hoja de Totales por Concepto
            df_totales = crear_totales_jpmorgan(df_limpio)
            df_totales.to_excel(writer, sheet_name='Totales por Concepto', index=False)
        
        safe_print(f"Excel guardado: {excel_path}")
    except Exception as e:
        safe_print(f"Error guardando Excel: {e}")

def limpiar_valor_para_excel(valor):
    """Limpiar valor para que sea un número real en Excel"""
    try:
        if pd.isna(valor) or valor == '' or valor == 'nan':
            return None
        
        # Convertir a número usando la función existente
        numero = convertir_valor_a_numero_jpmorgan(str(valor))
        return numero
    except:
        return valor

def crear_totales_jpmorgan(df):
    """Crear totales por concepto"""
    try:
        saldo_inicial = 0
        total_debitos = 0
        total_creditos = 0
        
        # Sumar débitos y créditos
        for _, row in df.iterrows():
            debito_valor = str(row.get('Debitos', '')).strip()
            credito_valor = str(row.get('Creditos', '')).strip()
            
            if debito_valor and debito_valor != '' and debito_valor != 'nan':
                debito_num = convertir_valor_a_numero_jpmorgan(debito_valor)
                if debito_num:
                    total_debitos += debito_num
            
            if credito_valor and credito_valor != '' and credito_valor != 'nan':
                credito_num = convertir_valor_a_numero_jpmorgan(credito_valor)
                if credito_num:
                    total_creditos += credito_num
        
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