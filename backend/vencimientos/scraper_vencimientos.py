"""
Script de scraping para extraer tablas de vencimientos de Estudio del Amo
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime
from urllib.parse import urlparse
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

# URLs a scrapear
URLS = [
    "https://estudiodelamo.com/vencimientos-retenciones-sicore/",
    "https://estudiodelamo.com/vencimientos-autonomos/",
    "https://estudiodelamo.com/vencimientos-iva/",
    "https://estudiodelamo.com/vencimientos-convenio-multilateral-ingresos-brutos/",
    "https://estudiodelamo.com/vencimientos-cargas-sociales-relacion-de-dependencia/",
    "https://estudiodelamo.com/vencimientos-cargas-sociales-servicio-domestico/",
    "https://estudiodelamo.com/vencimientos-impuesto-ganancias-personas-fisicas-bienes-personales-anticipos/",
    "https://estudiodelamo.com/vencimientos-impuesto-a-las-ganancias-personas-juridicas-sociedades-anticipos/",
]

# Headers para simular un navegador
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}


def obtener_nombre_archivo(url):
    """Extrae un nombre de archivo descriptivo de la URL"""
    parsed = urlparse(url)
    path = parsed.path.strip('/')
    nombre = path.replace('vencimientos-', '').replace('/', '_')
    return nombre if nombre else 'vencimientos'


def es_tabla_valida(df):
    """
    Verifica si una tabla tiene contenido válido
    (no está vacía y tiene al menos 2 filas y 2 columnas)
    """
    if df is None or df.empty:
        return False
    if len(df) < 1:
        return False
    if len(df.columns) < 1:
        return False
    return True


def son_tablas_iguales(df1, df2):
    """
    Compara dos DataFrames para determinar si son iguales
    (mismo contenido, ignorando el orden de las filas)
    """
    try:
        # Normalizar: resetear índices y ordenar columnas
        df1_norm = df1.copy().reset_index(drop=True)
        df2_norm = df2.copy().reset_index(drop=True)
        
        # Comparar forma
        if df1_norm.shape != df2_norm.shape:
            return False
        
        # Comparar columnas
        if list(df1_norm.columns) != list(df2_norm.columns):
            return False
        
        # Comparar contenido (ignorando tipos de datos en comparación de strings)
        df1_str = df1_norm.astype(str)
        df2_str = df2_norm.astype(str)
        
        return df1_str.equals(df2_str)
    except Exception:
        return False


def extraer_tablas(url):
    """
    Extrae todas las tablas de una URL específica
    Retorna una lista de DataFrames únicos (sin duplicados)
    """
    try:
        print(f"Procesando: {url}")
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        tablas = soup.find_all('table')
        
        if not tablas:
            print(f"  ⚠️  No se encontraron tablas en {url}")
            return []
        
        dataframes = []
        tablas_procesadas = 0
        
        for i, tabla in enumerate(tablas):
            try:
                # Verificar si esta tabla está anidada dentro de otra tabla ya procesada
                es_anidada = False
                for tabla_anterior in tablas[:i]:
                    if tabla in tabla_anterior.descendants:
                        es_anidada = True
                        break
                
                if es_anidada:
                    print(f"  ⊘ Tabla {i+1} omitida (anidada dentro de otra tabla)")
                    continue
                
                # Intentar leer la tabla con pandas
                dfs_leidos = pd.read_html(str(tabla))
                if not dfs_leidos:
                    continue
                
                df = dfs_leidos[0]
                
                # Validar que la tabla tenga contenido útil
                if not es_tabla_valida(df):
                    print(f"  ⊘ Tabla {i+1} omitida (vacía o sin contenido válido)")
                    continue
                
                # Verificar duplicados comparando con tablas ya extraídas
                es_duplicado = False
                for df_existente in dataframes:
                    if son_tablas_iguales(df, df_existente):
                        es_duplicado = True
                        print(f"  ⊘ Tabla {i+1} omitida (duplicado de tabla anterior)")
                        break
                
                if not es_duplicado:
                    dataframes.append(df)
                    tablas_procesadas += 1
                    print(f"  ✓ Tabla {tablas_procesadas} extraída: {len(df)} filas, {len(df.columns)} columnas")
                
            except Exception as e:
                print(f"  ✗ Error al procesar tabla {i+1}: {str(e)}")
                continue
        
        print(f"  📊 Total: {len(tablas)} tablas encontradas, {len(dataframes)} únicas extraídas")
        return dataframes
    
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Error al obtener la página {url}: {str(e)}")
        return []
    except Exception as e:
        print(f"  ✗ Error inesperado en {url}: {str(e)}")
        return []


def formatear_excel(archivo):
    """
    Aplica formato profesional a un archivo Excel
    """
    try:
        wb = load_workbook(archivo)
        
        # Estilos
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF", size=11)
        border_style = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
        alignment_center = Alignment(horizontal='center', vertical='center', wrap_text=True)
        alignment_left = Alignment(horizontal='left', vertical='center', wrap_text=True)
        
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            
            # Formatear encabezados (primera fila)
            for cell in ws[1]:
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = alignment_center
                cell.border = border_style
            
            # Ajustar ancho de columnas automáticamente
            for column in ws.columns:
                max_length = 0
                column_letter = column[0].column_letter
                
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                
                # Ajustar ancho (mínimo 10, máximo 50)
                adjusted_width = min(max(max_length + 2, 10), 50)
                ws.column_dimensions[column_letter].width = adjusted_width
            
            # Formatear celdas de datos
            for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=1, max_col=ws.max_column):
                for cell in row:
                    cell.border = border_style
                    # Primera columna alineada a la izquierda, resto centrado
                    if cell.column == 1:
                        cell.alignment = alignment_left
                    else:
                        cell.alignment = alignment_center
            
            # Congelar primera fila (encabezados)
            ws.freeze_panes = 'A2'
            
            # Ajustar altura de la fila de encabezado
            ws.row_dimensions[1].height = 25
        
        wb.save(archivo)
    except Exception as e:
        print(f"  ⚠️  Advertencia: No se pudo aplicar formato completo: {str(e)}")


def guardar_resultados(dataframes, nombre_base):
    """
    Guarda los DataFrames en un archivo Excel formateado
    """
    if not dataframes:
        print(f"  ⚠️  No hay datos para guardar: {nombre_base}")
        return None
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archivo = f"{nombre_base}_{timestamp}.xlsx"
    
    with pd.ExcelWriter(archivo, engine='openpyxl') as writer:
        for i, df in enumerate(dataframes):
            nombre_hoja = f"Tabla_{i+1}" if len(dataframes) > 1 else "Datos"
            df.to_excel(writer, sheet_name=nombre_hoja, index=False)
    
    # Aplicar formato
    formatear_excel(archivo)
    print(f"  ✓ Guardado en Excel formateado: {archivo}")
    return archivo


def main():
    """Función principal"""
    print("=" * 60)
    print("SCRAPER DE VENCIMIENTOS - ESTUDIO DEL AMO")
    print("=" * 60)
    print(f"Total de URLs a procesar: {len(URLS)}\n")
    
    resultados_totales = {}
    
    for url in URLS:
        nombre = obtener_nombre_archivo(url)
        dataframes = extraer_tablas(url)
        
        if dataframes:
            resultados_totales[nombre] = {
                'url': url,
                'dataframes': dataframes
            }
            # Guardar individualmente con formato
            guardar_resultados(dataframes, nombre)
        print()
    
    # Guardar resumen consolidado con formato
    if resultados_totales:
        print("=" * 60)
        print("RESUMEN DE EXTRACCIÓN")
        print("=" * 60)
        for nombre, datos in resultados_totales.items():
            print(f"{nombre}: {len(datos['dataframes'])} tabla(s) extraída(s)")
        
        # Crear un archivo Excel consolidado con todas las tablas
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archivo_consolidado = f"vencimientos_consolidado_{timestamp}.xlsx"
        with pd.ExcelWriter(archivo_consolidado, engine='openpyxl') as writer:
            for nombre, datos in resultados_totales.items():
                for i, df in enumerate(datos['dataframes']):
                    nombre_hoja = f"{nombre}_T{i+1}"[:31]  # Excel limita a 31 caracteres
                    df.to_excel(writer, sheet_name=nombre_hoja, index=False)
        
        # Aplicar formato al archivo consolidado
        formatear_excel(archivo_consolidado)
        print(f"\n✓ Archivo consolidado formateado creado: {archivo_consolidado}")
    
    print("\n" + "=" * 60)
    print("PROCESO COMPLETADO")
    print("=" * 60)


if __name__ == "__main__":
    main()

