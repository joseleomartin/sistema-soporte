#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pdfplumber
import pytesseract
import cv2
import numpy as np
from PIL import Image
import io
import os
import pandas as pd
from datetime import datetime

# Configurar Tesseract
def configurar_tesseract():
    """Configura Tesseract y detecta idiomas disponibles."""
    rutas_posibles = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    
    tesseract_path = None
    for ruta in rutas_posibles:
        if os.path.exists(ruta):
            pytesseract.pytesseract.tesseract_cmd = ruta
            tesseract_path = ruta
            print(f"+ Tesseract configurado en: {ruta}")
            break
    
    if not tesseract_path:
        print("- Tesseract no encontrado")
        return False, None
    
    try:
        idiomas = pytesseract.get_languages()
        print(f"Idiomas disponibles: {idiomas}")
        
        if 'spa' in idiomas:
            print("+ Español disponible")
            return True, 'spa'
        elif 'eng' in idiomas:
            print("+ Inglés disponible")
            return True, 'eng'
        else:
            print("+ Usando idioma por defecto")
            return True, None
    except Exception as e:
        print(f"- Error configurando idiomas: {e}")
        return True, None

def extraer_texto_pdf_ocr(pdf_path, pdf_output_path=None, max_paginas=50):
    """
    Convertir PDF de imagen a PDF con texto copiable completo.
    Método simple y directo.
    """
    print(f"📄 Convirtiendo PDF de imagen a PDF copiable: {pdf_path}")
    
    if not pdf_output_path:
        raise Exception("Se requiere ruta de salida para generar PDF")
    
    # Método 1: Intentar ocrmypdf (el mejor y más simple)
    ocrmypdf_funciono = False
    try:
        print("🔧 Intentando ocrmypdf (método recomendado)...")
        import ocrmypdf
        from pathlib import Path
        
        input_pdf = Path(pdf_path)
        output_pdf = Path(pdf_output_path)
        
        # Ejecutar OCR simple - ocrmypdf hace todo automáticamente
        ocrmypdf.ocr(
            input_pdf,
            output_pdf,
            language="spa",       # español
            force_ocr=True,       # forzar OCR en todas las páginas
            skip_text=False,      # procesar todas las páginas
            clean=False,          # NO limpiar (preservar original)
            remove_background=False,
            deskew=False,
            rotate_pages=False,
            optimize=0,
            output_type="pdf",
        )
        
        if os.path.exists(pdf_output_path):
            print(f"✅ PDF copiable generado exitosamente con ocrmypdf: {pdf_output_path}")
            ocrmypdf_funciono = True
            return True
            
    except ImportError:
        print("⚠️ ocrmypdf no está instalado, usando método alternativo...")
        ocrmypdf_funciono = False
    except Exception as e:
        error_msg = str(e).lower()
        if 'gswin64c' in error_msg or 'gs' in error_msg or 'ghostscript' in error_msg or 'could not find program' in error_msg:
            print(f"⚠️ ocrmypdf requiere Ghostscript (no instalado)")
            print("🔄 Usando método alternativo sin Ghostscript...")
        else:
            print(f"⚠️ Error con ocrmypdf: {e}")
            print("🔄 Usando método alternativo...")
        ocrmypdf_funciono = False
    
    # Método 2: PyMuPDF + Tesseract (sin necesidad de Ghostscript)
    if not ocrmypdf_funciono:
        try:
            print("🔧 Usando PyMuPDF + Tesseract (método alternativo)...")
            return convertir_pdf_con_pymupdf(pdf_path, pdf_output_path, max_paginas)
        except Exception as e2:
            print(f"❌ Error en método alternativo: {e2}")
            raise Exception(f"No se pudo convertir el PDF. Error: {e2}")
    
    return False

def convertir_pdf_con_pymupdf(pdf_path, pdf_output_path, max_paginas=50):
    """
    Convertir PDF de imagen al MISMO PDF pero copiable.
    Mantiene el PDF visualmente idéntico, solo agrega texto copiable.
    """
    try:
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
        import io
        
        print("📋 Copiando PDF original (idéntico visualmente)...")
        
        # Configurar Tesseract
        tesseract_ok, idioma = configurar_tesseract()
        if not tesseract_ok:
            raise Exception("Tesseract OCR no está disponible")
        
        # Abrir PDF original
        doc_original = fitz.open(pdf_path)
        
        # Crear nuevo PDF (copia EXACTA del original)
        doc_nuevo = fitz.open()
        
        # COPIAR todas las páginas originales EXACTAMENTE como están
        doc_nuevo.insert_pdf(doc_original)
        print(f"✅ Copiadas {len(doc_nuevo)} páginas del PDF original (idénticas)")
        
        total_paginas = min(len(doc_original), max_paginas) if max_paginas else len(doc_original)
        print(f"🔍 Agregando texto copiable a {total_paginas} páginas...")
        
        # Procesar cada página: agregar texto OCR invisible pero copiable
        for num_pagina in range(total_paginas):
            print(f"   Procesando página {num_pagina + 1}/{total_paginas}...")
            
            pagina_original = doc_original[num_pagina]
            pagina_nueva = doc_nuevo[num_pagina]
            
            # Renderizar página como imagen para OCR
            mat = fitz.Matrix(2.0, 2.0)  # 2x zoom para mejor calidad OCR
            pix = pagina_original.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            
            # Hacer OCR con Tesseract - usar múltiples modos para capturar TODO
            configs = [
                f'--oem 3 --psm 3',  # Automático (mejor para tablas)
                f'--oem 3 --psm 6',  # Bloque uniforme
                f'--oem 3 --psm 11', # Texto disperso
            ]
            
            if idioma:
                configs = [config + f' -l {idioma}' for config in configs]
            
            # Extraer TODO el texto usando el mejor resultado
            textos_encontrados = []
            for config in configs:
                try:
                    texto = pytesseract.image_to_string(img, config=config)
                    if texto.strip():
                        textos_encontrados.append(texto.strip())
                except:
                    continue
            
            # Extraer TODO el texto con POSICIONES EXACTAS para recrear el PDF completo
            # Usar múltiples modos PSM para capturar TODO (tablas, texto, números, etc.)
            configs_psm = [3, 6, 11]  # Automático, bloque uniforme, texto disperso
            
            # Combinar datos de todos los modos para capturar TODO
            todos_los_datos = []
            
            for psm in configs_psm:
                try:
                    config = f'--oem 3 --psm {psm}'
                    if idioma:
                        config += f' -l {idioma}'
                    
                    data_ocr = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT, config=config)
                    
                    # Agregar todos los datos encontrados
                    for i in range(len(data_ocr['text'])):
                        texto = data_ocr['text'][i].strip()
                        if texto and texto != '':
                            todos_los_datos.append({
                                'text': texto,
                                'left': data_ocr['left'][i],
                                'top': data_ocr['top'][i],
                                'height': data_ocr['height'][i],
                                'width': data_ocr['width'][i],
                                'conf': data_ocr['conf'][i]
                            })
                except:
                    continue
            
            # Eliminar duplicados exactos (mismo texto en misma posición)
            datos_unicos = []
            vistos = set()
            for dato in todos_los_datos:
                clave = (dato['text'], round(dato['left'] / 10) * 10, round(dato['top'] / 10) * 10)
                if clave not in vistos:
                    vistos.add(clave)
                    datos_unicos.append(dato)
            
            # Agrupar palabras por líneas para mantener formato
            lineas_dict = {}  # {y_linea: [(x, texto, conf, height)]}
            
            for dato in datos_unicos:
                if dato['conf'] > 15:  # Umbral bajo para capturar TODO
                    # Coordenadas en imagen (zoom 2x)
                    x_img = dato['left']
                    y_img = dato['top']
                    h_img = dato['height']
                    
                    # Convertir a coordenadas PDF (dividir por zoom)
                    x_pdf = x_img / 2.0
                    y_pdf = y_img / 2.0
                    h_pdf = h_img / 2.0
                    
                    # Agrupar por línea (mismo Y aproximadamente)
                    y_linea = round(y_pdf / 3) * 3  # Agrupación más precisa
                    
                    if y_linea not in lineas_dict:
                        lineas_dict[y_linea] = []
                    lineas_dict[y_linea].append((x_pdf, dato['text'], dato['conf'], h_pdf))
            
            # Ordenar líneas y palabras dentro de cada línea
            lineas_ordenadas = sorted(lineas_dict.items(), key=lambda item: item[0])
            
            # Insertar texto en las POSICIONES EXACTAS donde aparece en el original
            texto_completo_backup = []  # Para insertar también como bloque completo
            
            for y_linea, palabras in lineas_ordenadas:
                palabras.sort(key=lambda p: p[0])  # Ordenar por X (izquierda a derecha)
                
                # Construir texto de la línea (respetar espacios para tablas)
                texto_parts = []
                x_anterior = None
                for x_pos, texto, conf, h in palabras:
                    # Si hay gran espacio entre palabras (columna de tabla), mantener espacios
                    if x_anterior is not None and (x_pos - x_anterior) > 20:
                        texto_parts.append('  ')  # Espacios extra para columnas
                    texto_parts.append(texto)
                    x_anterior = x_pos + len(texto) * 5  # Estimación ancho
                
                texto_linea = ''.join(texto_parts)
                texto_completo_backup.append(texto_linea)
                
                # Calcular posición de la línea
                x_primera = palabras[0][0]
                h_promedio = sum([p[3] for p in palabras]) / len(palabras)
                y_posicion = y_linea + h_promedio
                
                # Insertar texto en la posición EXACTA donde aparece en el original
                try:
                    pagina_nueva.insert_text(
                        (x_primera, y_posicion),
                        texto_linea,
                        fontsize=max(6, h_promedio * 0.9),
                        color=(0.9999, 0.9999, 0.9999),
                    )
                except Exception as e:
                    try:
                        pagina_nueva.insert_text(
                            (x_primera, y_posicion),
                            texto_linea,
                            fontsize=8,
                            color=(0.9999, 0.9999, 0.9999),
                        )
                    except:
                        pass
            
            # Insertar TODO el texto completo como backup en múltiples posiciones
            # Esto asegura que TODO sea copiable, incluso si hay errores de posicionamiento
            if texto_completo_backup:
                texto_backup_completo = '\n'.join(texto_completo_backup)
                
                # Posición 1: Fuera de vista (backup principal)
                try:
                    pagina_nueva.insert_text(
                        (-1000, -1000),
                        texto_backup_completo,
                        fontsize=1,
                        color=(1, 1, 1),
                    )
                except:
                    pass
                
                # Posición 2: En esquina superior (backup adicional)
                try:
                    rect_pagina = pagina_nueva.rect
                    pagina_nueva.insert_text(
                        (5, 10),
                        texto_backup_completo,
                        fontsize=1,
                        color=(0.999, 0.999, 0.999),
                    )
                except:
                    pass
                
                print(f"      ✓ TODO el texto recreado ({len(texto_completo_backup)} líneas, {len(texto_backup_completo)} caracteres)")
        
        # Guardar PDF preservando estructura original
        doc_nuevo.save(pdf_output_path, garbage=0, deflate=False)
        doc_nuevo.close()
        doc_original.close()
        
        if os.path.exists(pdf_output_path):
            print(f"✅ PDF copiable generado: {pdf_output_path}")
            print("✅ PDF idéntico visualmente al original")
            print("✅ Todo el texto es copiable (invisible pero seleccionable)")
            return True
        else:
            raise Exception("No se pudo generar el archivo PDF")
            
    except ImportError:
        raise Exception("PyMuPDF (pymupdf) no está instalado. Instalar con: pip install pymupdf")
    except Exception as e:
        print(f"❌ Error en método alternativo: {e}")
        raise
