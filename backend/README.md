# Backend de Extractores de Bancos

Este backend procesa extractos bancarios en formato PDF y los convierte a Excel.

## Requisitos

- Python 3.8 o superior
- pip

## Instalación

1. Crear un entorno virtual:
```bash
python -m venv venv
```

2. Activar el entorno virtual:

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

3. Instalar dependencias:
```bash
pip install -r requirements.txt
```

## Ejecución

1. Activar el entorno virtual (si no está activo)

2. Ejecutar el servidor:
```bash
python server.py
```

El servidor estará disponible en `http://localhost:5000`

## Endpoints

### GET /health
Verifica el estado del servidor
```bash
curl http://localhost:5000/health
```

### GET /extractors
Lista todos los extractores disponibles
```bash
curl http://localhost:5000/extractors
```

### POST /extract
Extrae datos de un PDF bancario
```bash
curl -X POST http://localhost:5000/extract \
  -F "pdf=@extracto.pdf" \
  -F "banco=banco_galicia"
```

### POST /pdf-to-ocr
Convierte PDF escaneado a PDF con texto copiable
```bash
curl -X POST http://localhost:5000/pdf-to-ocr \
  -F "pdf=@documento_escaneado.pdf"
```

### GET /download/<filename>
Descarga el archivo Excel generado
```bash
curl http://localhost:5000/download/archivo_extraido.xlsx -o resultado.xlsx
```

### GET /download-pdf/<filename>
Descarga el archivo PDF con OCR generado
```bash
curl http://localhost:5000/download-pdf/archivo_ocr.pdf -o resultado.pdf
```

## Bancos Soportados

- Banco Galicia
- Banco Galicia Más
- Mercado Pago
- Banco Comafi
- Banco JP Morgan
- Banco BIND
- Banco Supervielle
- Banco Cabal
- Banco Credicoop
- Banco CMF
- Banco Santander
- Banco del Sol
- Banco Ciudad
- Banco BBVA
- Banco ICBC
- Banco Macro
- Banco Nación

## Estructura de Archivos

```
backend/
├── server.py           # Servidor Flask principal
├── requirements.txt    # Dependencias Python
├── extractores/        # Scripts de extracción por banco
│   ├── extractor_banco_galicia.py
│   ├── extractor_mercado_pago_directo.py
│   └── ...
└── README.md          # Este archivo
```

## Desarrollo

Para agregar un nuevo extractor:

1. Crear un nuevo archivo `extractor_banco_nuevo.py` en la carpeta `extractores/`
2. Implementar la función `extraer_datos_banco_nuevo(pdf_path, excel_path=None)`
3. Agregar el banco al diccionario `BANCO_EXTRACTORS` en `server.py`

## Requisitos Adicionales para PDF a OCR

La funcionalidad de PDF a OCR requiere software adicional instalado en el sistema:

### Tesseract OCR (OBLIGATORIO)
Motor de reconocimiento óptico de caracteres.

**Windows:**
- Descargar desde: https://github.com/UB-Mannheim/tesseract/wiki
- O con chocolatey: `choco install tesseract`

**Linux (Ubuntu/Debian):**
```bash
sudo apt install tesseract-ocr tesseract-ocr-spa
```

**MacOS:**
```bash
brew install tesseract tesseract-lang
```

### Ghostscript (OPCIONAL pero RECOMENDADO)
Necesario para ocrmypdf (método preferido de OCR).

**Windows:**
- Descargar desde: https://ghostscript.com/releases/gsdnld.html

**Linux:**
```bash
sudo apt install ghostscript
```

**MacOS:**
```bash
brew install ghostscript
```

### Verificar Instalación

```bash
# Verificar Tesseract
tesseract --version
tesseract --list-langs

# Verificar Ghostscript
gs --version
```

## Notas

- Los archivos PDF se guardan temporalmente durante el procesamiento
- Los archivos Excel y PDF generados se almacenan en el directorio temporal del sistema
- Los archivos más antiguos de 1 hora se pueden limpiar con el endpoint `/cleanup`
- La funcionalidad de OCR requiere Tesseract instalado en el sistema
- El extractor intenta usar ocrmypdf (mejor calidad) o PyMuPDF (más rápido) automáticamente

