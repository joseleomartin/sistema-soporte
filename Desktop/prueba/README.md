# Datos Financieros

Proyecto para extracción y análisis de datos financieros de empresas desde Marketscreener y Yahoo Finance.

## Descripción

Este proyecto automatiza la extracción de datos financieros de empresas, realiza análisis de regresión lineal, cálculos de DCF (Discounted Cash Flow) y actualiza los resultados en Google Sheets.

## Características

- Extracción automática de datos financieros desde Marketscreener
- Integración con Yahoo Finance para datos históricos
- Cálculos de DCF con múltiples escenarios (Average, Std+, Std-)
- Regresión lineal para predicciones
- Actualización automática en Google Sheets
- Logs detallados para seguimiento del proceso

## Requisitos

- Python 3.x
- Chrome/Chromium instalado
- Cuenta de Google con acceso a Google Sheets API
- Credenciales de servicio de Google (archivo JSON)

## Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/joseleomartin/DatosFinancieros.git
cd DatosFinancieros
```

2. Instalar dependencias:
```bash
pip install -r requirements.txt
```

3. Configurar credenciales de Google:
   - Colocar el archivo JSON de credenciales de servicio en la carpeta del proyecto
   - Asegurarse de que el archivo tenga los permisos necesarios para Google Sheets y Drive

4. Configurar archivo de códigos de stock:
   - Crear un archivo Excel `StockCodes.xlsx` con los códigos de stock a procesar

## Uso

Ejecutar el script principal:
```bash
python Lineal.py
```

El script procesará todos los códigos de stock especificados en `StockCodes.xlsx` y actualizará los resultados en Google Sheets.

## Estructura del Proyecto

- `Lineal.py`: Script principal que contiene toda la lógica de extracción y procesamiento
- `requirements.txt`: Dependencias del proyecto
- `StockCodes.xlsx`: Archivo con códigos de stock a procesar (no incluido en el repositorio)
- `Resultados/`: Carpeta donde se guardan los archivos Excel generados (no incluida en el repositorio)

## Notas

- Los archivos de credenciales (JSON) y archivos Excel generados no se incluyen en el repositorio por seguridad
- El proceso puede tomar tiempo dependiendo del número de stocks a procesar
- Se recomienda revisar los logs para monitorear el progreso

## Autor

José León Martín

