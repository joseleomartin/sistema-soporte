from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def setup_driver():
    chrome_options = Options()
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-popup-blocking")
    chrome_options.add_argument("--blink-settings=imagesEnabled=false")
    chrome_options.add_argument('--ignore-certificate-errors')  # Ignorar errores SSL
    chrome_options.add_argument('--disable-web-security')       # Desactivar seguridad web
    chrome_options.add_argument('--allow-running-insecure-content')  # Permitir contenido inseguro
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    return driver       

def extract_currency_from_url(driver, url):
    driver.get(url)

    try:
        # Intentar extraer desde el elemento alternativo
        alt_xpath = '/html/body/div[1]/div/div[1]/main/div[5]/div[1]/nav/div[2]/div[6]'
        try:
            WebDriverWait(driver, 30).until(
                EC.visibility_of_element_located((By.XPATH, alt_xpath))
            )
            alt_element = driver.find_element(By.XPATH, alt_xpath)
            alt_text = alt_element.text
            print(f"Texto extraído desde el elemento alternativo en {url}: {alt_text}")
        except Exception as e:
            print(f"Error al extraer el texto desde el elemento alternativo en {url}: {e}")
            # Redirigir a la URL con /finances al final si falla el primer intento
            fallback_url = url.rstrip('/') + '/finances'
            driver.get(fallback_url)

            fallback_xpath = '//*[@id="income-statement-annual"]/div/div[4]/div[1]/span'  # Reemplazar con el XPath correcto
            try:
                WebDriverWait(driver, 30).until(
                    EC.visibility_of_element_located((By.XPATH, fallback_xpath))
                )
                fallback_element = driver.find_element(By.XPATH, fallback_xpath)
                fallback_text = fallback_element.text
                print(f"Texto extraído desde la página de fallback en {fallback_url}: {fallback_text}")
            except Exception as e:
                print(f"Error al extraer el texto desde la página de fallback en {fallback_url}: {e}")
        
    except Exception as e:
        print(f"Error al cargar la página {url}: {e}")

def extract_currency(urls):
    driver = setup_driver()

    try:
        for url in urls:
            extract_currency_from_url(driver, url)
    finally:
        driver.quit()

# Lista de URLs de prueba
urls = [
    "https://www.marketscreener.com/quote/stock/TELECOM-ARGENTINA-S-A-14577/finances-income-statement/",  # Reemplaza con más URLs de ejemplo
    # Agrega más URLs según sea necesario
]

# Ejecuta la función para extraer datos de todas las URLs
extract_currency(urls)
