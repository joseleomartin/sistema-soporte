from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from lxml import etree
import pandas as pd

# Configuración de Selenium
chrome_options = Options()
chrome_options.add_argument("--headless")  # Ejecuta en modo headless (sin ventana)

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
driver.get("https://www.marketscreener.com/quote/stock/ALPHABET-INC-24203385/finances-cash-flow-statement/") 

try:
    # Esperar a que la tabla se cargue y desplazarse hacia abajo para asegurarse de que todo se carga
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    
    WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.XPATH, '//*[@id="horizontalFinancialTableN1_3"]/tbody/tr')))
    
    # Capturar el HTML de la página después de cargar la tabla
    html = driver.page_source
    print("HTML capturado con éxito")
    
    # Guardar el HTML capturado para inspección manual
    with open("captura.html", "w", encoding="utf-8") as file:
        file.write(html)
    print("HTML guardado para inspección manual.")
    
finally:
    driver.quit()

# Parsear el HTML con lxml
dom = etree.HTML(html)

# Seleccionar todas las filas de la tabla usando XPath
rows = dom.xpath('//*[@id="horizontalFinancialTableN1_3"]/tbody/tr')

# Inicializar una lista para guardar los datos de todas las filas
table_data = []

# Iterar sobre cada fila de la tabla
for row in rows:
    cells = row.xpath(".//td | .//th")  # Seleccionar todas las celdas de la fila
    row_data = []
    
    for i, cell in enumerate(cells):
        # Extraer el texto de todos los elementos hijos dentro de la celda
        text = ''.join(cell.xpath(".//text()")).strip()
        
        # Verificar si la celda está vacía y añadir un marcador (como '' para indicar celda vacía)
        if text == '':
            row_data.append('')
        else:
            row_data.append(text)
        
        # Imprimir cada celda para verificar su contenido
        print(f"Celda {i}: '{text}'")
    
    # Añadir los datos de la fila a la lista general
    table_data.append(row_data)

# Imprimir los datos de la tabla para verificar
print("Datos de la tabla:", table_data)

# Crear el DataFrame con pandas
df = pd.DataFrame(table_data)

# Guardar el DataFrame en un archivo Excel
df.to_excel(r"C:\Users\relim\Desktop\prueba\tabla_completa.xlsx", index=False, header=False)
print("Tabla completa guardada en 'tabla_completa.xlsx'")