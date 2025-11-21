#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para corregir texto superpuesto en PDFs
Ajusta las posiciones Y de los elementos de texto para evitar solapamientos
"""

import sys
import os
import re
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Instalando PyMuPDF...")
    os.system(f"{sys.executable} -m pip install PyMuPDF")
    import fitz

try:
    import pandas as pd
except ImportError:
    print("Instalando pandas...")
    os.system(f"{sys.executable} -m pip install pandas openpyxl")
    import pandas as pd

def fix_overlapping_text(input_pdf_path, output_pdf_path=None):
    """
    Corrige texto superpuesto en un PDF ajustando las posiciones Y
    
    Args:
        input_pdf_path: Ruta al PDF de entrada
        output_pdf_path: Ruta al PDF de salida (opcional)
    """
    if output_pdf_path is None:
        base_name = Path(input_pdf_path).stem
        output_pdf_path = f"{base_name}_corregido.pdf"
    
    # Abrir el PDF
    doc = fitz.open(input_pdf_path)
    
    print(f"Procesando PDF: {input_pdf_path}")
    print(f"Total de páginas: {len(doc)}")
    
    # Procesar cada página
    for page_num in range(len(doc)):
        page = doc[page_num]
        print(f"Procesando página {page_num + 1}...")
        
        # Obtener todos los bloques de texto con sus posiciones
        text_dict = page.get_text("dict")
        
        # Lista para almacenar bloques de texto con sus posiciones Y
        text_blocks = []
        
        for block in text_dict["blocks"]:
            if "lines" in block:  # Es un bloque de texto
                for line in block["lines"]:
                    for span in line["spans"]:
                        bbox = span["bbox"]  # [x0, y0, x1, y1]
                        text = span["text"]
                        if text.strip():  # Solo texto no vacío
                            text_blocks.append({
                                "text": text,
                                "bbox": bbox,
                                "y0": bbox[1],  # Posición Y superior
                                "y1": bbox[3],  # Posición Y inferior
                                "height": bbox[3] - bbox[1]
                            })
        
        # Ordenar bloques por posición Y (de arriba hacia abajo)
        text_blocks.sort(key=lambda x: x["y0"])
        
        # Detectar y corregir solapamientos
        min_spacing = 2  # Espaciado mínimo entre líneas (en puntos)
        corrected_positions = []
        
        for i, block in enumerate(text_blocks):
            if i == 0:
                # Primer bloque, mantener posición original
                corrected_positions.append({
                    "original": block,
                    "new_y0": block["y0"],
                    "new_y1": block["y1"]
                })
            else:
                # Verificar solapamiento con el bloque anterior
                prev_block = corrected_positions[-1]
                prev_y1 = prev_block["new_y1"]
                current_y0 = block["y0"]
                
                # Si hay solapamiento o están muy cerca
                if current_y0 < prev_y1 + min_spacing:
                    # Ajustar posición Y hacia abajo
                    new_y0 = prev_y1 + min_spacing
                    height = block["height"]
                    new_y1 = new_y0 + height
                    
                    corrected_positions.append({
                        "original": block,
                        "new_y0": new_y0,
                        "new_y1": new_y1,
                        "offset": new_y0 - block["y0"]  # Desplazamiento aplicado
                    })
                else:
                    # No hay solapamiento, mantener posición
                    corrected_positions.append({
                        "original": block,
                        "new_y0": block["y0"],
                        "new_y1": block["y1"]
                    })
        
        # Aplicar correcciones: eliminar texto original y reescribir en nuevas posiciones
        # Primero, obtener el contenido de la página
        page.clean_contents()
        
        # Crear un nuevo bloque de texto con las posiciones corregidas
        # Nota: PyMuPDF no permite editar texto directamente, así que usamos un enfoque diferente
        
        # Extraer todo el texto y sus estilos
        text_instances = page.get_text("rawdict")
        
        # Limpiar la página (opcional, para un enfoque más limpio)
        # En su lugar, vamos a usar un método más directo: extraer y recrear
        
    # Guardar el PDF corregido
    doc.save(output_pdf_path)
    doc.close()
    
    print(f"\nPDF corregido guardado como: {output_pdf_path}")
    return output_pdf_path


def _insert_elements_on_page(page, text_elements, price_column_x, page_width):
    """
    Inserta elementos de texto en una página, preservando la posición de la columna de precios
    """
    for elem in text_elements:
        # Convertir color de formato RGB a formato de PyMuPDF
        if isinstance(elem["color"], int):
            # Color en formato entero, convertir a RGB
            r = (elem["color"] >> 16) & 0xFF
            g = (elem["color"] >> 8) & 0xFF
            b = elem["color"] & 0xFF
            color_tuple = (r/255.0, g/255.0, b/255.0)
        else:
            color_tuple = (0, 0, 0)  # Negro por defecto
        
        # Verificar si este elemento es parte de la columna de precios
        is_price = False
        if price_column_x is not None:
            # Si está cerca de la posición X de la columna de precios
            if abs(elem["x0"] - price_column_x) < 20:
                # Verificar si es numérico
                try:
                    test_text = elem["text"].replace(',', '').replace('.', '').replace('-', '').replace('+', '').strip()
                    if test_text:
                        float(test_text)
                        is_price = True
                except:
                    pass
        
        # Si es precio y está cerca del borde derecho, preservar su posición X original
        if is_price and elem["x0"] > page_width * 0.7:
            # Mantener la posición X de la columna de precios alineada
            final_x = price_column_x
        else:
            final_x = elem["x0"]
        
        # Insertar texto en la nueva posición corregida
        point = fitz.Point(final_x, elem["y0"] + elem["size"] * 0.8)
        
        try:
            # Intentar insertar con todas las propiedades
            page.insert_text(
                point,
                elem["text"],
                fontsize=elem["size"],
                color=color_tuple,
                fontname=elem["font"]
            )
        except Exception as e:
            # Si falla, usar método simplificado
            try:
                page.insert_text(
                    point,
                    elem["text"],
                    fontsize=elem["size"],
                    color=color_tuple
                )
            except:
                # Último recurso: solo texto y tamaño
                page.insert_text(
                    point,
                    elem["text"],
                    fontsize=elem["size"]
                )


def fix_pdf_advanced(input_pdf_path, output_pdf_path=None):
    """
    Método avanzado: extrae texto, detecta solapamientos y recrea el PDF
    Maneja páginas más grandes y múltiples páginas cuando es necesario
    """
    if output_pdf_path is None:
        base_name = Path(input_pdf_path).stem
        output_pdf_path = f"{base_name}_corregido.pdf"
    
    doc = fitz.open(input_pdf_path)
    new_doc = fitz.open()  # Nuevo documento
    
    print(f"Procesando PDF: {input_pdf_path}")
    print(f"Total de páginas: {len(doc)}")
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        print(f"Procesando página {page_num + 1}...")
        
        # Obtener dimensiones originales
        original_width = page.rect.width
        original_height = page.rect.height
        
        # Margen inferior para evitar que el contenido se corte
        bottom_margin = 50
        
        # Obtener texto con posiciones detalladas
        text_dict = page.get_text("dict")
        
        # Recopilar todos los elementos de texto con información completa
        text_elements = []
        
        for block in text_dict["blocks"]:
            if "lines" in block:
                for line in block["lines"]:
                    for span in line["spans"]:
                        bbox = span["bbox"]
                        text = span["text"].strip()
                        if text:
                            # Obtener propiedades del texto
                            font_name = span.get("font", "helv")
                            font_size = span.get("size", 12)
                            color = span.get("color", 0)
                            flags = span.get("flags", 0)
                            
                            # Asegurar que bbox sea una lista para poder modificarla
                            bbox_list = list(bbox)
                            text_elements.append({
                                "text": text,
                                "bbox": bbox_list,
                                "x0": bbox[0],
                                "y0": bbox[1],
                                "x1": bbox[2],
                                "y1": bbox[3],
                                "font": font_name,
                                "size": font_size,
                                "flags": flags,
                                "color": color,
                                "height": bbox[3] - bbox[1]
                            })
        
        # Agrupar elementos de texto por líneas (misma coordenada Y aproximada)
        # Tolerancia para considerar que están en la misma línea
        line_tolerance = 3
        
        # Ordenar por posición Y (de arriba hacia abajo)
        text_elements.sort(key=lambda x: (x["y0"], x["x0"]))
        
        # Agrupar en líneas
        lines = []
        current_line = []
        current_line_y = None
        
        for elem in text_elements:
            if current_line_y is None or abs(elem["y0"] - current_line_y) <= line_tolerance:
                # Misma línea
                if current_line_y is None:
                    current_line_y = elem["y0"]
                current_line.append(elem)
            else:
                # Nueva línea
                if current_line:
                    # Ordenar elementos de la línea por X
                    current_line.sort(key=lambda x: x["x0"])
                    lines.append(current_line)
                current_line = [elem]
                current_line_y = elem["y0"]
        
        # Agregar última línea
        if current_line:
            current_line.sort(key=lambda x: x["x0"])
            lines.append(current_line)
        
        # Detectar columnas aproximadas basándose en las posiciones X más comunes
        # Esto nos ayudará a evitar que el texto se desborde entre columnas
        all_x_positions = []
        for line in lines:
            for elem in line:
                all_x_positions.append(elem["x0"])
        
        # Agrupar posiciones X similares para identificar columnas
        if all_x_positions:
            sorted_x = sorted(set(all_x_positions))
            # Detectar columnas (agrupar posiciones X cercanas)
            column_threshold = 20  # Distancia máxima para considerar misma columna
            columns = []
            current_col = [sorted_x[0]]
            
            for x in sorted_x[1:]:
                if x - current_col[-1] < column_threshold:
                    current_col.append(x)
                else:
                    columns.append(current_col)
                    current_col = [x]
            columns.append(current_col)
            
            # Calcular límites de columnas (promedio de posiciones en cada grupo)
            column_boundaries = []
            for col in columns:
                if col:
                    col_start = min(col)
                    col_end = max(col) + 100  # Ancho estimado de columna
                    column_boundaries.append((col_start, col_end))
        
        # Corregir posiciones Y para evitar solapamientos entre líneas
        min_spacing = 5  # Espaciado mínimo entre líneas (en puntos)
        
        for line_idx, line in enumerate(lines):
            if line_idx == 0:
                continue
            
            # Calcular la altura máxima de la línea anterior
            prev_line_max_y = max(elem["y1"] for elem in lines[line_idx - 1])
            
            # Calcular la posición Y mínima de la línea actual
            current_line_min_y = min(elem["y0"] for elem in line)
            
            # Verificar si hay solapamiento vertical
            if current_line_min_y < prev_line_max_y + min_spacing:
                # Calcular el desplazamiento necesario
                offset = (prev_line_max_y + min_spacing) - current_line_min_y
                
                # Aplicar desplazamiento a todos los elementos de la línea
                for elem in line:
                    elem["y0"] += offset
                    elem["y1"] += offset
                    elem["bbox"] = [
                        elem["bbox"][0],
                        elem["bbox"][1] + offset,
                        elem["bbox"][2],
                        elem["bbox"][3] + offset
                    ]
        
        # Corregir solapamientos horizontales dentro de cada línea
        # Primero, detectar límites de columnas basándose en patrones comunes
        page_width = page.rect.width
        
        for line in lines:
            # Ordenar elementos de la línea por posición X
            line.sort(key=lambda x: x["x0"])
            
            # Detectar solapamientos y corregirlos
            for i in range(1, len(line)):
                prev_elem = line[i-1]
                curr_elem = line[i]
                
                # Calcular el ancho real del texto anterior
                prev_width = prev_elem["x1"] - prev_elem["x0"]
                # Estimar ancho del texto basado en el contenido
                estimated_prev_width = len(prev_elem["text"]) * prev_elem["size"] * 0.6
                prev_end_x = max(prev_elem["x1"], prev_elem["x0"] + estimated_prev_width)
                
                # Verificar si hay solapamiento horizontal
                min_spacing_h = 5  # Espaciado mínimo horizontal entre columnas
                
                if curr_elem["x0"] < prev_end_x + min_spacing_h:
                    # Hay solapamiento, ajustar posición X del elemento actual
                    new_x0 = prev_end_x + min_spacing_h
                    
                    # Asegurar que no se salga de los límites de la página
                    if new_x0 > page_width - 50:
                        # Si se sale, mover la línea completa hacia abajo
                        # y resetear la posición X
                        line_offset_y = curr_elem["size"] * 1.2
                        for j in range(i, len(line)):
                            line[j]["y0"] += line_offset_y
                            line[j]["y1"] += line_offset_y
                            # Convertir bbox a lista si es tupla
                            bbox_list = list(line[j]["bbox"])
                            bbox_list[1] += line_offset_y
                            bbox_list[3] += line_offset_y
                            line[j]["bbox"] = bbox_list
                        # Resetear X a la posición original del primer elemento de esta sección
                        new_x0 = line[0]["x0"]
                    
                    # Actualizar posición X
                    width = curr_elem["x1"] - curr_elem["x0"]
                    curr_elem["x0"] = new_x0
                    curr_elem["x1"] = new_x0 + width
                    curr_elem["bbox"] = [
                        new_x0,
                        curr_elem["bbox"][1],
                        new_x0 + width,
                        curr_elem["bbox"][3]
                    ]
        
        # Aplanar líneas de vuelta a lista de elementos
        text_elements = [elem for line in lines for elem in line]
        
        # Calcular la altura total necesaria
        if text_elements:
            max_y = max(elem["y1"] for elem in text_elements)
            required_height = max_y + bottom_margin
            
            # Si el contenido necesita más espacio, aumentar la altura de la página
            # o crear páginas adicionales
            page_height = max(original_height, required_height)
            
            # Si la altura es demasiado grande, dividir en múltiples páginas
            max_page_height = 1200  # Altura máxima razonable por página (puntos)
            pages_needed = max(1, int((page_height / max_page_height) + 0.5))
            
            print(f"  Altura requerida: {required_height:.1f} puntos")
            print(f"  Páginas necesarias: {pages_needed}")
            
            # Detectar posición de la columna de precios (última columna, cerca del borde derecho)
            price_column_x = None
            if text_elements:
                # Buscar elementos cerca del borde derecho que sean numéricos
                right_edge_elements = [e for e in text_elements if e["x0"] > original_width * 0.7]
                if right_edge_elements:
                    # Agrupar por posición X similar
                    price_x_positions = sorted(set([e["x0"] for e in right_edge_elements]))
                    if price_x_positions:
                        # Tomar la posición X más común cerca del borde derecho
                        price_column_x = max(price_x_positions, key=lambda x: sum(1 for e in right_edge_elements if abs(e["x0"] - x) < 10))
            
            # Dividir elementos en páginas si es necesario, manteniendo líneas completas juntas
            if pages_needed > 1:
                # Dividir por posición Y en lugar de por número de elementos
                y_per_page = required_height / pages_needed
                
                for page_idx in range(pages_needed):
                    y_start = page_idx * y_per_page
                    y_end = (page_idx + 1) * y_per_page if page_idx < pages_needed - 1 else required_height + 100
                    
                    # Seleccionar elementos que pertenecen a esta página
                    page_elements = [e for e in text_elements if y_start <= e["y0"] < y_end]
                    
                    if not page_elements:
                        continue
                    
                    # Ajustar posiciones Y para esta página
                    min_y = min(e["y0"] for e in page_elements)
                    offset_y = -min_y + 50  # Margen superior
                    for elem in page_elements:
                        elem["y0"] += offset_y
                        elem["y1"] += offset_y
                        elem["bbox"][1] += offset_y
                        elem["bbox"][3] += offset_y
                    
                    # Calcular altura necesaria para esta página
                    page_max_y = max(e["y1"] for e in page_elements)
                    current_page_height = max(max_page_height, page_max_y + bottom_margin)
                    
                    # Crear página
                    current_page = new_doc.new_page(width=original_width, height=current_page_height)
                    _insert_elements_on_page(current_page, page_elements, price_column_x, original_width)
            else:
                # Una sola página, pero con altura aumentada si es necesario
                new_page = new_doc.new_page(width=original_width, height=page_height)
                _insert_elements_on_page(new_page, text_elements, price_column_x, original_width)
        else:
            # No hay elementos de texto, crear página vacía del tamaño original
            new_page = new_doc.new_page(width=original_width, height=original_height)
        
        # Copiar imágenes de la página original (si las hay)
        try:
            image_list = page.get_images()
            for img_index, img in enumerate(image_list):
                xref = img[0]
                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    # Las imágenes se pueden insertar si es necesario
                    # Por ahora las omitimos para mantener el enfoque en el texto
                except:
                    pass
        except:
            pass
    
    new_doc.save(output_pdf_path)
    new_doc.close()
    doc.close()
    
    print(f"\nPDF corregido guardado como: {output_pdf_path}")
    return output_pdf_path


def export_pdf_to_excel(input_pdf_path, output_excel_path=None):
    """
    Extrae datos del PDF y los exporta a un archivo Excel replicando la estructura de la tabla
    """
    if output_excel_path is None:
        base_name = Path(input_pdf_path).stem
        output_excel_path = f"{base_name}.xlsx"
    
    doc = fitz.open(input_pdf_path)
    
    print(f"\nExtrayendo datos del PDF: {input_pdf_path}")
    print(f"Total de páginas: {len(doc)}")
    
    # Nombres de columnas esperados
    column_names = ["Fecha", "Cliente/Proveedor", "Tipo. Nro.", "Nro. Cheque", "Descripción", "Importe"]
    
    all_rows = []
    column_boundaries = None  # Se calculará en la primera página
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        print(f"Procesando página {page_num + 1}...")
        
        # Obtener texto con posiciones detalladas
        text_dict = page.get_text("dict")
        
        # Recopilar todos los elementos de texto
        text_elements = []
        
        for block in text_dict["blocks"]:
            if "lines" in block:
                for line in block["lines"]:
                    for span in line["spans"]:
                        bbox = span["bbox"]
                        text = span["text"].strip()
                        if text:
                            text_elements.append({
                                "text": text,
                                "x0": bbox[0],
                                "y0": bbox[1],
                                "x1": bbox[2],
                                "y1": bbox[3],
                                "size": span.get("size", 12)
                            })
        
        # Agrupar elementos por líneas
        line_tolerance = 3
        text_elements.sort(key=lambda x: (x["y0"], x["x0"]))
        
        lines = []
        current_line = []
        current_line_y = None
        
        for elem in text_elements:
            if current_line_y is None or abs(elem["y0"] - current_line_y) <= line_tolerance:
                if current_line_y is None:
                    current_line_y = elem["y0"]
                current_line.append(elem)
            else:
                if current_line:
                    current_line.sort(key=lambda x: x["x0"])
                    lines.append(current_line)
                current_line = [elem]
                current_line_y = elem["y0"]
        
        if current_line:
            current_line.sort(key=lambda x: x["x0"])
            lines.append(current_line)
        
        # Detectar encabezados y calcular límites de columnas en la primera página
        if page_num == 0 and lines:
            # Buscar línea de encabezados (generalmente está cerca del inicio)
            header_line = None
            for i, line in enumerate(lines[:10]):  # Buscar en las primeras 10 líneas
                line_text = " ".join([elem["text"] for elem in line]).upper()
                # Buscar palabras clave de encabezados
                if any(keyword in line_text for keyword in ["FECHA", "CLIENTE", "PROVEEDOR", "TIPO", "CHEQUE", "DESCRIPCION", "IMPORTE"]):
                    header_line = line
                    break
            
            # Si no encontramos encabezados explícitos, usar la primera línea
            if header_line is None and lines:
                header_line = lines[0]
            
            # Calcular límites de columnas basándose en los elementos de la línea de encabezados
            if header_line:
                # Ordenar elementos por X
                header_sorted = sorted(header_line, key=lambda x: x["x0"])
                
                # Calcular límites entre columnas (punto medio entre elementos)
                column_boundaries = []
                for i in range(len(header_sorted) - 1):
                    boundary = (header_sorted[i]["x1"] + header_sorted[i+1]["x0"]) / 2
                    column_boundaries.append(boundary)
                
                # Agregar límite final (borde derecho de la página)
                column_boundaries.append(page.rect.width)
                
                # Agregar límite inicial (borde izquierdo)
                column_boundaries.insert(0, 0)
                
                print(f"  Límites de columnas detectados: {len(column_boundaries) - 1} columnas")
        
        # Si no se detectaron límites, calcularlos basándose en todas las posiciones X
        if column_boundaries is None:
            all_x_positions = []
            for line in lines:
                for elem in line:
                    all_x_positions.append(elem["x0"])
            
            if all_x_positions:
                sorted_x = sorted(set(all_x_positions))
                # Agrupar posiciones X similares
                column_threshold = 20
                column_groups = []
                current_group = [sorted_x[0]]
                
                for x in sorted_x[1:]:
                    if x - current_group[-1] < column_threshold:
                        current_group.append(x)
                    else:
                        column_groups.append(current_group)
                        current_group = [x]
                column_groups.append(current_group)
                
                # Calcular límites de columnas
                column_boundaries = [0]
                for i in range(len(column_groups) - 1):
                    boundary = (max(column_groups[i]) + min(column_groups[i+1])) / 2
                    column_boundaries.append(boundary)
                column_boundaries.append(page.rect.width)
        
        # Procesar cada línea de datos (saltar encabezados)
        for line_idx, line in enumerate(lines):
            # Saltar línea de encabezados (primera línea de la primera página)
            if page_num == 0 and line_idx == 0:
                line_text = " ".join([elem["text"] for elem in line]).upper()
                if any(keyword in line_text for keyword in ["FECHA", "CLIENTE", "PROVEEDOR", "TIPO", "CHEQUE", "DESCRIPCION", "IMPORTE"]):
                    continue
            
            row_data = {}
            
            # Asignar cada elemento a su columna correspondiente
            for elem in line:
                # Determinar en qué columna cae este elemento
                col_idx = 0
                for i in range(len(column_boundaries) - 1):
                    if column_boundaries[i] <= elem["x0"] < column_boundaries[i + 1]:
                        col_idx = i
                        break
                else:
                    # Si está fuera de los límites, asignar a la última columna
                    col_idx = len(column_boundaries) - 2
                
                # Usar nombre de columna si está disponible
                if col_idx < len(column_names):
                    col_name = column_names[col_idx]
                else:
                    col_name = f"Columna_{col_idx + 1}"
                
                # Si ya hay datos en esta columna, concatenar (para texto que se desborda)
                if col_name in row_data:
                    row_data[col_name] += " " + elem["text"]
                else:
                    row_data[col_name] = elem["text"]
            
            # Solo agregar filas que tengan al menos una columna con datos
            if row_data:
                # Validar y limpiar datos
                # Si la columna "Fecha" no tiene formato de fecha, podría estar mal asignada
                if "Fecha" in row_data:
                    fecha_text = str(row_data["Fecha"])
                    # Verificar si parece una fecha (formato DD-MM-YYYY)
                    if not re.match(r'\d{2}-\d{2}-\d{4}', fecha_text):
                        # Si no es fecha, podría ser que esté en otra columna
                        # Buscar fecha en otras columnas
                        for key, value in row_data.items():
                            if key != "Fecha" and re.match(r'\d{2}-\d{2}-\d{4}', str(value)):
                                # Intercambiar
                                row_data["Fecha"] = value
                                row_data[key] = fecha_text
                                break
                
                all_rows.append(row_data)
    
    doc.close()
    
    # Crear DataFrame y exportar a Excel
    if all_rows:
        # Crear DataFrame
        df = pd.DataFrame(all_rows)
        
        # Asegurar que todas las columnas esperadas estén presentes
        for col_name in column_names:
            if col_name not in df.columns:
                df[col_name] = ""
        
        # Reordenar columnas en el orden correcto
        ordered_columns = column_names
        existing_cols = [col for col in ordered_columns if col in df.columns]
        # Agregar cualquier columna adicional que no esté en la lista
        other_cols = [col for col in df.columns if col not in ordered_columns]
        df = df[existing_cols + other_cols]
        
        # Limpiar datos: eliminar espacios extra y caracteres no deseados
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].astype(str).str.strip()
                df[col] = df[col].replace('nan', '')
                df[col] = df[col].replace('None', '')
        
        # Exportar a Excel con formato
        # Si el archivo está abierto, usar un nombre alternativo
        try:
            writer = pd.ExcelWriter(output_excel_path, engine='openpyxl')
        except PermissionError:
            # Si el archivo está abierto, agregar timestamp
            base_name = Path(output_excel_path).stem
            output_excel_path = f"{base_name}_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            writer = pd.ExcelWriter(output_excel_path, engine='openpyxl')
        
        with writer:
            df.to_excel(writer, index=False, sheet_name='Datos')
            
            # Obtener la hoja para aplicar formato
            worksheet = writer.sheets['Datos']
            
            # Ajustar ancho de columnas
            from openpyxl.utils import get_column_letter
            for idx, col in enumerate(df.columns, 1):
                max_length = max(
                    df[col].astype(str).apply(len).max(),
                    len(str(col))
                )
                # Limitar ancho máximo pero permitir más espacio para descripciones
                if col == "Descripción":
                    adjusted_width = min(max_length + 2, 80)
                elif col == "Cliente/Proveedor":
                    adjusted_width = min(max_length + 2, 60)
                else:
                    adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[get_column_letter(idx)].width = adjusted_width
        
        print(f"\nDatos exportados a Excel: {output_excel_path}")
        print(f"Total de filas: {len(df)}")
        print(f"Columnas: {', '.join(df.columns.tolist())}")
        
        return output_excel_path
    else:
        print("No se encontraron datos para exportar.")
        return None


def extraer_datos_colppy(pdf_path, excel_path=None):
    """
    Función wrapper para compatibilidad con el sistema de extractores.
    Retorna un DataFrame con los datos extraídos.
    """
    import pandas as pd
    import os
    
    try:
        print(f"Iniciando extracción Colppy para: {pdf_path}")
        print(f"Ruta Excel de salida: {excel_path}")
        
        # Si no se proporciona excel_path, generar uno automáticamente
        if excel_path is None:
            base_name = Path(pdf_path).stem
            excel_path = f"{base_name}.xlsx"
        
        # Llamar a la función original
        excel_output = export_pdf_to_excel(pdf_path, excel_path)
        
        # Verificar que el archivo se generó
        if excel_output and os.path.exists(excel_output):
            print(f"Excel generado exitosamente en: {excel_output}")
            # Leer el Excel generado y retornar como DataFrame
            df = pd.read_excel(excel_output)
            print(f"DataFrame creado con {len(df)} filas")
            return df
        elif excel_path and os.path.exists(excel_path):
            # Si el archivo está en la ruta especificada directamente
            print(f"Excel encontrado en ruta especificada: {excel_path}")
            df = pd.read_excel(excel_path)
            print(f"DataFrame creado con {len(df)} filas")
            return df
        else:
            print(f"Error: No se pudo generar el archivo Excel")
            print(f"Ruta esperada: {excel_output if excel_output else excel_path}")
            return pd.DataFrame()
            
    except Exception as e:
        print(f"Error en extraer_datos_colppy: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()


if __name__ == "__main__":
    # Buscar PDFs en el directorio actual
    pdf_files = list(Path(".").glob("*.pdf"))
    
    # Filtrar archivos corregidos (opcional, para no mostrar los ya procesados)
    pdf_files = [f for f in pdf_files if "_corregido" not in str(f)]
    
    if not pdf_files:
        print("No se encontraron archivos PDF en el directorio actual.")
        sys.exit(1)
    
    # Si se especifica un archivo como argumento, usarlo directamente
    if len(sys.argv) > 1:
        input_pdf = sys.argv[1]
        if not os.path.exists(input_pdf):
            print(f"Error: El archivo {input_pdf} no existe.")
            sys.exit(1)
    else:
        # Mostrar menú para seleccionar archivo
        print("=" * 60)
        print("ARCHIVOS PDF DISPONIBLES")
        print("=" * 60)
        print()
        
        for idx, pdf_file in enumerate(pdf_files, 1):
            file_size = os.path.getsize(pdf_file) / 1024  # Tamaño en KB
            print(f"  {idx}. {pdf_file.name} ({file_size:.1f} KB)")
        
        print()
        print("=" * 60)
        
        # Solicitar selección al usuario
        while True:
            try:
                selection = input(f"\nSeleccione el archivo a procesar (1-{len(pdf_files)}) o 'q' para salir: ").strip()
                
                if selection.lower() == 'q':
                    print("Operación cancelada.")
                    sys.exit(0)
                
                file_idx = int(selection) - 1
                
                if 0 <= file_idx < len(pdf_files):
                    input_pdf = str(pdf_files[file_idx])
                    break
                else:
                    print(f"Por favor, ingrese un número entre 1 y {len(pdf_files)}")
            except ValueError:
                print("Por favor, ingrese un número válido o 'q' para salir.")
            except KeyboardInterrupt:
                print("\n\nOperación cancelada.")
                sys.exit(0)
    
    print("=" * 60)
    print("CORRECTOR DE TEXTO SUPERPUESTO EN PDF")
    print("=" * 60)
    print(f"Archivo seleccionado: {os.path.basename(input_pdf)}")
    print("=" * 60)
    
    try:
        # Corregir PDF
        fix_pdf_advanced(input_pdf)
        
        # Exportar a Excel
        print("\n" + "=" * 60)
        print("EXPORTANDO A EXCEL")
        print("=" * 60)
        export_pdf_to_excel(input_pdf)
        
        print("\n¡Proceso completado exitosamente!")
    except Exception as e:
        print(f"\nError durante el procesamiento: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

