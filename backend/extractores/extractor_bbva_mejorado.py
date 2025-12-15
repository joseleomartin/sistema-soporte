#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extractor BBVA - Versión Reconstruida desde Cero
Diseñado para capturar TODAS las transacciones de forma precisa
"""

import pandas as pd
import pdfplumber
import re
from typing import List, Dict, Optional

class ExtractorBBVAMejorado:
    def __init__(self):
        self.bank_name = "Banco BBVA"
        
        # Patrones optimizados
        self.patron_fecha = re.compile(r'\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b')
        # Monto: debe tener coma decimal (formato: 1.234,56 o -1.234,56)
        self.patron_monto = re.compile(r'-?\d{1,3}(?:\.\d{3})*,\d{2}')
        # Saldo: formato grande con múltiples puntos (ej: 46.937.227,09)
        self.patron_saldo = re.compile(r'\d{1,3}(?:\.\d{3}){1,2},\d{2}')
        
        # Palabras que indican headers (excluir)
        # Nota: 'iva' se removió porque aparece en transacciones reales (ej: "IVA TASA GENERAL")
        self.headers = {
            'fecha', 'origen', 'concepto', 'debito', 'credito', 'saldo',
            'movimientos', 'cuentas', 'detalle', 'banco', 'bbva',
            'argentina', 'cuit', 'responsable', 'inscripto',
            'consolidado', 'resumen'
        }
        
        # Patrones que indican headers de tabla (más específicos)
        self.patrones_header = [
            re.compile(r'fecha\s+origen\s+concepto', re.IGNORECASE),
            re.compile(r'debito\s+credito\s+saldo', re.IGNORECASE),
            re.compile(r'banco\s+bbva\s+argentina', re.IGNORECASE),
        ]
    
    def extraer_datos(self, pdf_path: str, excel_salida: str) -> Optional[pd.DataFrame]:
        """Extraer datos del PDF de BBVA y guardar en Excel"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                all_data = []
                
                for page_num, page in enumerate(pdf.pages):
                    print(f"Procesando pagina {page_num + 1}/{len(pdf.pages)}")
                    
                    datos_pagina = self._extraer_de_pagina(page, page_num + 1)
                    if datos_pagina:
                        all_data.extend(datos_pagina)
                        print(f"  Extraidos {len(datos_pagina)} registros")
                
                if all_data:
                    df = self._procesar_y_limpiar_datos(all_data)
                    self._guardar_excel(df, excel_salida)
                    return df
                else:
                    print("No se encontraron datos validos")
                    return None
                    
        except Exception as e:
            print(f"Error extrayendo datos: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def _extraer_de_pagina(self, page, pagina: int) -> List[Dict]:
        """Extraer datos de una página"""
        datos = []
        
        try:
            text = page.extract_text()
            if not text:
                return datos
            
            lines = text.split('\n')
            
            # Agrupar líneas continuadas (transacciones que se dividen en múltiples líneas)
            lineas_agrupadas = self._agrupar_lineas_continuadas(lines)
            
            for linea_num, line in enumerate(lineas_agrupadas, 1):
                line = line.strip()
                
                # Filtrar líneas vacías o muy cortas
                if not line or len(line) < 5:
                    continue
                
                # Procesar línea
                registro = self._procesar_linea(line, pagina, linea_num)
                if registro:
                    datos.append(registro)
        
        except Exception as e:
            print(f"Error procesando pagina {pagina}: {e}")
        
        return datos
    
    def _agrupar_lineas_continuadas(self, lines: List[str]) -> List[str]:
        """Agrupar líneas que pertenecen a la misma transacción"""
        lineas_agrupadas = []
        linea_actual = ""
        fecha_actual = None
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue
            
            # Buscar fecha en la línea
            fecha_match = self.patron_fecha.search(line)
            tiene_montos = bool(self.patron_monto.search(line))
            
            # Verificar si es header (no procesar)
            es_header = False
            palabras = line.lower().split()
            if len(palabras) >= 3:
                palabras_header = sum(1 for p in palabras if p in self.headers)
                if palabras_header >= 3:
                    es_header = True
                # Verificar patrones de header
                for patron in self.patrones_header:
                    if patron.search(line):
                        es_header = True
                        break
            
            if es_header:
                # Si es header, guardar línea anterior y continuar
                if linea_actual:
                    lineas_agrupadas.append(linea_actual)
                    linea_actual = ""
                continue
            
            # Si la línea tiene fecha, es el inicio de una nueva transacción
            if fecha_match:
                # Guardar línea anterior si existe
                if linea_actual:
                    lineas_agrupadas.append(linea_actual)
                # Iniciar nueva línea
                linea_actual = line
                fecha_actual = fecha_match.group()
            # Si no tiene fecha pero tiene montos
            elif tiene_montos:
                if linea_actual:
                    # Agregar a la línea actual (continuación)
                    linea_actual += " " + line
                else:
                    # Línea independiente con montos pero sin fecha - procesarla igual
                    # (ej: "LEY NRO 25.413 SOBRE CREDIT-13.750,44")
                    lineas_agrupadas.append(line)
            # Si no tiene fecha ni montos, pero la línea actual existe, podría ser continuación del concepto
            elif linea_actual and len(line) > 5:
                # Verificar si parece ser continuación (no empieza con número grande, no es header)
                palabras_header = sum(1 for p in palabras if p in self.headers)
                if palabras_header < 2:  # No es header
                    linea_actual += " " + line
            # Si no tiene fecha ni montos y no hay línea actual, podría ser inicio de concepto
            # (esperar a ver si viene una línea con montos)
            elif not linea_actual and len(line) > 10:
                # Verificar si parece inicio de transacción (no es header)
                palabras_header = sum(1 for p in palabras if p in self.headers)
                if palabras_header < 2:
                    # Podría ser inicio de concepto, guardar temporalmente
                    linea_actual = line
        
        # Agregar última línea si existe
        if linea_actual:
            lineas_agrupadas.append(linea_actual)
        
        return lineas_agrupadas
    
    def _procesar_linea(self, texto: str, pagina: int, linea: int) -> Optional[Dict]:
        """Procesar una línea de texto y extraer transacción"""
        texto_original = texto
        texto_lower = texto.lower()
        
        # 1. MANEJAR SALDO ANTERIOR / SALDO INICIAL
        if 'saldo anterior' in texto_lower or 'saldo inicial' in texto_lower:
            saldo = self._extraer_saldo(texto)
            if saldo:
                return {
                    'Fecha': 'SALDO INICIAL',
                    'Origen': '',
                    'Concepto': 'Saldo Anterior',
                    'Debito': None,
                    'Credito': None,
                    'Saldo': saldo,
                    'Pagina': pagina,
                    'Linea': linea,
                    'Tipo': 'Saldo Inicial'
                }
        
        # 2. BUSCAR FECHA (puede estar en cualquier parte del texto)
        fecha_match = self.patron_fecha.search(texto)
        
        # Verificar si tiene montos primero (más importante que la fecha)
        tiene_montos = bool(self.patron_monto.search(texto))
        
        # Si no hay fecha pero hay montos, procesar igual (es una transacción válida)
        if not fecha_match:
            if not tiene_montos:
                # Sin fecha ni montos, no es transacción
                return None
            # Tiene montos pero no fecha - procesar igual
            fecha_match = None
        
        # 3. VERIFICAR SI ES HEADER (solo si NO tiene montos)
        # Si tiene montos, definitivamente es una transacción, no un header
        if tiene_montos:
            # No es header, continuar procesamiento
            pass
        else:
            # Verificar patrones específicos de headers
            for patron in self.patrones_header:
                if patron.search(texto):
                    return None  # Es un header de tabla
            
            # Verificar palabras de header (solo si no tiene montos)
            palabras = texto_lower.split()
            if len(palabras) >= 3:
                palabras_header = sum(1 for p in palabras if p in self.headers)
                # Solo filtrar si tiene muchas palabras de header Y no tiene montos
                if palabras_header >= 3:
                    return None
        
        # Si hay fecha, usarla; si no, intentar extraer de otra forma
        if fecha_match:
            fecha = fecha_match.group()
            fecha_normalizada = self._normalizar_fecha(fecha)
        else:
            # Buscar fecha en cualquier parte del texto (puede estar después del concepto)
            todas_fechas = self.patron_fecha.findall(texto)
            if todas_fechas:
                # Usar la primera fecha encontrada
                fecha = todas_fechas[0]
                fecha_normalizada = self._normalizar_fecha(fecha)
            else:
                # No hay fecha, pero tiene montos - usar fecha vacía o "SIN FECHA"
                fecha = ""
                fecha_normalizada = ""
        
        # 4. BUSCAR MONTOS (buscar de forma más exhaustiva)
        montos_encontrados = list(self.patron_monto.findall(texto))
        
        # Si no se encontraron montos con el patrón estándar, intentar buscar montos pegados al texto
        # (ej: "TRANSFERENCIA 20298122015-2.836.106,00" o "CREDIT-13.750,44")
        if not montos_encontrados:
            # Buscar montos que pueden estar pegados sin espacio: texto-monto
            # Patrón: cualquier carácter alfanumérico seguido directamente de un monto
            patron_monto_pegado = re.compile(r'[A-Z0-9](-?\d{1,3}(?:\.\d{3})*,\d{2})')
            matches_pegados = patron_monto_pegado.findall(texto)
            if matches_pegados:
                montos_encontrados.extend(matches_pegados)
        
        # Eliminar duplicados manteniendo el orden
        montos_encontrados = list(dict.fromkeys(montos_encontrados))
        
        if not montos_encontrados:
            # Sin montos, puede ser una línea informativa
            return None
        
        # 5. IDENTIFICAR DÉBITO, CRÉDITO Y SALDO
        debito = None
        credito = None
        saldo = None
        
        # Limpiar y validar todos los montos
        montos_limpios = []
        for monto_str in montos_encontrados:
            monto_limpio = self._limpiar_monto(monto_str)
            if monto_limpio:
                montos_limpios.append((monto_str, monto_limpio))
        
        if not montos_limpios:
            return None
        
        # El último monto es siempre el saldo (formato estándar BBVA)
        if len(montos_limpios) > 0:
            saldo = montos_limpios[-1][1]
            montos_sin_saldo = montos_limpios[:-1]
        else:
            montos_sin_saldo = []
        
        # Procesar montos que no son saldo (débito o crédito)
        for monto_str, monto_limpio in montos_sin_saldo:
            # Si es negativo, es débito
            if monto_str.startswith('-'):
                if not debito:  # Solo tomar el primero
                    debito = monto_limpio
            else:
                # Si es positivo, es crédito
                if not credito:  # Solo tomar el primero
                    credito = monto_limpio
        
        # Si solo hay un monto y no se asignó como saldo, podría ser débito/crédito
        # (caso especial: transacciones con un solo monto)
        if len(montos_limpios) == 1 and not debito and not credito:
            monto_str, monto_limpio = montos_limpios[0]
            if monto_str.startswith('-'):
                debito = monto_limpio
                saldo = None  # No hay saldo si solo hay un monto
            else:
                credito = monto_limpio
                saldo = None
        
        # 6. EXTRAER ORIGEN
        if fecha:
            origen = self._extraer_origen(texto, fecha)
        else:
            # Si no hay fecha, buscar origen al inicio del texto
            origen = self._extraer_origen_sin_fecha(texto)
        
        # 7. EXTRAER CONCEPTO
        concepto = self._extraer_concepto(texto, fecha if fecha else "", origen, debito, credito, saldo)
        
        # 8. VALIDAR REGISTRO
        # Validar que tenga al menos un monto (débito, crédito o saldo)
        if not debito and not credito and not saldo:
            return None  # Sin montos, no es transacción válida
        
        # Si el concepto es muy corto pero tiene montos, intentar extraer mejor
        if not concepto or len(concepto.strip()) < 3:
            # Si tiene montos, es una transacción válida aunque el concepto sea corto
            # Intentar extraer concepto de forma más permisiva
            concepto_alternativo = self._extraer_concepto_alternativo(texto, fecha if fecha else "", origen)
            if concepto_alternativo and len(concepto_alternativo.strip()) >= 3:
                concepto = concepto_alternativo
            else:
                # Si aún así no hay concepto, pero tiene montos, usar texto limpio
                if debito or credito or saldo:
                    # Limpiar texto pero mantener palabras importantes
                    concepto_temp = texto
                    # Remover fecha
                    if fecha:
                        concepto_temp = concepto_temp.replace(fecha, '', 1)
                    # Remover origen si existe
                    if origen:
                        concepto_temp = re.sub(r'^\s*' + re.escape(origen) + r'\s+', '', concepto_temp, count=1)
                        concepto_temp = re.sub(r'^\s*' + re.escape(origen) + r'\b', '', concepto_temp, count=1)
                    # Remover solo montos, mantener el resto
                    concepto_temp = re.sub(r'-?\d{1,3}(?:\.\d{3})*,\d{2}', '', concepto_temp)
                    concepto_temp = re.sub(r'\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b', '', concepto_temp)
                    concepto_temp = re.sub(r'\s+', ' ', concepto_temp).strip()
                    concepto = concepto_temp[:80] if concepto_temp else "Transaccion sin concepto"
                else:
                    return None
        
        # 9. CREAR REGISTRO
        # Si no hay fecha pero hay montos, usar "SIN FECHA" o dejar vacío
        fecha_final = fecha_normalizada if fecha_normalizada else "SIN FECHA"
        
        registro = {
            'Fecha': fecha_final,
            'Origen': origen or '',
            'Concepto': concepto.strip() if concepto else "Transaccion",
            'Debito': debito,
            'Credito': credito,
            'Saldo': saldo,
            'Pagina': pagina,
            'Linea': linea,
            'Tipo': 'Transaccion'
        }
        
        return registro
    
    def _normalizar_fecha(self, fecha: str) -> str:
        """Normalizar formato de fecha a DD/MM"""
        if '/' not in fecha:
            return fecha
        
        partes = fecha.split('/')
        if len(partes) >= 2:
            dia = partes[0].zfill(2)
            mes = partes[1].zfill(2)
            return f"{dia}/{mes}"
        
        return fecha
    
    def _extraer_saldo(self, texto: str) -> Optional[str]:
        """Extraer saldo de texto que contiene 'SALDO ANTERIOR'"""
        match = self.patron_saldo.search(texto)
        if match:
            return self._limpiar_monto(match.group())
        
        # También buscar cualquier monto grande
        montos = self.patron_monto.findall(texto)
        if montos:
            # El más grande probablemente es el saldo
            return self._limpiar_monto(max(montos, key=len))
        
        return None
    
    def _extraer_origen(self, texto: str, fecha: str) -> Optional[str]:
        """Extraer origen (código corto después de la fecha)"""
        # Buscar posición de la fecha
        pos_fecha = texto.find(fecha)
        if pos_fecha == -1:
            return None
        
        # Texto después de la fecha
        texto_despues = texto[pos_fecha + len(fecha):].strip()
        
        if not texto_despues:
            return None
        
        # Primero intentar detectar patrones como "D 587", "D 500", etc. (letra + número)
        match = re.search(r'^([A-Z]\s*\d{1,4})\b', texto_despues)
        if match:
            origen = match.group(1).replace(' ', '')
            if 1 <= len(origen) <= 6:
                return origen
        
        # Si no se encontró el patrón, buscar palabra simple
        palabras = texto_despues.split()
        if palabras:
            primera = palabras[0].strip()
            # Limpiar caracteres especiales
            primera_limpia = re.sub(r'[^\w]', '', primera)
            
            # Si es corta y alfanumérica, probablemente es origen
            if 1 <= len(primera_limpia) <= 5 and primera_limpia.isalnum():
                return primera_limpia
        
        return None
    
    def _extraer_origen_sin_fecha(self, texto: str) -> Optional[str]:
        """Extraer origen cuando no hay fecha visible (buscar al inicio)"""
        # Buscar patrones comunes de origen al inicio: "D 500", "D 587", etc.
        match = re.search(r'^([A-Z]\s*\d{1,4})\b', texto)
        if match:
            origen = match.group(1).replace(' ', '')
            if 1 <= len(origen) <= 6:
                return origen
        
        # Buscar cualquier código corto alfanumérico al inicio
        palabras = texto.split()
        if palabras:
            primera = palabras[0].strip()
            primera_limpia = re.sub(r'[^\w]', '', primera)
            if 1 <= len(primera_limpia) <= 5 and primera_limpia.isalnum():
                return primera_limpia
        
        return None
    
    def _extraer_concepto(
        self, 
        texto: str, 
        fecha: str, 
        origen: Optional[str],
        debito: Optional[str],
        credito: Optional[str],
        saldo: Optional[str]
    ) -> Optional[str]:
        """Extraer concepto limpiando fechas, origen y montos"""
        concepto = texto
        
        # Remover fecha (solo la primera ocurrencia) si existe
        if fecha:
            concepto = concepto.replace(fecha, '', 1)
        
        # Remover origen si existe (solo la primera ocurrencia)
        if origen:
            # Buscar y remover origen al inicio (después de fecha)
            # Intentar con espacios: "D587 " o "D 587 "
            concepto = re.sub(r'^\s*' + re.escape(origen) + r'\s+', '', concepto, count=1)
            # También intentar sin espacios pero con límite de palabra
            concepto = re.sub(r'^\s*' + re.escape(origen) + r'\b', '', concepto, count=1)
            # Si el origen tiene formato "D587", también intentar "D 587"
            if len(origen) > 1 and origen[0].isalpha() and origen[1:].isdigit():
                origen_con_espacio = origen[0] + ' ' + origen[1:]
                concepto = re.sub(r'^\s*' + re.escape(origen_con_espacio) + r'\s+', '', concepto, count=1)
        
        # Remover todos los montos (pero mantener el formato)
        # Primero remover saldo si existe
        if saldo:
            concepto = concepto.replace(saldo, '')
        
        # Remover débito y crédito
        if debito:
            concepto = concepto.replace(f"-{debito}", '')
            concepto = concepto.replace(debito, '')
        if credito:
            concepto = concepto.replace(credito, '')
        
        # Remover cualquier monto restante con regex
        concepto = re.sub(r'-?\d{1,3}(?:\.\d{3})*,\d{2}', '', concepto)
        
        # Remover fechas que puedan quedar (formato DD/MM/YYYY)
        concepto = re.sub(r'\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b', '', concepto)
        
        # Remover números sueltos largos al final (códigos de referencia)
        # Pero mantener números que sean parte de palabras (ej: "TR.NE4005246", "25.413")
        concepto = re.sub(r'\b\d{6,}\b', '', concepto)  # Números muy largos sueltos
        
        # Limpiar espacios múltiples
        concepto = re.sub(r'\s+', ' ', concepto)
        concepto = concepto.strip()
        
        # Remover caracteres especiales al inicio/fin
        concepto = concepto.strip(' -/.,:')
        
        return concepto if concepto and len(concepto) > 2 else None
    
    def _extraer_concepto_alternativo(
        self, 
        texto: str, 
        fecha: str, 
        origen: Optional[str]
    ) -> Optional[str]:
        """Método alternativo para extraer concepto cuando el método principal falla"""
        concepto = texto
        
        # Remover fecha si existe
        if fecha:
            concepto = concepto.replace(fecha, '', 1)
        
        # Remover origen
        if origen:
            concepto = re.sub(r'^\s*' + re.escape(origen) + r'\s+', '', concepto, count=1)
        
        # Remover solo montos grandes (saldos), mantener montos pequeños que puedan ser parte del concepto
        concepto = re.sub(r'\d{1,3}(?:\.\d{3}){2,},\d{2}', '', concepto)  # Saldos grandes
        
        # Limpiar espacios
        concepto = re.sub(r'\s+', ' ', concepto)
        concepto = concepto.strip()
        
        return concepto if concepto and len(concepto) >= 3 else None
    
    def _limpiar_monto(self, monto: str) -> Optional[str]:
        """Limpiar y normalizar monto"""
        if not monto:
            return None
        
        monto_str = str(monto).strip()
        
        # Remover espacios y símbolos
        monto_str = re.sub(r'[\s\$]', '', monto_str)
        
        # Remover signo negativo (se maneja por separado)
        es_negativo = monto_str.startswith('-')
        if es_negativo:
            monto_str = monto_str[1:]
        
        # Validar formato: debe tener coma decimal
        if re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', monto_str):
            return monto_str
        
        return None
    
    def _procesar_y_limpiar_datos(self, datos: List[Dict]) -> pd.DataFrame:
        """Procesar y limpiar datos extraídos"""
        if not datos:
            return pd.DataFrame()
        
        df = pd.DataFrame(datos)
        
        # Eliminar duplicados exactos
        df = df.drop_duplicates()
        
        # Ordenar por página y línea
        if 'Pagina' in df.columns and 'Linea' in df.columns:
            df = df.sort_values(['Pagina', 'Linea'])
        
        # Limpiar valores NaN
        df['Concepto'] = df['Concepto'].fillna('')
        df['Origen'] = df['Origen'].fillna('')
        
        return df
    
    def _guardar_excel(self, df: pd.DataFrame, excel_path: str):
        """Guardar DataFrame en Excel con formato"""
        try:
            with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Transacciones BBVA', index=False)
                
                # Ajustar ancho de columnas
                worksheet = writer.sheets['Transacciones BBVA']
                column_widths = {
                    'A': 12,  # Fecha
                    'B': 8,   # Origen
                    'C': 50,  # Concepto
                    'D': 15,  # Debito
                    'E': 15,  # Credito
                    'F': 18,  # Saldo
                    'G': 8,   # Pagina
                    'H': 8,   # Linea
                    'I': 12   # Tipo
                }
                
                for col, width in column_widths.items():
                    if col in worksheet.column_dimensions:
                        worksheet.column_dimensions[col].width = width
            
            print(f"Excel guardado: {excel_path}")
            print(f"Total de registros: {len(df)}")
            
        except Exception as e:
            print(f"Error guardando Excel: {e}")
            import traceback
            traceback.print_exc()

# Función principal para compatibilidad
def extraer_datos_bbva(pdf_path: str, excel_salida: str) -> Optional[pd.DataFrame]:
    """Función principal para extraer datos de BBVA"""
    extractor = ExtractorBBVAMejorado()
    return extractor.extraer_datos(pdf_path, excel_salida)
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extractor BBVA - Versión Reconstruida desde Cero
Diseñado para capturar TODAS las transacciones de forma precisa
"""

import pandas as pd
import pdfplumber
import re
from typing import List, Dict, Optional

class ExtractorBBVAMejorado:
    def __init__(self):
        self.bank_name = "Banco BBVA"
        
        # Patrones optimizados
        self.patron_fecha = re.compile(r'\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b')
        # Monto: debe tener coma decimal (formato: 1.234,56 o -1.234,56)
        self.patron_monto = re.compile(r'-?\d{1,3}(?:\.\d{3})*,\d{2}')
        # Saldo: formato grande con múltiples puntos (ej: 46.937.227,09)
        self.patron_saldo = re.compile(r'\d{1,3}(?:\.\d{3}){1,2},\d{2}')
        
        # Palabras que indican headers (excluir)
        self.headers = {
            'fecha', 'origen', 'concepto', 'debito', 'credito', 'saldo',
            'movimientos', 'cuentas', 'detalle', 'banco', 'bbva',
            'argentina', 'cuit', 'iva', 'responsable', 'inscripto',
            'consolidado', 'resumen'
        }
    
    def extraer_datos(self, pdf_path: str, excel_salida: str) -> Optional[pd.DataFrame]:
        """Extraer datos del PDF de BBVA y guardar en Excel"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                all_data = []
                
                for page_num, page in enumerate(pdf.pages):
                    print(f"Procesando pagina {page_num + 1}/{len(pdf.pages)}")
                    
                    datos_pagina = self._extraer_de_pagina(page, page_num + 1)
                    if datos_pagina:
                        all_data.extend(datos_pagina)
                        print(f"  Extraidos {len(datos_pagina)} registros")
                
                if all_data:
                    df = self._procesar_y_limpiar_datos(all_data)
                    self._guardar_excel(df, excel_salida)
                    return df
                else:
                    print("No se encontraron datos validos")
                    return None
                    
        except Exception as e:
            print(f"Error extrayendo datos: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def _extraer_de_pagina(self, page, pagina: int) -> List[Dict]:
        """Extraer datos de una página"""
        datos = []
        
        try:
            text = page.extract_text()
            if not text:
                return datos
            
            lines = text.split('\n')
            
            for linea_num, line in enumerate(lines, 1):
                line = line.strip()
                
                # Filtrar líneas vacías o muy cortas
                if not line or len(line) < 5:
                    continue
                
                # Procesar línea
                registro = self._procesar_linea(line, pagina, linea_num)
                if registro:
                    datos.append(registro)
        
        except Exception as e:
            print(f"Error procesando pagina {pagina}: {e}")
        
        return datos
    
    def _procesar_linea(self, texto: str, pagina: int, linea: int) -> Optional[Dict]:
        """Procesar una línea de texto y extraer transacción"""
        texto_original = texto
        texto_lower = texto.lower()
        
        # 1. MANEJAR SALDO ANTERIOR / SALDO INICIAL
        if 'saldo anterior' in texto_lower or 'saldo inicial' in texto_lower:
            saldo = self._extraer_saldo(texto)
            if saldo:
                return {
                    'Fecha': 'SALDO INICIAL',
                    'Origen': '',
                    'Concepto': 'Saldo Anterior',
                    'Debito': None,
                    'Credito': None,
                    'Saldo': saldo,
                    'Pagina': pagina,
                    'Linea': linea,
                    'Tipo': 'Saldo Inicial'
                }
        
        # 2. VERIFICAR SI ES HEADER
        palabras = texto_lower.split()
        if len(palabras) >= 3:
            palabras_header = sum(1 for p in palabras if p in self.headers)
            if palabras_header >= 3:  # Si tiene 3+ palabras de header, es header
                return None
        
        # 3. BUSCAR FECHA (requisito obligatorio)
        fecha_match = self.patron_fecha.search(texto)
        if not fecha_match:
            return None  # Sin fecha, no es transacción
        
        fecha = fecha_match.group()
        fecha_normalizada = self._normalizar_fecha(fecha)
        
        # 4. BUSCAR MONTOS
        montos_encontrados = self.patron_monto.findall(texto)
        
        if not montos_encontrados:
            # Sin montos, puede ser una línea informativa
            return None
        
        # 5. IDENTIFICAR DÉBITO, CRÉDITO Y SALDO
        debito = None
        credito = None
        saldo = None
        
        # El último monto es siempre el saldo
        if len(montos_encontrados) > 0:
            saldo = self._limpiar_monto(montos_encontrados[-1])
            montos_sin_saldo = montos_encontrados[:-1]
        else:
            montos_sin_saldo = []
        
        # Procesar montos que no son saldo
        for monto_str in montos_sin_saldo:
            monto_limpio = self._limpiar_monto(monto_str)
            if not monto_limpio:
                continue
            
            # Si es negativo, es débito
            if monto_str.startswith('-'):
                if not debito:  # Solo tomar el primero
                    debito = monto_limpio
            else:
                # Si es positivo, es crédito
                if not credito:  # Solo tomar el primero
                    credito = monto_limpio
        
        # 6. EXTRAER ORIGEN
        origen = self._extraer_origen(texto, fecha)
        
        # 7. EXTRAER CONCEPTO
        concepto = self._extraer_concepto(texto, fecha, origen, debito, credito, saldo)
        
        # 8. VALIDAR REGISTRO
        if not concepto or len(concepto.strip()) < 3:
            return None
        
        # Validar que tenga al menos un monto (débito, crédito o saldo)
        if not debito and not credito and not saldo:
            return None  # Sin montos, no es transacción válida
        
        # 9. CREAR REGISTRO
        registro = {
            'Fecha': fecha_normalizada,
            'Origen': origen or '',
            'Concepto': concepto.strip(),
            'Debito': debito,
            'Credito': credito,
            'Saldo': saldo,
            'Pagina': pagina,
            'Linea': linea,
            'Tipo': 'Transaccion'
        }
        
        return registro
    
    def _normalizar_fecha(self, fecha: str) -> str:
        """Normalizar formato de fecha a DD/MM"""
        if '/' not in fecha:
            return fecha
        
        partes = fecha.split('/')
        if len(partes) >= 2:
            dia = partes[0].zfill(2)
            mes = partes[1].zfill(2)
            return f"{dia}/{mes}"
        
        return fecha
    
    def _extraer_saldo(self, texto: str) -> Optional[str]:
        """Extraer saldo de texto que contiene 'SALDO ANTERIOR'"""
        match = self.patron_saldo.search(texto)
        if match:
            return self._limpiar_monto(match.group())
        
        # También buscar cualquier monto grande
        montos = self.patron_monto.findall(texto)
        if montos:
            # El más grande probablemente es el saldo
            return self._limpiar_monto(max(montos, key=len))
        
        return None
    
    def _extraer_origen(self, texto: str, fecha: str) -> Optional[str]:
        """Extraer origen (código corto después de la fecha)"""
        # Buscar posición de la fecha
        pos_fecha = texto.find(fecha)
        if pos_fecha == -1:
            return None
        
        # Texto después de la fecha
        texto_despues = texto[pos_fecha + len(fecha):].strip()
        
        if not texto_despues:
            return None
        
        # Origen suele ser corto (1-5 caracteres) y alfanumérico
        palabras = texto_despues.split()
        if palabras:
            primera = palabras[0].strip()
            # Limpiar caracteres especiales
            primera_limpia = re.sub(r'[^\w]', '', primera)
            
            # Si es corta y alfanumérica, probablemente es origen
            if 1 <= len(primera_limpia) <= 5 and primera_limpia.isalnum():
                return primera_limpia
        
        return None
    
    def _extraer_concepto(
        self, 
        texto: str, 
        fecha: str, 
        origen: Optional[str],
        debito: Optional[str],
        credito: Optional[str],
        saldo: Optional[str]
    ) -> Optional[str]:
        """Extraer concepto limpiando fechas, origen y montos"""
        concepto = texto
        
        # Remover fecha (solo la primera ocurrencia)
        concepto = concepto.replace(fecha, '', 1)
        
        # Remover origen si existe (solo la primera ocurrencia)
        if origen:
            # Buscar y remover origen al inicio (después de fecha)
            concepto = re.sub(r'^\s*' + re.escape(origen) + r'\s+', '', concepto, count=1)
            # También intentar sin espacios
            concepto = re.sub(r'^\s*' + re.escape(origen) + r'\b', '', concepto, count=1)
        
        # Remover todos los montos (pero mantener el formato)
        # Primero remover saldo si existe
        if saldo:
            concepto = concepto.replace(saldo, '')
        
        # Remover débito y crédito
        if debito:
            concepto = concepto.replace(f"-{debito}", '')
            concepto = concepto.replace(debito, '')
        if credito:
            concepto = concepto.replace(credito, '')
        
        # Remover cualquier monto restante con regex
        concepto = re.sub(r'-?\d{1,3}(?:\.\d{3})*,\d{2}', '', concepto)
        
        # Remover fechas que puedan quedar (formato DD/MM/YYYY)
        concepto = re.sub(r'\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b', '', concepto)
        
        # Remover números sueltos largos al final (códigos de referencia)
        # Pero mantener números que sean parte de palabras (ej: "TR.NE4005246", "25.413")
        concepto = re.sub(r'\b\d{6,}\b', '', concepto)  # Números muy largos sueltos
        
        # Limpiar espacios múltiples
        concepto = re.sub(r'\s+', ' ', concepto)
        concepto = concepto.strip()
        
        # Remover caracteres especiales al inicio/fin
        concepto = concepto.strip(' -/.,:')
        
        return concepto if concepto and len(concepto) > 2 else None
    
    def _limpiar_monto(self, monto: str) -> Optional[str]:
        """Limpiar y normalizar monto"""
        if not monto:
            return None
        
        monto_str = str(monto).strip()
        
        # Remover espacios y símbolos
        monto_str = re.sub(r'[\s\$]', '', monto_str)
        
        # Remover signo negativo (se maneja por separado)
        es_negativo = monto_str.startswith('-')
        if es_negativo:
            monto_str = monto_str[1:]
        
        # Validar formato: debe tener coma decimal
        if re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', monto_str):
            return monto_str
        
        return None
    
    def _procesar_y_limpiar_datos(self, datos: List[Dict]) -> pd.DataFrame:
        """Procesar y limpiar datos extraídos"""
        if not datos:
            return pd.DataFrame()
        
        df = pd.DataFrame(datos)
        
        # Eliminar duplicados exactos
        df = df.drop_duplicates()
        
        # Ordenar por página y línea
        if 'Pagina' in df.columns and 'Linea' in df.columns:
            df = df.sort_values(['Pagina', 'Linea'])
        
        # Limpiar valores NaN
        df['Concepto'] = df['Concepto'].fillna('')
        df['Origen'] = df['Origen'].fillna('')
        
        return df
    
    def _guardar_excel(self, df: pd.DataFrame, excel_path: str):
        """Guardar DataFrame en Excel con formato"""
        try:
            with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Transacciones BBVA', index=False)
                
                # Ajustar ancho de columnas
                worksheet = writer.sheets['Transacciones BBVA']
                column_widths = {
                    'A': 12,  # Fecha
                    'B': 8,   # Origen
                    'C': 50,  # Concepto
                    'D': 15,  # Debito
                    'E': 15,  # Credito
                    'F': 18,  # Saldo
                    'G': 8,   # Pagina
                    'H': 8,   # Linea
                    'I': 12   # Tipo
                }
                
                for col, width in column_widths.items():
                    if col in worksheet.column_dimensions:
                        worksheet.column_dimensions[col].width = width
            
            print(f"Excel guardado: {excel_path}")
            print(f"Total de registros: {len(df)}")
            
        except Exception as e:
            print(f"Error guardando Excel: {e}")
            import traceback
            traceback.print_exc()

# Función principal para compatibilidad
def extraer_datos_bbva(pdf_path: str, excel_salida: str) -> Optional[pd.DataFrame]:
    """Función principal para extraer datos de BBVA"""
    extractor = ExtractorBBVAMejorado()
    return extractor.extraer_datos(pdf_path, excel_salida)
