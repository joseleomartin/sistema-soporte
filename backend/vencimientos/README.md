# Scraper de Vencimientos - Estudio del Amo

Este script extrae tablas de vencimientos de múltiples páginas del sitio web de Estudio del Amo.

## Instalación

1. Instala las dependencias necesarias:

```bash
pip install -r requirements.txt
```

## Uso

Ejecuta el script:

```bash
python scraper_vencimientos.py
```

## Funcionalidades

- Extrae tablas de 8 páginas diferentes de vencimientos
- Genera archivos Excel (.xlsx) con formato profesional:
  - Encabezados con fondo azul y texto blanco en negrita
  - Bordes en todas las celdas
  - Ancho de columnas ajustado automáticamente
  - Primera fila congelada para fácil navegación
  - Alineación optimizada (primera columna a la izquierda, resto centrado)
- Archivos individuales por cada página
- Archivo consolidado con todas las tablas
- Elimina duplicados automáticamente
- Manejo de errores robusto
- Progreso detallado en consola

## URLs procesadas

- Retenciones SICORE
- Autónomos
- IVA
- Convenio Multilateral / Ingresos Brutos
- Cargas Sociales - Relación de Dependencia
- Cargas Sociales - Servicio Doméstico
- Ganancias - Personas Físicas / Bienes Personales
- Ganancias - Personas Jurídicas

## Salida

El script genera:
- Archivos Excel individuales formateados por cada página (con timestamp)
- Un archivo Excel consolidado formateado con todas las tablas (con timestamp)

Todos los archivos incluyen formato profesional y un timestamp en el nombre para evitar sobrescrituras.

