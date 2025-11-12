# Sistema de Extracción de Extractos Bancarios

Este sistema permite extraer datos de extractos bancarios en formato PDF y convertirlos a Excel.

## Arquitectura

El sistema está compuesto por:

1. **Frontend (React + TypeScript)**: Interfaz web moderna para cargar PDFs y descargar resultados
2. **Backend (Flask + Python)**: Servidor que ejecuta los extractores específicos de cada banco

## Inicio Rápido

### 1. Iniciar el Backend

**En Windows:**
```bash
cd backend
start.bat
```

**En Linux/Mac:**
```bash
cd backend
chmod +x start.sh
./start.sh
```

El backend estará disponible en `http://localhost:5000`

### 2. Iniciar el Frontend

En una terminal separada:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### 3. Usar la Herramienta

1. Accede a la aplicación web
2. Ve a **Herramientas** en el menú lateral
3. Haz clic en **Extractor de Tablas**
4. Selecciona el banco del extracto
5. Arrastra y suelta (o selecciona) el PDF
6. Haz clic en **Extraer Datos**
7. Descarga el archivo Excel generado

## Bancos Soportados

El sistema soporta extractos de 17 bancos argentinos:

- ✅ Banco Galicia
- ✅ Banco Galicia Más
- ✅ Mercado Pago
- ✅ Banco Comafi
- ✅ Banco JP Morgan
- ✅ Banco BIND
- ✅ Banco Supervielle
- ✅ Banco Cabal
- ✅ Banco Credicoop
- ✅ Banco CMF
- ✅ Banco Santander
- ✅ Banco del Sol
- ✅ Banco Ciudad
- ✅ Banco BBVA
- ✅ Banco ICBC
- ✅ Banco Macro
- ✅ Banco Nación

## Requisitos del Sistema

### Backend
- Python 3.8+
- pip
- Bibliotecas: pandas, pdfplumber, camelot-py, openpyxl

### Frontend
- Node.js 16+
- npm

## Estructura del Proyecto

```
project/
├── backend/
│   ├── server.py              # Servidor Flask
│   ├── requirements.txt       # Dependencias Python
│   ├── start.bat             # Script de inicio Windows
│   ├── start.sh              # Script de inicio Linux/Mac
│   └── extractores/          # Scripts de extracción
│       ├── extractor_banco_galicia.py
│       ├── extractor_mercado_pago_directo.py
│       └── ... (17 extractores)
│
└── src/
    └── components/
        └── Tools/
            ├── ToolsPanel.tsx       # Panel de herramientas
            └── TableExtractor.tsx   # Componente extractor
```

## Solución de Problemas

### Backend no inicia
- Verifica que Python 3.8+ esté instalado: `python --version`
- Verifica que todas las dependencias estén instaladas: `pip list`
- Revisa los logs en la consola para errores específicos

### Error de conexión en el frontend
- Asegúrate de que el backend esté ejecutándose en `http://localhost:5000`
- Verifica que no haya firewall bloqueando el puerto 5000
- Revisa la consola del navegador para errores de CORS

### Error al procesar PDF
- Verifica que el PDF sea del banco correcto
- Asegúrate de que el PDF no esté corrupto
- Algunos PDFs con protección pueden no funcionar

### Extractor no disponible
- Verifica que el archivo del extractor exista en `backend/extractores/`
- Revisa que el banco esté correctamente configurado en `server.py`

## Desarrollo

### Agregar un Nuevo Banco

1. **Crear el extractor**
   - Crear `backend/extractores/extractor_banco_nuevo.py`
   - Implementar la función `extraer_datos_banco_nuevo(pdf_path, excel_path=None)`
   - La función debe retornar un DataFrame de pandas

2. **Registrar el extractor**
   - Editar `backend/server.py`
   - Agregar entrada en el diccionario `BANCO_EXTRACTORS`

3. **Actualizar el frontend**
   - Editar `src/components/Tools/TableExtractor.tsx`
   - Agregar el banco al array `bancos`

### Estructura de un Extractor

```python
import pdfplumber
import pandas as pd

def extraer_datos_banco_nuevo(pdf_path, excel_path=None):
    """
    Extrae datos de extracto del Banco Nuevo
    
    Args:
        pdf_path: Ruta al PDF a procesar
        excel_path: Ruta donde guardar el Excel (opcional)
    
    Returns:
        DataFrame con los datos extraídos
    """
    transacciones = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # Extraer datos de cada página
            texto = page.extract_text()
            # ... procesamiento específico del banco ...
            
    df = pd.DataFrame(transacciones)
    
    if excel_path:
        df.to_excel(excel_path, index=False)
    
    return df
```

## API del Backend

### Endpoints Disponibles

#### `GET /health`
Verifica el estado del servidor

**Respuesta:**
```json
{
  "status": "ok"
}
```

#### `GET /extractors`
Lista todos los extractores disponibles

**Respuesta:**
```json
{
  "extractors": ["banco_galicia", "mercado_pago", ...],
  "count": 17
}
```

#### `POST /extract`
Procesa un PDF y genera un Excel

**Parámetros:**
- `pdf`: Archivo PDF (multipart/form-data)
- `banco`: ID del banco (string)

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Extracción completada exitosamente",
  "filename": "archivo_extraido.xlsx",
  "rows": 150,
  "downloadUrl": "http://localhost:5000/download/archivo_extraido.xlsx"
}
```

**Respuesta con error:**
```json
{
  "success": false,
  "message": "Descripción del error"
}
```

#### `GET /download/<filename>`
Descarga un archivo Excel generado

**Respuesta:** Archivo Excel

#### `POST /cleanup`
Limpia archivos temporales más antiguos de 1 hora

**Respuesta:**
```json
{
  "success": true,
  "message": "Se limpiaron 5 archivos"
}
```

## Seguridad

- Los archivos PDF se eliminan inmediatamente después del procesamiento
- Los archivos Excel generados se almacenan temporalmente
- Se recomienda configurar limpieza automática en producción
- En producción, configurar CORS para permitir solo orígenes autorizados

## Licencia

Este proyecto es privado y de uso interno.

## Soporte

Para reportar problemas o solicitar nuevas funcionalidades, contacta al equipo de soporte.

