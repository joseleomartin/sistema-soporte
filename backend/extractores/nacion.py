import pandas as pd
import pdfplumber
import re
import os
from datetime import datetime

def extraer_datos_banco_nacion(pdf_path, excel_path=None):
    """
    Extractor específico para PDFs del Banco de la Nación Argentina.
    """
    if excel_path is None:
        excel_path = pdf_path.replace('.pdf', '_extraido_banco_nacion_final.xlsx')
    
    datos_extraidos = []
    
    print(f"Procesando archivo: {pdf_path}")
    
    with pdfplumber.open(pdf_path) as pdf:
        # Procesar todas las páginas
        paginas_a_procesar = len(pdf.pages)
        print(f"Procesando todas las {paginas_a_procesar} páginas del PDF...")
        
        for num_pagina in range(paginas_a_procesar):
            pagina = pdf.pages[num_pagina]
            print(f"Procesando página {num_pagina + 1}...")
            
            # Extraer texto de la página
            texto = pagina.extract_text()
            
            if texto:
                # Buscar todas las líneas que contengan fechas
                lineas = texto.split('\n')
                
                for i, linea in enumerate(lineas):
                    linea = linea.strip()
                    
                    # Buscar líneas que empiecen con fecha DD/MM/YY
                    if re.match(r'^\d{2}/\d{2}/\d{2}', linea):
                        
                        # Patrón específico del Banco Nación: Fecha + Descripción + Comprobante + Número + Valor + Saldo
                        # Ejemplo: 01/09/25 CRED BE O BCO-M-SUC 0001K 3055240 15.000,00 8.431,45
                        # Patrón más simple que capture los elementos principales
                        patron = r'^(\d{2}/\d{2}/\d{2})\s+(.+?)\s+(\d+[A-Z]?)\s+(\d+)\s+([\d.,-]+)\s+([\d.,-]+-?)\s*$'
                        match = re.search(patron, linea)
                        
                        # Si el patrón principal no funciona, probar con un patrón más simple
                        if not match:
                            # Patrón más simple: solo fecha, descripción, y los dos números al final
                            patron_simple = r'^(\d{2}/\d{2}/\d{2})\s+(.+?)\s+(\d+[A-Z]?)\s+(\d+)\s+([\d.,-]+)\s+([\d.,-]+-?)\s*'
                            match = re.search(patron_simple, linea)
                        
                        # Si aún no funciona, probar con un patrón muy simple
                        if not match:
                            # Patrón muy simple: fecha + cualquier cosa + dos números al final
                            patron_muy_simple = r'^(\d{2}/\d{2}/\d{2})\s+(.+?)\s+([\d.,-]+)\s+([\d.,-]+-?)\s*$'
                            match = re.search(patron_muy_simple, linea)
                            if match:
                                fecha, descripcion, valor, saldo = match.groups()
                                # Extraer comprobante y número de la descripción
                                comprobante, numero = extraer_comprobante_y_numero(descripcion)
                        
                        
                        if match:
                            # Manejar diferentes casos de captura
                            if len(match.groups()) == 6:
                                fecha, descripcion, comprobante, numero, valor, saldo = match.groups()
                            elif len(match.groups()) == 4:
                                fecha, descripcion, valor, saldo = match.groups()
                                # Extraer comprobante y número de la descripción
                                comprobante, numero = extraer_comprobante_y_numero(descripcion)
                            
                            # Determinar si es débito o crédito basado en el valor
                            valor_limpio = limpiar_numero_banco_nacion(valor)
                            saldo_limpio = limpiar_numero_banco_nacion(saldo)
                            
                            # Analizar el patrón: si hay un valor en la columna de débitos, es un débito
                            # Si hay un valor en la columna de créditos, es un crédito
                            # El formato del Banco Nación tiene: Fecha + Descripción + Comprobante + Número + Débitos + Créditos + Saldo
                            
                            # Si el valor está en la columna de débitos (transacciones que reducen el saldo)
                            if 'DEB' in descripcion.upper() or 'COMIS' in descripcion.upper() or 'I.V.A' in descripcion.upper() or 'RETEN' in descripcion.upper() or 'GRAVAMEN' in descripcion.upper() or 'PERCEPCION' in descripcion.upper() or 'INTERESES' in descripcion.upper():
                                valor_debito = valor_limpio
                                valor_credito = 0.0
                            else:
                                # Si no es un débito, es un crédito
                                valor_debito = 0.0
                                valor_credito = valor_limpio
                            
                            # El valor neto será positivo para créditos y negativo para débitos
                            valor_neto = valor_credito - valor_debito
                            
                            # Usar el saldo del PDF directamente (ya está calculado correctamente)
                            saldo_final = saldo_limpio
                            
                            datos_extraidos.append({
                                'Fecha': fecha,
                                'Descripcion': descripcion.strip(),
                                'Comprobante': comprobante,
                                'Numero': numero,
                                'Debitos': valor_debito,
                                'Creditos': valor_credito,
                                'Valor_Neto': valor_neto,
                                'Saldo': saldo_final,
                                'Pagina': num_pagina + 1
                            })
    
    # Crear DataFrame
    if datos_extraidos:
        df = pd.DataFrame(datos_extraidos)
        
        # Limpiar y ordenar datos
        df = limpiar_datos_banco_nacion(df)
        
        # Guardar en Excel
        guardar_en_excel_banco_nacion(df, excel_path)
        
        print(f"Datos extraídos exitosamente!")
        print(f"Total de registros: {len(df)}")
        print(f"Guardado en: {excel_path}")
        
        return df
    else:
        print("No se encontraron datos para extraer")
        return None

def extraer_comprobante_y_numero(descripcion):
    """
    Extrae el comprobante y número de la descripción.
    Ejemplo: "COMIS.COMPENSACION ATEN C 306" -> comprobante="306", numero="N/A"
    """
    import re
    
    # Buscar números al final de la descripción
    match = re.search(r'(\d+)$', descripcion.strip())
    if match:
        numero = match.group(1)
        # El comprobante es el número encontrado
        comprobante = numero
    else:
        comprobante = "N/A"
        numero = "N/A"
    
    return comprobante, numero

def limpiar_numero_banco_nacion(numero_str):
    """
    Limpia un string de número del formato del Banco Nación, removiendo símbolos y convirtiendo a float.
    Formato argentino: punto como separador de miles, coma como decimal.
    """
    if not numero_str or numero_str == '-':
        return 0.0
    
    # Remover espacios
    numero_limpio = str(numero_str).strip()
    
    # Manejar números negativos (que terminan en -)
    es_negativo = numero_limpio.endswith('-')
    if es_negativo:
        numero_limpio = numero_limpio[:-1]  # Remover el signo menos al final
    
    # En formato argentino: punto es separador de miles, coma es decimal
    # Ejemplo: 46.573,49 -> 46573.49
    
    # Primero, identificar si hay coma decimal
    if ',' in numero_limpio:
        # Hay decimales, separar por coma
        partes = numero_limpio.split(',')
        parte_entera = partes[0]
        parte_decimal = partes[1]
        
        # Remover puntos de la parte entera (separadores de miles)
        parte_entera = parte_entera.replace('.', '')
        
        # Reconstruir el número
        numero_limpio = parte_entera + '.' + parte_decimal
    else:
        # No hay decimales, solo remover puntos (separadores de miles)
        numero_limpio = numero_limpio.replace('.', '')
    
    try:
        resultado = float(numero_limpio)
        return -resultado if es_negativo else resultado
    except ValueError:
        return 0.0

def limpiar_datos_banco_nacion(df):
    """
    Limpia y organiza los datos del DataFrame del Banco Nación.
    """
    if df.empty:
        return df
    
    # Remover duplicados
    df = df.drop_duplicates()
    
    # Ordenar por fecha y página para mantener orden cronológico
    df = df.sort_values(['Fecha', 'Pagina'])
    
    # Resetear índice
    df = df.reset_index(drop=True)
    
    # Formatear columnas
    if 'Fecha' in df.columns:
        # Convertir fecha de DD/MM/YY a datetime
        df['Fecha'] = pd.to_datetime(df['Fecha'], format='%d/%m/%y', errors='coerce')
    
    return df

def guardar_en_excel_banco_nacion(df, excel_path):
    """
    Guarda el DataFrame del Banco Nación en un archivo Excel con formato.
    """
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        # Hoja principal con los datos
        df.to_excel(writer, sheet_name='Movimientos_BancoNacion', index=False)
        
        # Hoja de resumen
        resumen = {
            'Total_Registros': [len(df)],
            'Fecha_Procesamiento': [datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
            'Archivo_Origen': [os.path.basename(excel_path.replace('_extraido_banco_nacion.xlsx', '.pdf'))]
        }
        
        if not df.empty and 'Fecha' in df.columns:
            resumen['Fecha_Mas_Antigua'] = [df['Fecha'].min().strftime('%d-%m-%Y')]
            resumen['Fecha_Mas_Reciente'] = [df['Fecha'].max().strftime('%d-%m-%Y')]
        
        if not df.empty and 'Valor_Neto' in df.columns:
            resumen['Total_Debitos'] = [df['Debitos'].sum()]
            resumen['Total_Creditos'] = [df['Creditos'].sum()]
            resumen['Saldo_Final'] = [df['Saldo'].iloc[-1] if len(df) > 0 else 0]
        
        pd.DataFrame(resumen).to_excel(writer, sheet_name='Resumen', index=False)
        
        # Formatear la hoja principal
        workbook = writer.book
        worksheet = writer.sheets['Movimientos_BancoNacion']
        
        # Ajustar ancho de columnas
        column_widths = {
            'A': 15,  # Fecha
            'B': 40,  # Descripción
            'C': 15,  # Comprobante
            'D': 15,  # Número
            'E': 15,  # Débitos
            'F': 15,  # Créditos
            'G': 15,  # Valor Neto
            'H': 15,  # Saldo
            'I': 10   # Página
        }
        
        for col, width in column_widths.items():
            worksheet.column_dimensions[col].width = width
        
        # Formatear la columna de fecha
        from openpyxl.styles import NamedStyle
        fecha_style = NamedStyle(name="fecha_style")
        fecha_style.number_format = 'DD-MM-YYYY'
        
        # Aplicar formato a la columna A (fecha)
        for row in range(2, len(df) + 2):  # Desde fila 2 hasta el final
            worksheet.cell(row=row, column=1).style = fecha_style

def main():
    """
    Función principal para ejecutar el script del Banco Nación.
    """
    # Buscar específicamente el PDF del Banco Nación
    pdf_banco_nacion = "Extracto Banco Nación.pdf"
    
    if not os.path.exists(pdf_banco_nacion):
        print(f"No se encontró el archivo: {pdf_banco_nacion}")
        print("Archivos PDF disponibles:")
        pdf_files = [f for f in os.listdir('.') if f.endswith('.pdf')]
        for i, pdf_file in enumerate(pdf_files, 1):
            print(f"  {i}. {pdf_file}")
        return
    
    print(f"Procesando: {pdf_banco_nacion}")
    
    # Extraer datos del Banco Nación
    df = extraer_datos_banco_nacion(pdf_banco_nacion)
    
    if df is not None and not df.empty:
        print(f"\nVista previa de los primeros 5 registros:")
        print(df.head().to_string(index=False))
        
        print(f"\nEstadísticas del Banco Nación:")
        print(f"  Total de transacciones: {len(df)}")
        if 'Debitos' in df.columns and 'Creditos' in df.columns:
            print(f"  Total débitos: ${df['Debitos'].sum():,.2f}")
            print(f"  Total créditos: ${df['Creditos'].sum():,.2f}")
            print(f"  Saldo final: ${df['Saldo'].iloc[-1]:,.2f}")
        if 'Fecha' in df.columns:
            print(f"  Período: {df['Fecha'].min().strftime('%d-%m-%Y')} a {df['Fecha'].max().strftime('%d-%m-%Y')}")

if __name__ == "__main__":
    main()
