import gspread
import pandas as pd
from oauth2client.service_account import ServiceAccountCredentials
import time
from collections import defaultdict # Importar defaultdict para contar duplicados

# Credenciales y ID del Google Sheet
SPREADSHEET_ID = '1snwyzqO13lf_D9bXdFXAwCEc_-q53S0jb7ZAGPOOSyQ' # ID CORRECTO del Google Sheet principal
CREDENTIALS_FILE = 'C:/Users/relim/Desktop/prueba/durable-binder-432321-q4-5f1ef9e64ea1.json'


def get_gsheet_client():
    """Obtiene el cliente autorizado de gspread."""
    try:
        scope = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
        client = gspread.authorize(creds)
        return client
    except Exception as e:
        print(f"Error al obtener el cliente de gspread: {e}")
        return None


def get_sheet_data(client, sheet_name, spreadsheet_id=SPREADSHEET_ID):
    """Lee los datos de una hoja específica de un Google Sheet por ID, manejando columnas duplicadas."""
    try:
        sheet = client.open_by_key(spreadsheet_id)
        time.sleep(2)  # Pausa más larga después de abrir el spreadsheet
        worksheet = sheet.worksheet(sheet_name)
        time.sleep(2)  # Pausa después de obtener la hoja
        data = worksheet.get_all_values()
        time.sleep(2)  # Pausa después de obtener los datos

        if not data or len(data) < 1:
             # print(f"Advertencia: La hoja '{sheet_name}' en spreadsheet {spreadsheet_id} parece estar vacía o sin encabezados.") # Mensaje ajustado
             return pd.DataFrame()

        # Obtener encabezados y datos
        headers = data[0]
        sheet_data = data[1:]

        # Manejar nombres de columna duplicados
        seen_headers = defaultdict(int)
        new_headers = []
        for header in headers:
            original_header = header.strip() # Limpiar espacios iniciales/finales
            if original_header == '': # Manejar encabezados vacíos
                 original_header = f'Unnamed_Column_{len(new_headers)}'
            
            seen_headers[original_header] += 1
            if seen_headers[original_header] > 1:
                # Si se ha visto más de una vez, añadir sufijo
                new_headers.append(f'{original_header}_{seen_headers[original_header]}')
            else:
                new_headers.append(original_header)

        # Crear DataFrame con los encabezados únicos
        df = pd.DataFrame(sheet_data, columns=new_headers)

        # Intentar limpiar nombres de columnas nuevamente por si acaso (después de hacerlos únicos)
        df.columns = df.columns.str.strip()

        # print(f"Datos leídos correctamente de la hoja '{sheet_name}' en spreadsheet {spreadsheet_id}. Columnas: {list(df.columns)}") # Mensaje ajustado
        return df
    except gspread.exceptions.WorksheetNotFound:
        # print(f"Advertencia: La hoja '{sheet_name}' no fue encontrada en spreadsheet {spreadsheet_id}.") # Mensaje ajustado
        return None # Devolver None si la hoja no existe
    except Exception as e:
        print(f"Error al leer datos de la hoja '{sheet_name}' en spreadsheet {spreadsheet_id}: {e}")
        return None

def get_spreadsheet_id_from_url(url):
    """Extrae el ID del spreadsheet de una URL."""
    if isinstance(url, str):
        try:
            # Los IDs de spreadsheet tienen un formato específico en la URL
            # Asegurarse de manejar URLs que podrían tener fragmentos (#gid=...) al final
            id_part = url.split('/d/')[1].split('/')[0]
            return id_part
        except IndexError:
            print(f"No se pudo extraer el ID del spreadsheet de la URL: {url}")
            return None
    return None

def get_all_sheet_titles(client, spreadsheet_id):
    """Obtiene una lista de todos los títulos de las hojas en un spreadsheet."""
    try:
        spreadsheet = client.open_by_key(spreadsheet_id)
        time.sleep(2)  # Pausa más larga después de abrir el spreadsheet
        worksheets = spreadsheet.worksheets()
        time.sleep(2)  # Pausa después de obtener la lista de hojas
        titles = [worksheet.title for worksheet in worksheets]
        print(f"Obtenidos {len(titles)} títulos de hojas del spreadsheet {spreadsheet.title} ({spreadsheet_id}).")
        return titles
    except gspread.exceptions.SpreadsheetNotFound:
        print(f"Error: Spreadsheet con ID {spreadsheet_id} no encontrado para obtener títulos de hoja.")
        return []
    except Exception as e:
        print(f"Error al obtener títulos de hoja del spreadsheet {spreadsheet_id}: {e}")
        return []

def combine_financial_data(df_old, df_new):
    """Combina DataFrames de datos financieros por columna clave (ej. 'Fiscal Period')."""
    # Esta función ahora se usa para combinar DataFrames *de la misma hoja* pero de diferentes spreadsheets vinculados.
    if df_old is None and df_new is None:
         # print("Advertencia: Ambos DataFrames son None, no se puede combinar.") # Mensaje ajustado
         return pd.DataFrame() # Devolver un DataFrame vacío si ambos son None
    if df_old is None:
        # Si el DataFrame viejo es None (la hoja no existía), devolver el nuevo (si existe)
        return df_new if df_new is not None else pd.DataFrame()
    if df_new is None:
        # Si el DataFrame nuevo es None, devolver el viejo
        return df_old

    if df_old.empty and df_new.empty:
        return pd.DataFrame() # Ambos vacíos, devolver vacío
    if df_old.empty:
        return df_new # Viejo vacío, devolver nuevo
    if df_new.empty:
        return df_old # Nuevo vacío, devolver viejo

    # Nos aseguramos de que ambos DataFrames tengan al menos una columna antes de acceder al índice 0
    if len(df_old.columns) == 0 or len(df_new.columns) == 0:
        print("Advertencia: Uno o ambos DataFrames vinculados están sin columnas. Realizando concatenación simple (puede no ser correcto).")
        # Fallback: concatenar si faltan columnas. Esto puede no ser la lógica de combinación deseada.
        combined_df = pd.concat([df_old, df_new], ignore_index=True).drop_duplicates().reset_index(drop=True)
        return combined_df.astype(str)


    # Asumimos que la primera columna es la clave (ej. 'Fiscal Period')
    # Asegurarse de que la primera columna exista en ambos DataFrames antes de intentar acceder a ella
    if len(df_old.columns) == 0 or len(df_new.columns) == 0:
         print("Advertencia: No se pueden combinar por columna clave, uno o ambos DataFrames no tienen columnas.")
         # Fallback a concatenación si no se puede identificar la columna clave
         combined_df = pd.concat([df_old, df_new], ignore_index=True).drop_duplicates().reset_index(drop=True)
         return combined_df.astype(str)

    merge_on_column = df_old.columns[0]

    # Asegurarnos de que la columna clave exista en ambos DataFrames después de limpias los nombres
    if merge_on_column in df_new.columns:
        # Realizar un merge exterior para incluir todas las filas
        combined_df = pd.merge(df_old, df_new, on=merge_on_column, how='outer', suffixes=('_old', '_new'))

        # Construir el orden final de las columnas
        final_column_order = [merge_on_column]

        # Añadir columnas del DataFrame viejo (excepto la clave) en su orden original
        for col in df_old.columns:
            if col != merge_on_column:
                final_column_order.append(col)

        # Añadir columnas del DataFrame nuevo (excepto la clave) que no estaban en el DataFrame viejo
        for col in df_new.columns:
            if col != merge_on_column and col not in df_old.columns:
                 final_column_order.append(col)

        # Combinar los valores para las columnas que existen en ambos, priorizando los del DataFrame nuevo
        for col in final_column_order:
             if col != merge_on_column:
                  col_old = col + '_old'
                  col_new = col + '_new'

                  if col_new in combined_df.columns and col_old in combined_df.columns:
                       combined_df.loc[:, col] = combined_df[col_new].combine_first(combined_df[col_old])
                       # Eliminar columnas con sufijos después de combinar
                       combined_df = combined_df.drop(columns=[col_old, col_new])
                  elif col_new in combined_df.columns:
                       # Si solo existe la versión _new, renombrar
                       combined_df = combined_df.rename(columns={col_new: col})
                  # Si solo existe la versión _old, ya estará en la columna sin sufijo si fue añadida desde df_old.columns
                  # Si no fue añadida desde df_old.columns (ej. estaba en df_new.columns pero también en df_old), ya fue manejada.

        # Asegurarse de que todas las columnas en final_column_order existan en combined_df antes de reindexar
        final_column_order = [col for col in final_column_order if col in combined_df.columns]
        # Opcional: intentar preservar el orden original de df_old para las columnas comunes, añadiendo las nuevas al final
        # current_cols_order = [col for col in df_old.columns if col in final_column_order] + [col for col in final_column_order if col not in df_old.columns]
        # combined_df = combined_df[current_cols_order]
        combined_df = combined_df[final_column_order]

    else:
        print(f"Advertencia: La columna clave '{merge_on_column}' del DataFrame viejo no fue encontrada en el DataFrame nuevo. Realizando concatenación simple.")
        # Si no hay columna clave clara o no está en ambos, concatenar simplemente
        # Esto puede no ser lo deseado para datos financieros, pero es un fallback
        # Usar ignore_index=True para resetear el índice y evitar problemas con índices duplicados de diferentes hojas.
        combined_df = pd.concat([df_old, df_new], ignore_index=True).drop_duplicates().reset_index(drop=True)

    # Asegurarse de que todas las celdas sean string antes de escribir a Google Sheets
    return combined_df.astype(str)

def create_and_populate_sheet(client, title):
    """Crea un nuevo Google Sheet con un título dado y una hoja inicial. Retorna el objeto spreadsheet."""
    try:
        spreadsheet = client.create(title)
        time.sleep(3)  # Pausa más larga después de crear el spreadsheet
        spreadsheet.share('', perm_type='anyone', role='reader')
        time.sleep(2)  # Pausa después de compartir el spreadsheet
        print(f"Nuevo spreadsheet '{title}' creado: {spreadsheet.url}")
        return spreadsheet


    except Exception as e:
        print(f"Error al crear el nuevo spreadsheet '{title}': {e}")
        return None

def populate_worksheet(spreadsheet, sheet_title, dataframe):
    """Popula una hoja específica en un spreadsheet existente con datos de un DataFrame, creando la hoja si no existe."""
    try:
        try:
            worksheet = spreadsheet.worksheet(sheet_title)
            time.sleep(2)  # Pausa después de obtener la hoja
        except gspread.exceptions.WorksheetNotFound:
            cols_to_create = max(dataframe.shape[1], 1) if not dataframe.empty else 1
            worksheet = spreadsheet.add_worksheet(title=sheet_title, rows=dataframe.shape[0] + 1, cols=cols_to_create)
            time.sleep(2)  # Pausa después de crear la hoja

        if not dataframe.empty:
            if dataframe.shape[1] > worksheet.col_count:
                try:
                    worksheet.resize(rows=dataframe.shape[0] + 1, cols=dataframe.shape[1])
                    time.sleep(2)  # Pausa después de redimensionar
                    print(f"  Hoja '{sheet_title}' redimensionada a {worksheet.row_count} filas y {worksheet.col_count} columnas.")
                except Exception as resize_e:
                    print(f"  Error al redimensionar la hoja '{sheet_title}': {resize_e}.")

            worksheet.update([dataframe.columns.values.tolist()] + dataframe.values.tolist())
            time.sleep(2)  # Pausa después de actualizar los datos
            return True
        else:
            # print(f"  DataFrame vacío para la hoja '{sheet_title}', no se escribieron datos.") # Mensaje ajustado
            # Opcional: podrías querer eliminar la hoja si está vacía y fue recién creada
            # if 'worksheet' in locals() and len(dataframe) == 0:
            #      spreadsheet.del_worksheet(worksheet)
            return False

    except Exception as e:
        print(f"  Error al poblar la hoja '{sheet_title}' en el nuevo spreadsheet: {e}")
        return False

def add_row_to_results_sheet(client, ticker, name, new_sheet_url):
    """Añade una fila a la hoja 'Results' del spreadsheet principal."""
    try:
        main_sheet = client.open_by_key(SPREADSHEET_ID)
        time.sleep(2)  # Pausa después de abrir el spreadsheet principal
        try:
            results_sheet = main_sheet.worksheet('Results')
            time.sleep(2)  # Pausa después de obtener la hoja Results
        except gspread.exceptions.WorksheetNotFound:
            results_sheet = main_sheet.add_worksheet(title="Results", rows="100", cols="20")
            time.sleep(2)  # Pausa después de crear la hoja
            results_sheet.update([['Ticker', 'Name', 'Combined Sheet Link']])
            time.sleep(2)  # Pausa después de actualizar los encabezados

        results_sheet.append_row([ticker, name, new_sheet_url])
        time.sleep(2)  # Pausa después de añadir la fila
        print(f"Fila añadida a Results: Ticker={ticker}, Name={name}, Link={new_sheet_url}")

    except Exception as e:
        print(f"Error al añadir fila a la hoja Results: {e}")


# --- Lógica principal --- ---n""
client = get_gsheet_client()

if client:
    # Leer hojas principales
    df_calculado = get_sheet_data(client, 'Calculado')
    time.sleep(3)  # Pausa más larga entre hojas principales
    df_scrap_nuevo = get_sheet_data(client, 'ScrapNuevo')
    time.sleep(3)  # Pausa más larga después de leer ambas hojas principales

    if df_calculado is not None and not df_calculado.empty and df_scrap_nuevo is not None and not df_scrap_nuevo.empty:
        print("Iniciando unificación de spreadsheets secundarios...")

        # Definir las columnas a usar para el Ticker, Name y Link basándonos en los encabezados esperados
        ticker_column_name = 'TICKER' # Nombre esperado del encabezado para Ticker
        name_column_name = 'NAME'     # Nombre esperado del encabezado para Name
        link_column_name = 'LINK'     # Nombre esperado del encabezado para Link

        # Verificar que las columnas necesarias existan en ambos DataFrames
        required_cols_calc = [ticker_column_name, name_column_name, link_column_name]
        required_cols_scrap = [ticker_column_name, link_column_name]

        if not all(col in df_calculado.columns for col in required_cols_calc):
             missing_calc = [col for col in required_cols_calc if col not in df_calculado.columns]
             print(f"Error: Faltan columnas requeridas en la hoja 'Calculado': {missing_calc}")
        elif not all(col in df_scrap_nuevo.columns for col in required_cols_scrap):
             missing_scrap = [col for col in required_cols_scrap if col not in df_scrap_nuevo.columns]
             print(f"Error: Faltan columnas requeridas en la hoja 'ScrapNuevo': {missing_scrap}")
        else:
            print(f"Usando columnas para Ticker: '{ticker_column_name}'")
            print(f"Usando columnas para Name: '{name_column_name}'")
            print(f"Usando columnas para Link: '{link_column_name}'")

            # Usar la columna 'TICKER' para emparejar filas
            # Seleccionamos solo las columnas relevantes antes del merge para evitar problemas con otras columnas
            df_combined_main = pd.merge(df_calculado[[ticker_column_name, name_column_name, link_column_name]],
                                      df_scrap_nuevo[[ticker_column_name, link_column_name]],
                                      on=ticker_column_name, # Realizar el merge en la columna 'TICKER'
                                      suffixes=('_calc', '_scrap'),
                                      how='inner') # Usar inner join para procesar solo tickers presentes en ambas listas


            if df_combined_main.empty:
                 print("No se encontraron tickers coincidentes entre las hojas Calculado y ScrapNuevo para unificar (usando la columna 'TICKER').")
            else:
                # Asegurarse de que las columnas de enlaces existan después del merge
                required_merged_cols = [ticker_column_name, name_column_name, link_column_name + '_calc', link_column_name + '_scrap']
                if not all(col in df_combined_main.columns for col in required_merged_cols):
                     missing = [col for col in required_merged_cols if col not in df_combined_main.columns]
                     print(f"Error: Faltan columnas esperadas en el DataFrame principal combinado después del merge: {missing}. Columnas disponibles: {df_combined_main.columns.tolist()}")
                else:
                    # Iniciar un bloque try para la iteración sobre filas y procesamiento de spreadsheets vinculados
                    try:
                        for index, row in df_combined_main.iterrows():
                            ticker = row[ticker_column_name]
                            name = row[name_column_name]
                            link_calc = row[link_column_name + '_calc']
                            link_scrap = row[link_column_name + '_scrap']

                            print(f"\nProcesando Ticker: {ticker} - {name}")

                            id_calc = get_spreadsheet_id_from_url(link_calc)
                            id_scrap = get_spreadsheet_id_from_url(link_scrap)

                            if id_calc and id_scrap:
                                # Crear el nuevo spreadsheet para este Ticker
                                new_spreadsheet_title = f"{ticker} - Combined Data"
                                new_spreadsheet = create_and_populate_sheet(client, new_spreadsheet_title)
                                time.sleep(3)  # Pausa más larga después de crear un nuevo spreadsheet

                                if new_spreadsheet:
                                    new_spreadsheet_url = new_spreadsheet.url

                                    # Obtener todos los títulos de hojas de ambos spreadsheets vinculados
                                    sheet_titles_calc = get_all_sheet_titles(client, id_calc)
                                    time.sleep(3)  # Pausa más larga entre spreadsheets
                                    sheet_titles_scrap = get_all_sheet_titles(client, id_scrap)
                                    time.sleep(3)  # Pausa más larga después de obtener todos los títulos

                                    # Combinar y obtener títulos únicos de ambas listas
                                    all_unique_sheet_titles = list(set(sheet_titles_calc + sheet_titles_scrap))

                                    if not all_unique_sheet_titles:
                                         print(f"Advertencia: No se encontraron hojas en los spreadsheets vinculados para {ticker}.")
                                         # Opcional: Considerar eliminar el nuevo spreadsheet si está vacío
                                         # client.del_spreadsheet(new_spreadsheet.id)
                                    else:
                                        print(f"Procesando {len(all_unique_sheet_titles)} hojas únicas para {ticker}: {all_unique_sheet_titles}")
                                        # Iterar sobre los títulos de hojas únicos
                                        for sheet_title in all_unique_sheet_titles:
                                            # print(f"  Procesando hoja: {sheet_title}") # Mensaje ajustado
                                            # Leer la hoja actual de ambos spreadsheets vinculados
                                            # get_sheet_data retornará un DataFrame o None si la hoja no existe o hay error
                                            df_calc_sheet = get_sheet_data(client, sheet_title, spreadsheet_id=id_calc)
                                            time.sleep(3)  # Pausa más larga entre hojas
                                            df_scrap_sheet = get_sheet_data(client, sheet_title, spreadsheet_id=id_scrap)
                                            time.sleep(3)  # Pausa más larga después de leer ambas hojas

                                            # Combinar los DataFrames de la hoja actual
                                            # print(f"  Intentando combinar hoja '{sheet_title}' para {ticker}.") # Mensaje ajustado
                                            df_combined_sheet = combine_financial_data(df_calc_sheet, df_scrap_sheet)

                                            # Poblar la hoja correspondiente en el nuevo spreadsheet
                                            if not df_combined_sheet.empty:
                                                populate_worksheet(new_spreadsheet, sheet_title, df_combined_sheet)
                                                time.sleep(3)  # Pausa más larga después de poblar una hoja
                                            else:
                                                # print(f"  Hoja '{sheet_title}' combinada para {ticker} está vacía, no se añadirá al nuevo spreadsheet.") # Mensaje ajustado
                                                pass # No hacer nada si el DataFrame combinado está vacío para esta hoja

                                        # Después de procesar todas las hojas, añadir la fila a la hoja Results principal
                                        add_row_to_results_sheet(client, ticker, name, new_spreadsheet_url)
                                        time.sleep(3)  # Pausa más larga después de añadir la fila a Results

                                else:
                                    print(f"No se pudo crear el nuevo spreadsheet para {ticker}.")

                            else:
                                print(f"Saltando {ticker} debido a URL(s) inválida(s) o no extraíble(s). Calculado: {link_calc}, ScrapNuevo: {link_scrap}")
                    except Exception as e:
                        print(f"Ocurrió un error durante la iteración o procesamiento de filas: {e}") # Mensaje ajustado
    else:
        print("No se pudieron cargar los datos de las hojas principales (Calculado o ScrapNuevo) o están vacías.")
else:
    print("No se pudo autenticar con Google Sheets. Por favor, revisa las credenciales.")
