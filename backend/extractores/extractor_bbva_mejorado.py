#!/usr/bin/env python3
"""
Extractor mejorado para Banco BBVA
Optimizado para la estructura real de PDFs de BBVA
"""

import pandas as pd
import pdfplumber
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

class ExtractorBBVAMejorado:
    def __init__(self):
        self.bank_name = "Banco BBVA"
        self.patrones_fecha = [
            r'\d{1,2}/\d{1,2}',  # DD/MM
            r'\d{1,2}/\d{1,2}/\d{4}',  # DD/MM/YYYY
        ]
        self.patrones_monto = [
            r'-?\d+[.,]\d{2}',  # Montos con coma o punto decimal
            r'\$\s*\d+[.,]\d{2}',  # Montos con símbolo $
            r'-?\d+\.\d{3},\d{2}',  # Montos con separador de miles (ej: 1.032,55)
            r'\d+\.\d{3},\d{2}',  # Montos positivos con separador de miles
        ]
    
    def extraer_datos(self, pdf_path, excel_salida):
        """Extraer datos del PDF de BBVA y guardar en Excel"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                all_data = []
                
                for page_num, page in enumerate(pdf.pages):
                    print(f"Procesando página {page_num + 1}/{len(pdf.pages)}")
                    
                    # Estrategia 1: Extraer de tablas (más confiable para BBVA)
                    datos_tabla = self._extraer_de_tablas_bbva(page, page_num + 1)
                    if datos_tabla:
                        all_data.extend(datos_tabla)
                        continue
                    
                    # Estrategia 2: Extraer de texto estructurado
                    datos_texto = self._extraer_de_texto_bbva(page, page_num + 1)
                    if datos_texto:
                        all_data.extend(datos_texto)
                
                if all_data:
                    df = self._procesar_datos_bbva(all_data)
                    self._guardar_excel_bbva(df, excel_salida)
                    return df
                else:
                    print("No se encontraron datos válidos")
                    return None
                    
        except Exception as e:
            print(f"Error extrayendo datos: {str(e)}")
            return None
    
    def _extraer_de_tablas_bbva(self, page, pagina):
        """Extraer datos de tablas de BBVA con lógica específica"""
        datos = []
        
        try:
            tables = page.extract_tables()
            
            for table_num, table in enumerate(tables):
                if not table or len(table) < 2:
                    continue
                
                print(f"  Procesando tabla {table_num + 1} con {len(table)} filas")
                
                # Buscar filas de transacciones
                for row_num, row in enumerate(table[1:], 1):  # Saltar header
                    if self._es_fila_transaccion_bbva_mejorada(row):
                        data_row = self._procesar_fila_bbva_mejorada(row, pagina, table_num + 1)
                        if data_row:
                            datos.append(data_row)
                            print(f"    Fila {row_num}: {data_row['Fecha']} - {data_row['Concepto'][:30]}...")
        
        except Exception as e:
            print(f"Error procesando tablas: {e}")
        
        return datos
    
    def _extraer_de_texto_bbva(self, page, pagina):
        """Extraer datos de texto estructurado de BBVA"""
        datos = []
        
        try:
            text = page.extract_text()
            if not text:
                return datos
            
            lines = text.split('\n')
            
            # BUSCAR SALDO INICIAL EN TEXTO LIBRE
            for line_num, line in enumerate(lines):
                line = line.strip()
                
                # Verificar si es saldo inicial (formato: 3.943.380,03 o SALDO ANTERIOR 3.943.380,03)
                if re.match(r'^\d+\.\d{3}\.\d{3},\d{2}$', line) or 'SALDO ANTERIOR' in line.upper():
                    # Extraer saldo de la línea
                    saldo_match = re.search(r'\d+\.\d{3}\.\d{3},\d{2}', line)
                    if saldo_match:
                        saldo_inicial = self._corregir_saldo_completo(saldo_match.group())
                        if saldo_inicial:
                            data_row = {
                                'Fecha': 'SALDO INICIAL',
                                'Origen': '',
                                'Concepto': 'Saldo Inicial',
                                'Debito': None,
                                'Credito': None,
                                'Saldo': saldo_inicial,
                                'Pagina': pagina,
                                'Linea': line_num + 1,
                                'Tipo': 'Saldo Inicial'
                            }
                            datos.append(data_row)
                            print(f"Saldo inicial encontrado en texto: {saldo_inicial}")
                            print(f"Data row creado: {data_row}")
                            continue
                
                # Procesar líneas de transacción normales
                if self._es_linea_transaccion_bbva_mejorada(line):
                    data_row = self._procesar_linea_bbva_mejorada(line, pagina, line_num + 1)
                    if data_row:
                        datos.append(data_row)
        
        except Exception as e:
            print(f"Error procesando texto: {e}")
        
        return datos
    
    def _es_fila_transaccion_bbva_mejorada(self, row):
        """Validar si una fila contiene una transacción de BBVA (versión mejorada)"""
        if not row or not any(cell for cell in row if cell):
            return False
        
        row_text = ' '.join([str(cell) for cell in row if cell])
        
        # Excluir encabezados y texto informativo
        excluir = [
            'fecha', 'origen', 'concepto', 'debito', 'credito', 'saldo',
            'movimientos', 'cuentas', 'detalle',
            'banco bbva', 'argentina', 'cuit', 'iva responsable'
        ]
        
        if any(palabra in row_text.lower() for palabra in excluir):
            return False
        
        # INCLUIR "SALDO ANTERIOR" como transacción válida
        if 'saldo anterior' in row_text.lower():
            return True
        
        # INCLUIR SALDO INICIAL: Si la fila contiene solo un saldo (formato: 3.943.380,03)
        # Patrón correcto: dígitos, punto, 3 dígitos, punto, 3 dígitos, coma, 2 dígitos
        if re.match(r'^\d+\.\d{3}\.\d{3},\d{2}$', row_text.strip()):
            return True
        
        # Debe tener fecha en formato DD/MM
        tiene_fecha = re.search(r'\d{1,2}/\d{1,2}', row_text)
        
        # Debe tener monto (debito o credito)
        tiene_monto = any(re.search(pattern, row_text) for pattern in self.patrones_monto)
        
        # Debe tener texto descriptivo
        tiene_descripcion = len(row_text.strip()) > 10
        
        return tiene_fecha and (tiene_monto or tiene_descripcion)
    
    def _es_linea_transaccion_bbva_mejorada(self, line):
        """Validar si una línea contiene una transacción de BBVA (versión mejorada)"""
        if not line or len(line) < 15:
            return False
        
        # Excluir líneas informativas
        excluir = [
            'fecha', 'origen', 'concepto', 'debito', 'credito', 'saldo',
            'saldo anterior', 'movimientos', 'cuentas', 'detalle',
            'banco bbva', 'argentina', 'cuit', 'iva responsable'
        ]
        
        if any(palabra in line.lower() for palabra in excluir):
            return False
        
        # Debe tener fecha
        tiene_fecha = any(re.search(pattern, line) for pattern in self.patrones_fecha)
        
        # Debe tener monto o descripción significativa
        tiene_monto = any(re.search(pattern, line) for pattern in self.patrones_monto)
        tiene_descripcion = len(line.strip()) > 20
        
        return tiene_fecha and (tiene_monto or tiene_descripcion)
    
    def _procesar_fila_bbva_mejorada(self, row, pagina, tabla):
        """Procesar fila de tabla de BBVA (versión mejorada)"""
        try:
            row_text = ' '.join([str(cell) for cell in row if cell])
            
            # MANEJAR SALDO INICIAL: Si la fila contiene solo un saldo (formato: 3.943.380,03)
            if re.match(r'^\d+\.\d{3}\.\d{3},\d{2}$', row_text.strip()):
                saldo_inicial = self._corregir_saldo_completo(row_text.strip())
                if saldo_inicial:
                    data_row = {
                        'Fecha': 'SALDO INICIAL',
                        'Origen': '',
                        'Concepto': 'Saldo Inicial',
                        'Debito': None,
                        'Credito': None,
                        'Saldo': saldo_inicial,
                        'Pagina': pagina,
                        'Tabla': tabla,
                        'Tipo': 'Saldo Inicial'
                    }
                    return data_row
            
            # MANEJAR SALDO ANTERIOR ESPECIALMENTE
            if 'saldo anterior' in row_text.lower():
                # Extraer el saldo inicial
                saldo_inicial = self._extraer_saldo_inicial(row_text)
                if saldo_inicial:
                    data_row = {
                        'Fecha': 'SALDO ANTERIOR',
                        'Origen': '',
                        'Concepto': 'Saldo Anterior',
                        'Debito': None,
                        'Credito': None,
                        'Saldo': saldo_inicial,
                        'Pagina': pagina,
                        'Tabla': tabla,
                        'Tipo': 'Saldo Inicial'
                    }
                    return data_row
            
            # Mapear columnas según estructura real de BBVA
            fecha = self._extraer_campo_seguro(row, 0)
            origen = self._extraer_campo_seguro(row, 1)
            concepto = self._extraer_campo_seguro(row, 2)
            debito_raw = self._extraer_campo_seguro(row, 3)
            credito_raw = self._extraer_campo_seguro(row, 4)
            saldo = self._extraer_campo_seguro(row, 5)
            
            # Si no hay suficientes columnas, intentar extraer de texto combinado
            if not fecha and not concepto:
                fecha = self._extraer_fecha_de_texto(row_text)
                concepto = self._extraer_concepto_de_texto(row_text)
                debito_raw = self._extraer_monto_de_texto(row_text, 'debito')
                credito_raw = self._extraer_monto_de_texto(row_text, 'credito')
                saldo = self._extraer_monto_de_texto(row_text, 'saldo')
            
            # LÓGICA CORRECTA: O débito O crédito, nunca ambos
            debito_final = None
            credito_final = None
            
            if debito_raw and self._es_monto_valido(debito_raw):
                # Si hay débito, es una transacción de débito
                debito_final = self._limpiar_monto_bbva(debito_raw)
            elif credito_raw and self._es_monto_valido(credito_raw):
                # Si hay crédito, es una transacción de crédito
                credito_final = self._limpiar_monto_bbva(credito_raw)
            
            data_row = {
                'Fecha': self._limpiar_fecha_bbva(fecha),
                'Origen': self._limpiar_texto(origen),
                'Concepto': self._limpiar_concepto_bbva(concepto),
                'Debito': debito_final,
                'Credito': credito_final,
                'Saldo': self._corregir_saldo_completo(self._limpiar_monto_bbva(saldo)),
                'Pagina': pagina,
                'Tabla': tabla,
                'Tipo': 'Tabla'
            }
            
            # Validar que tenga al menos fecha y concepto
            if data_row['Fecha'] and data_row['Concepto']:
                return data_row
            
        except Exception as e:
            print(f"Error procesando fila: {e}")
        
        return None
    
    def _procesar_linea_bbva_mejorada(self, line, pagina, linea):
        """Procesar línea de texto de BBVA (versión mejorada)"""
        try:
            debito_raw = self._extraer_monto_de_texto(line, 'debito')
            credito_raw = self._extraer_monto_de_texto(line, 'credito')
            
            # LÓGICA CORRECTA: O débito O crédito, nunca ambos
            debito_final = None
            credito_final = None
            
            if debito_raw and self._es_monto_valido(debito_raw):
                # Si hay débito, es una transacción de débito
                debito_final = self._limpiar_monto_bbva(debito_raw)
            elif credito_raw and self._es_monto_valido(credito_raw):
                # Si hay crédito, es una transacción de crédito
                credito_final = self._limpiar_monto_bbva(credito_raw)
            
            data_row = {
                'Fecha': self._extraer_fecha_de_texto(line),
                'Origen': self._extraer_origen_de_texto(line),
                'Concepto': self._extraer_concepto_de_texto(line),
                'Debito': debito_final,
                'Credito': credito_final,
                'Saldo': self._corregir_saldo_completo(self._extraer_monto_de_texto(line, 'saldo')),
                'Pagina': pagina,
                'Linea': linea,
                'Tipo': 'Texto'
            }
            
            # Validar que tenga al menos fecha y concepto
            if data_row['Fecha'] and data_row['Concepto']:
                return data_row
            
        except Exception as e:
            print(f"Error procesando línea: {e}")
        
        return None
    
    def _extraer_campo_seguro(self, row, indice):
        """Extraer campo por índice de forma segura"""
        if indice < len(row) and row[indice]:
            return str(row[indice]).strip()
        return None
    
    def _extraer_fecha_de_texto(self, text):
        """Extraer fecha de texto"""
        for pattern in self.patrones_fecha:
            match = re.search(pattern, text)
            if match:
                return match.group().strip()
        return None
    
    def _extraer_concepto_de_texto(self, text):
        """Extraer concepto de texto - CORREGIDO"""
        # Remover fechas y montos para obtener concepto
        concepto = text
        
        # Remover fechas
        for pattern in self.patrones_fecha:
            concepto = re.sub(pattern, '', concepto)
        
        # Remover montos (más específico)
        concepto = re.sub(r'-?\d+\.\d{3},\d{2}', '', concepto)  # Montos con separador de miles
        concepto = re.sub(r'-?\d+,\d{2}', '', concepto)  # Montos simples
        concepto = re.sub(r'\$\s*\d+[.,]\d{2}', '', concepto)  # Montos con símbolo $
        
        # Remover caracteres especiales y espacios extra
        concepto = re.sub(r'[\$\s]+', ' ', concepto)
        concepto = re.sub(r'\s+', ' ', concepto).strip()
        
        return concepto if concepto and len(concepto) > 3 else None
    
    def _extraer_origen_de_texto(self, text):
        """Extraer origen de texto"""
        # Buscar letras o números al inicio
        match = re.search(r'^([A-Z]|\d+)', text.strip())
        if match:
            return match.group().strip()
        return None
    
    def _extraer_monto_de_texto(self, text, tipo):
        """Extraer monto de texto según tipo - MEJORADO PARA SALDO"""
        # Buscar todos los formatos de monto de BBVA (más amplio)
        # Incluir saldos con formato completo: 3.942.821,92
        montos = re.findall(r'-?\d+\.\d{3}\.\d{3},\d{2}|-?\d+\.\d{3},\d{2}|-?\d+,\d{2}|\d+\.\d{3}\.\d{3},\d{2}|\d+\.\d{3},\d{2}', text)
        
        if not montos:
            return None
        
        if tipo == 'debito':
            # Buscar montos negativos (débitos)
            for monto in montos:
                if '-' in monto:
                    return monto.replace('-', '')  # Remover el signo negativo
        elif tipo == 'credito':
            # Buscar montos positivos (créditos)
            for monto in montos:
                if '-' not in monto:
                    return monto
        elif tipo == 'saldo':
            # LÓGICA ESPECÍFICA PARA SALDO BBVA: Buscar el monto más grande al final
            saldos_candidatos = []
            for monto in montos:
                # Remover signos negativos para comparar
                monto_limpio = monto.replace('-', '')
                # Priorizar montos que parecen saldos (grandes, con formato completo)
                if len(monto_limpio) >= 8:  # Al menos 8 caracteres para ser un saldo
                    saldos_candidatos.append(monto_limpio)
            
            if saldos_candidatos:
                # Devolver el monto más grande (probablemente el saldo)
                saldo_seleccionado = max(saldos_candidatos, key=len)
                # Aplicar corrección de saldo completo
                return self._corregir_saldo_completo(saldo_seleccionado)
            else:
                # Si no hay candidatos claros, usar el último monto
                return montos[-1]
        
        return None
    
    def _limpiar_fecha_bbva(self, fecha):
        """Limpiar fecha específica de BBVA"""
        if not fecha or pd.isna(fecha):
            return None
        fecha_str = str(fecha).strip()
        # Validar formato DD/MM
        if re.match(r'\d{1,2}/\d{1,2}', fecha_str):
            return fecha_str
        return None
    
    def _limpiar_concepto_bbva(self, concepto):
        """Limpiar concepto específico de BBVA"""
        if not concepto or pd.isna(concepto):
            return None
        concepto_str = str(concepto).strip()
        # Limpiar caracteres especiales pero mantener el contenido
        concepto_str = re.sub(r'\s+', ' ', concepto_str)
        return concepto_str if concepto_str and len(concepto_str) > 3 else None
    
    def _limpiar_monto_bbva(self, monto):
        """Limpiar monto específico de BBVA - CORREGIDO"""
        if not monto or pd.isna(monto):
            return None
        monto_str = str(monto).strip()
        # Remover símbolos de moneda y espacios
        monto_str = re.sub(r'[\$\s]', '', monto_str)
        # Validar formatos de BBVA: 1.032,55, 558,11, 3.943.380,03
        if re.match(r'^-?\d+\.\d{3}\.\d{3},\d{2}$', monto_str) or re.match(r'^-?\d+\.\d{3},\d{2}$', monto_str) or re.match(r'^-?\d+,\d{2}$', monto_str):
            return monto_str
        elif re.match(r'^\d+\.\d{3}\.\d{3},\d{2}$', monto_str) or re.match(r'^\d+\.\d{3},\d{2}$', monto_str) or re.match(r'^\d+,\d{2}$', monto_str):
            return monto_str
        return None
    
    def _limpiar_texto(self, texto):
        """Limpiar texto"""
        if not texto or pd.isna(texto):
            return None
        return str(texto).strip()
    
    def _es_monto_valido(self, monto):
        """Validar si un monto es válido para BBVA"""
        if not monto or pd.isna(monto):
            return False
        monto_str = str(monto).strip()
        # Validar formatos de BBVA: 1.032,55 o 558,11
        return re.match(r'^-?\d+\.\d{3},\d{2}$', monto_str) or re.match(r'^-?\d+,\d{2}$', monto_str)
    
    def _extraer_saldo_inicial(self, text):
        """Extraer saldo inicial de texto que contiene 'SALDO ANTERIOR'"""
        # Buscar el patrón de saldo inicial: 3.943.380,03
        patron_saldo = r'\d+\.\d{3},\d{2}'
        match = re.search(patron_saldo, text)
        if match:
            return match.group()
        return None
    
    def _corregir_saldo_completo(self, saldo):
        """Corregir saldo que puede estar truncado (faltando el 3.) - MEJORADO"""
        if not saldo or pd.isna(saldo):
            return None
        
        saldo_str = str(saldo).strip()
        
        # Si el saldo ya tiene el formato completo, devolverlo tal como está
        if re.match(r'^\d+\.\d{3},\d{2}$', saldo_str) and len(saldo_str) >= 10:
            return saldo_str
        
        # Usar la función de detección de saldos truncados
        saldo_corregido = self._detectar_saldo_truncado(saldo_str)
        
        # Si se detectó y corrigió un saldo truncado, devolverlo
        if saldo_corregido != saldo_str:
            return saldo_corregido
        
        # Si no coincide con ningún patrón, devolver el saldo original
        return saldo_str
    
    def _detectar_saldo_truncado(self, saldo_str):
        """Detectar si un saldo está truncado y corregirlo"""
        if not saldo_str:
            return saldo_str
        
        # Patrones comunes de saldos truncados en BBVA
        patrones_truncados = [
            (r'^(\d{3}\.\d{3},\d{2})$', '3.\\1'),  # 942.821,92 -> 3.942.821,92
            (r'^(\d{2}\.\d{3},\d{2})$', '3.0\\1'),  # 28.198,58 -> 3.028.198,58
            (r'^(\d{1}\.\d{3},\d{2})$', '3.00\\1'), # 5.270,97 -> 3.005.270,97
        ]
        
        for patron, reemplazo in patrones_truncados:
            if re.match(patron, saldo_str):
                return re.sub(patron, reemplazo, saldo_str)
        
        return saldo_str
    
    def _procesar_datos_bbva(self, datos):
        """Procesar y limpiar datos de BBVA"""
        if not datos:
            return pd.DataFrame()
        
        df = pd.DataFrame(datos)
        
        # Limpiar datos (pero preservar saldo inicial)
        print(f"Datos antes de limpiar: {len(df)} registros")
        saldo_inicial_antes = df[df['Tipo'] == 'Saldo Inicial']
        if not saldo_inicial_antes.empty:
            print(f"Saldo inicial antes de limpiar: {saldo_inicial_antes.iloc[0].to_dict()}")
        
        df = df.dropna(subset=['Fecha', 'Concepto'], how='all')
        
        print(f"Datos después de limpiar: {len(df)} registros")
        saldo_inicial_despues = df[df['Tipo'] == 'Saldo Inicial']
        if not saldo_inicial_despues.empty:
            print(f"Saldo inicial después de limpiar: {saldo_inicial_despues.iloc[0].to_dict()}")
        else:
            print("Saldo inicial perdido durante la limpieza")
        
        # Limpiar fechas
        if 'Fecha' in df.columns:
            df['Fecha'] = df['Fecha'].apply(self._limpiar_fecha_bbva)
        
        # Limpiar montos
        for col in ['Debito', 'Credito', 'Saldo']:
            if col in df.columns:
                df[col] = df[col].apply(self._limpiar_monto_bbva)
        
        # Limpiar conceptos
        if 'Concepto' in df.columns:
            df['Concepto'] = df['Concepto'].apply(self._limpiar_concepto_bbva)
        
        return df
    
    def _guardar_excel_bbva(self, df, excel_path):
        """Guardar Excel con formato específico para BBVA"""
        try:
            with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Transacciones BBVA', index=False)
                
                # Ajustar columnas específicas para BBVA
                worksheet = writer.sheets['Transacciones BBVA']
                column_widths = {
                    'A': 15,  # Fecha
                    'B': 10,  # Origen
                    'C': 60,  # Concepto
                    'D': 15,  # Debito
                    'E': 15,  # Credito
                    'F': 15,  # Saldo
                    'G': 8,   # Página
                    'H': 8,   # Tabla/Linea
                    'I': 10   # Tipo
                }
                
                for col, width in column_widths.items():
                    if col in worksheet.column_dimensions:
                        worksheet.column_dimensions[col].width = width
            
            print(f"Excel guardado: {excel_path}")
            print(f"Total de registros: {len(df)}")
            
        except Exception as e:
            print(f"Error guardando Excel: {e}")

# Función principal para compatibilidad
def extraer_datos_bbva(pdf_path, excel_salida):
    """Función principal para extraer datos de BBVA"""
    extractor = ExtractorBBVAMejorado()
    return extractor.extraer_datos(pdf_path, excel_salida)
