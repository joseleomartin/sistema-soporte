#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import pandas as pd
import time

url = 'https://www.agip.gob.ar/vencimientos'

print(f"Probando extracción de: {url}")
print("="*80)

# Configurar Chrome en modo headless
chrome_options = Options()
chrome_options.add_argument('--headless')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')
chrome_options.add_argument('--disable-gpu')
chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

try:
    print("\n1. Inicializando Chrome...")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    print("2. Cargando página...")
    driver.get(url)
    
    print("3. Esperando 3 segundos...")
    time.sleep(3)
    
    # Intentar hacer clic en elementos expandibles si existen
    print("4. Buscando elementos expandibles...")
    try:
        expandibles = driver.find_elements(By.CLASS_NAME, "accordion")
        print(f"   Encontrados {len(expandibles)} elementos accordion")
        
        # Buscar botones o divs clickeables
        botones = driver.find_elements(By.TAG_NAME, "button")
        print(f"   Encontrados {len(botones)} botones")
        
        # Intentar expandir el primero
        if expandibles:
            try:
                expandibles[0].click()
                print("   Expandido primer accordion")
                time.sleep(2)
            except:
                pass
    except Exception as e:
        print(f"   No hay accordions: {e}")
    
    print("\n5. Esperando 5 segundos más...")
    time.sleep(5)
    
    # Buscar tablas por diferentes métodos
    print("\n6. Buscando tablas...")
    
    # Método 1: Por tag
    tablas_tag = driver.find_elements(By.TAG_NAME, "table")
    print(f"   Por TAG: {len(tablas_tag)} tablas")
    
    # Método 2: Por clase
    tablas_clase = driver.find_elements(By.CSS_SELECTOR, ".table")
    print(f"   Por CLASE .table: {len(tablas_clase)} tablas")
    
    # Método 3: En el HTML completo
    html_content = driver.page_source
    soup = BeautifulSoup(html_content, 'html.parser')
    tablas_soup = soup.find_all('table')
    print(f"   En HTML (BeautifulSoup): {len(tablas_soup)} tablas")
    
    # Guardar HTML para inspección
    with open('agip_html.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("\n7. HTML guardado en agip_html.html")
    
    # Buscar divs o secciones con contenido de vencimientos
    print("\n8. Buscando contenido de vencimientos...")
    vencimientos_divs = driver.find_elements(By.XPATH, "//*[contains(text(), 'vencimiento') or contains(text(), 'Vencimiento')]")
    print(f"   Encontrados {len(vencimientos_divs)} elementos con 'vencimiento'")
    
    # Intentar extraer alguna tabla si existe
    if tablas_soup:
        print("\n9. Intentando extraer tablas encontradas...")
        for i, tabla in enumerate(tablas_soup, 1):
            try:
                dfs = pd.read_html(str(tabla))
                if dfs:
                    df = dfs[0]
                    print(f"\n   Tabla {i}:")
                    print(f"   Shape: {df.shape}")
                    print(f"   Columnas: {list(df.columns)}")
                    print(f"   Primeras filas:")
                    print(df.head(3))
            except Exception as e:
                print(f"   Error tabla {i}: {e}")
    
    print("\n" + "="*80)
    print("Prueba completada. Revisa agip_html.html para ver el contenido")
    
finally:
    driver.quit()
    print("\nDriver cerrado")

