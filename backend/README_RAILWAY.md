# Despliegue en Railway.app

## 📋 Resumen del Backend

Este es un servidor Flask que procesa PDFs bancarios y los convierte a Excel usando múltiples extractores especializados.

### Tecnologías Principales
- **Framework**: Flask 3.0.0
- **Servidor**: Gunicorn 21.2.0
- **Procesamiento PDF**: pdfplumber, PyMuPDF, camelot-py
- **OCR**: pytesseract, ocrmypdf
- **Excel**: pandas, openpyxl, xlsxwriter

---

## 🚀 Configuración para Railway

### 1. Variables de Entorno Necesarias

Railway proporciona automáticamente:
- `PORT` - Puerto dinámico (Railway lo asigna automáticamente)

Variables opcionales que puedes configurar:
```bash
# Opcional - para desarrollo local
EXTRACTOR_HOST=0.0.0.0
EXTRACTOR_PORT=5000
EXTRACTOR_DEBUG=false
```

### 2. Archivos de Configuración

#### `nixpacks.toml`
Configura el build y despliegue:
- Instala dependencias del sistema (tesseract-ocr, poppler-utils, ghostscript)
- Crea entorno virtual Python en /opt/venv
- Instala dependencias Python desde requirements.txt
- Inicia Gunicorn con configuración optimizada

#### Comando de inicio:
```bash
/opt/venv/bin/gunicorn server:app \
  --bind 0.0.0.0:$PORT \
  --workers 1 \
  --timeout 300 \
  --log-level info \
  --access-logfile - \
  --error-logfile - \
  --preload
```

### 3. Dependencias del Sistema

El proyecto necesita estas dependencias (ya configuradas en nixpacks.toml):
- `tesseract-ocr` - OCR para PDFs escaneados
- `tesseract-ocr-spa` - Lenguaje español para OCR
- `ghostscript` - Procesamiento de PDFs
- `poppler-utils` - Utilidades PDF (pdf2image, pdfinfo, etc.)
- `libgl1` - Requerido por opencv-python

---

## 📦 Pasos para Desplegar en Railway

### Opción A: Desde GitHub (Recomendado)

1. **Sube tu código a GitHub**:
   ```bash
   cd project/backend
   git init
   git add .
   git commit -m "Initial commit - Backend extractores"
   git remote add origin <tu-repo-github>
   git push -u origin main
   ```

2. **Crea nuevo proyecto en Railway**:
   - Ve a [railway.app](https://railway.app)
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Selecciona tu repositorio
   - Railway detectará automáticamente `nixpacks.toml`

3. **Configura el Root Directory**:
   - En Settings → General
   - Set Root Directory: `/project/backend`
   - Railway ahora buscará `nixpacks.toml` en esa carpeta

4. **Espera el despliegue**:
   - Railway construirá automáticamente usando nixpacks
   - Asignará un dominio público: `https://tu-app.up.railway.app`

### Opción B: Desde Railway CLI

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Inicializar proyecto
cd project/backend
railway init

# Desplegar
railway up
```

---

## 🧪 Probar Localmente Antes de Desplegar

### 1. Instalar Dependencias del Sistema (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-spa \
  ghostscript \
  poppler-utils \
  libgl1
```

### 2. Crear Entorno Virtual y Instalar Dependencias Python
```bash
cd project/backend

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# En Linux/Mac:
source venv/bin/activate
# En Windows:
venv\Scripts\activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Probar con el Servidor de Desarrollo Flask
```bash
export PORT=5000
python server.py
```

### 4. Probar con Gunicorn (Simular Railway)
```bash
export PORT=5000
gunicorn server:app \
  --bind 0.0.0.0:5000 \
  --workers 1 \
  --timeout 300 \
  --log-level info \
  --access-logfile - \
  --error-logfile - \
  --preload
```

### 5. Probar los Endpoints

**Health Check**:
```bash
curl http://localhost:5000/health
```

**Listar Extractores**:
```bash
curl http://localhost:5000/extractors
```

**Extraer Datos de PDF**:
```bash
curl -X POST http://localhost:5000/extract \
  -F "pdf=@/ruta/a/tu/archivo.pdf" \
  -F "banco=banco_galicia"
```

---

## 🔧 Solución de Problemas Comunes

### Error: "Address already in use"
```bash
# Buscar proceso usando el puerto
lsof -i :5000
# Matar el proceso
kill -9 <PID>
```

### Error: "Module not found"
```bash
# Reinstalar dependencias
pip install -r requirements.txt --force-reinstall
```

### Error: "tesseract not found"
```bash
# Verificar instalación
which tesseract
tesseract --version

# Reinstalar si es necesario
sudo apt-get install --reinstall tesseract-ocr
```

### Error 502 en Railway
- Revisa los logs en Railway Dashboard
- Asegúrate que el servidor escuche en `0.0.0.0:$PORT`
- Verifica que el health check responda en `/health`

### Timeout en Railway
- El timeout está configurado a 300 segundos (5 minutos)
- Para PDFs muy grandes, considera aumentarlo en nixpacks.toml

---

## 📊 Endpoints Disponibles

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Información del servidor |
| GET | `/health` | Health check |
| GET | `/extractors` | Lista de extractores disponibles |
| POST | `/extract` | Extraer datos de PDF bancario |
| POST | `/pdf-to-ocr` | Convertir PDF escaneado a PDF con OCR |
| GET | `/download/<filename>` | Descargar archivo Excel generado |
| GET | `/download-pdf/<filename>` | Descargar PDF con OCR |
| POST | `/cleanup` | Limpiar archivos temporales |

---

## 🏦 Bancos Soportados

El servidor incluye extractores para 16 bancos argentinos:
- Banco Galicia
- Banco Galicia Más
- Mercado Pago
- Banco Comafi
- JP Morgan
- Banco Bind
- Banco Supervielle
- Banco Cabal
- Banco Credicoop
- CMF
- Banco Santander
- Banco del Sol
- Banco Ciudad
- BBVA
- ICBC
- Banco Macro
- Banco Nación

---

## 📝 Notas Importantes

1. **Puerto**: Railway asigna `$PORT` dinámicamente. NUNCA uses un puerto fijo.
2. **Workers**: Se usa 1 worker para optimizar memoria en Railway.
3. **Timeout**: 300 segundos para procesar PDFs grandes.
4. **Logs**: Todo se registra en stdout/stderr para Railway Dashboard.
5. **Archivos Temporales**: Se guardan en `/tmp/extractores_temp` y se limpian automáticamente.
6. **CORS**: Configurado para permitir todos los orígenes.

---

## 🔗 Enlaces Útiles

- [Documentación Railway](https://docs.railway.app/)
- [Nixpacks Documentation](https://nixpacks.com/)
- [Gunicorn Configuration](https://docs.gunicorn.org/en/stable/settings.html)
- [Flask Deployment](https://flask.palletsprojects.com/en/3.0.x/deploying/)

---

## ✅ Checklist Pre-Deploy

- [ ] `nixpacks.toml` está en la raíz de backend/
- [ ] `requirements.txt` tiene todas las dependencias
- [ ] `server.py` NO ejecuta `app.run()` cuando se importa
- [ ] Variables de entorno configuradas en Railway
- [ ] Root directory configurado correctamente
- [ ] Código testeado localmente con Gunicorn
- [ ] Repository conectado a Railway
- [ ] Health check funciona correctamente

---

¡Listo para desplegar! 🚀




