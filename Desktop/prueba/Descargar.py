import os
import re
import requests
import gspread
from google.oauth2.service_account import Credentials

# 📌 Ruta del archivo JSON con credenciales
SERVICE_ACCOUNT_FILE = r"C:/Users/relim/Desktop/prueba/durable-binder-432321-q4-5f1ef9e64ea1.json"

# 📌 Definir los permisos necesarios
SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]

# 🔑 Autenticación con Google API
creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
client = gspread.authorize(creds)

# 📂 Carpeta donde se guardarán los archivos descargados
CARPETA_DESCARGA = r"F:\Excels"

# Crear la carpeta si no existe
if not os.path.exists(CARPETA_DESCARGA):
    os.makedirs(CARPETA_DESCARGA)

# 📊 ID del Google Spreadsheet principal
SPREADSHEET_ID = "193GrDtaNCWBkWwliitjSepbLlAcNlwQfUZp66WN6xyw"  # Reemplaza con el ID correcto

# 📄 Acceder a la hoja "prueba"
sheet = client.open_by_key(SPREADSHEET_ID).worksheet("Notocar")

# 📥 Leer la columna G (que contiene los enlaces a otros Spreadsheets)
urls = sheet.col_values(8)  # Columna G es la número 7

# 🔍 Expresión regular para extraer el ID del Spreadsheet desde la URL
def extract_spreadsheet_id(url):
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", url)
    return match.group(1) if match else None

# 🔽 Función para obtener el nombre del Spreadsheet
def get_spreadsheet_name(spreadsheet_id):
    try:
        spreadsheet = client.open_by_key(spreadsheet_id)
        return spreadsheet.title  # Retorna el nombre del archivo
    except Exception as e:
        print(f"⚠️ Error al obtener el nombre de {spreadsheet_id}: {e}")
        return spreadsheet_id  # En caso de error, usa el ID como nombre

# 🔽 Función para obtener un nombre predefinido en caso de que quieras usar nombres específicos
def get_custom_name(spreadsheet_id):
    # Mapeo de ID a nombres personalizados (puedes agregar más si es necesario)
    name_mapping = {
        '1GB_F5TndK32eJUwS8iBCbRJiLb6CyaqBnVDU8TMFk4M': 'KB-FINANCIAL-GROUP-INC-4753228',
        # Puedes agregar más mapeos de ID a nombre aquí
    }
    
    # Si el ID está en el mapeo, devuelve el nombre correspondiente
    return name_mapping.get(spreadsheet_id, get_spreadsheet_name(spreadsheet_id))  # Si no hay mapeo, usa el nombre por defecto

# 🔽 Función para descargar el Spreadsheet completo como Excel (.xlsx)
def download_spreadsheet(spreadsheet_id, output_folder):
    try:
        # Obtener el nombre del Spreadsheet (con el mapeo personalizado si es necesario)
        spreadsheet_name = get_custom_name(spreadsheet_id)
        
        # Asegurar que el nombre sea válido para un archivo
        spreadsheet_name = re.sub(r'[\/:*?"<>|]', '', spreadsheet_name)  # Quitar caracteres no permitidos en nombres de archivos

        # URL para exportar el Spreadsheet en formato Excel (.xlsx)
        export_url = f"https://www.googleapis.com/drive/v3/files/{spreadsheet_id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        # Autorización con el token de acceso
        headers = {"Authorization": f"Bearer {creds.token}"}
        
        # Descargar el archivo
        response = requests.get(export_url, headers=headers)
        
        if response.status_code == 200:
            file_path = os.path.join(output_folder, f"{spreadsheet_name}.xlsx")  # Guardar con el nombre real
            with open(file_path, "wb") as file:
                file.write(response.content)
            print(f"✅ Descargado: {file_path}")
        else:
            print(f"⚠️ Error al descargar {spreadsheet_id}: {response.text}")
    
    except Exception as e:
        print(f"⚠️ Error: {e}")

# 🔽 Descargar cada Spreadsheet listado en la columna G
for url in urls:
    spreadsheet_id = extract_spreadsheet_id(url)
    if spreadsheet_id:
        download_spreadsheet(spreadsheet_id, CARPETA_DESCARGA)
