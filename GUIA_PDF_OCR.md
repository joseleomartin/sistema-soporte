# 📄 Guía: Herramienta PDF a OCR

## 🎯 ¿Qué hace esta herramienta?

La herramienta **PDF a OCR** convierte PDFs escaneados (que son imágenes) en PDFs con texto real y copiable, manteniendo exactamente la misma apariencia visual.

### ✅ Antes y Después

**Antes (PDF Escaneado):**
- ❌ El texto es una imagen
- ❌ No puedes copiar el texto
- ❌ No puedes buscar dentro del PDF
- ❌ No puedes editar el contenido

**Después (PDF con OCR):**
- ✅ El texto es real y copiable
- ✅ Puedes copiar todo el contenido
- ✅ Puedes buscar palabras en el PDF
- ✅ Mantiene la apariencia idéntica al original

---

## 🚀 Cómo Usar

### Paso 1: Acceder a la Herramienta
1. Inicia sesión en la aplicación
2. Ve a **"Herramientas"** en el menú izquierdo
3. Haz clic en **"PDF a OCR"**

### Paso 2: Cargar tu PDF
- **Opción A:** Arrastra y suelta el PDF en la zona de carga
- **Opción B:** Haz clic en la zona de carga y selecciona el archivo

### Paso 3: Convertir
1. Haz clic en el botón **"Convertir a OCR"**
2. Verás un mensaje: "Conversión OCR iniciada..."
3. Puedes navegar a otras secciones mientras se procesa

### Paso 4: Descargar
1. El panel de notificaciones mostrará el progreso
2. Cuando termine, verás: "✅ PDF convertido exitosamente"
3. Haz clic en **"Descargar PDF"**
4. ¡Listo! Tu PDF ahora tiene texto copiable

---

## 💡 Casos de Uso Comunes

### 1. Facturas Escaneadas
```
Problema: Tienes facturas escaneadas sin texto copiable
Solución: Convierte a OCR para poder buscar y copiar números
```

### 2. Contratos y Documentos Legales
```
Problema: Documentos legales solo como imagen
Solución: OCR para buscar cláusulas específicas rápidamente
```

### 3. Extractos Bancarios Antiguos
```
Problema: Extractos históricos solo en imagen
Solución: Convertir a texto para procesar con otros extractores
```

### 4. Libros y Documentos Históricos
```
Problema: Documentos antiguos digitalizados como imagen
Solución: OCR para hacer el contenido buscable y accesible
```

### 5. Formularios y Planillas
```
Problema: Formularios escaneados sin texto editable
Solución: Convertir para poder copiar datos a sistemas
```

---

## ⚙️ Requisitos del Sistema

### Software Necesario en el Servidor

#### 1. **Tesseract OCR** (OBLIGATORIO)
Motor de reconocimiento óptico de caracteres.

**Windows:**
```bash
# Descargar instalador desde:
# https://github.com/UB-Mannheim/tesseract/wiki

# O usar chocolatey:
choco install tesseract
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install tesseract-ocr
sudo apt install tesseract-ocr-spa  # Para español
```

**MacOS:**
```bash
brew install tesseract
brew install tesseract-lang  # Para idiomas adicionales
```

#### 2. **PyMuPDF** (pymupdf) - RECOMENDADO
Biblioteca para manipulación de PDFs.

```bash
pip install pymupdf
```

#### 3. **ocrmypdf** (OPCIONAL pero RECOMENDADO)
Herramienta avanzada de OCR para PDFs.

```bash
pip install ocrmypdf
```

**Nota:** ocrmypdf requiere Ghostscript:
- **Windows:** https://ghostscript.com/releases/gsdnld.html
- **Linux:** `sudo apt install ghostscript`
- **MacOS:** `brew install ghostscript`

#### 4. **Dependencias Python**
Todas incluidas en `requirements.txt`:
```
pytesseract==0.3.10
Pillow==10.1.0
PyMuPDF==1.23.8
ocrmypdf==15.4.4
opencv-python==4.8.1.78
```

---

## 🔧 Instalación Completa

### Paso a Paso (Windows)

```batch
REM 1. Instalar Tesseract OCR
REM Descargar desde: https://github.com/UB-Mannheim/tesseract/wiki
REM Instalar en: C:\Program Files\Tesseract-OCR\

REM 2. Instalar Ghostscript (opcional)
REM Descargar desde: https://ghostscript.com/releases/gsdnld.html

REM 3. Activar entorno virtual
cd backend
venv\Scripts\activate

REM 4. Instalar dependencias Python
pip install -r requirements.txt

REM 5. Verificar instalación
python -c "import pytesseract; print(pytesseract.get_tesseract_version())"
```

### Paso a Paso (Linux)

```bash
# 1. Instalar Tesseract OCR
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-spa

# 2. Instalar Ghostscript (opcional)
sudo apt install ghostscript

# 3. Activar entorno virtual
cd backend
source venv/bin/activate

# 4. Instalar dependencias Python
pip install -r requirements.txt

# 5. Verificar instalación
tesseract --version
python -c "import pytesseract; print(pytesseract.get_tesseract_version())"
```

---

## 🎨 Características Técnicas

### Métodos de OCR Disponibles

El sistema intenta usar el mejor método disponible automáticamente:

#### **Método 1: ocrmypdf** (Preferido)
- ✅ Mejor calidad de OCR
- ✅ Optimización automática
- ✅ Soporte multi-idioma
- ⚠️ Requiere Ghostscript

#### **Método 2: PyMuPDF + Tesseract** (Alternativo)
- ✅ No requiere Ghostscript
- ✅ Más rápido
- ✅ Funciona en cualquier sistema con Tesseract
- ⚠️ Calidad ligeramente menor

### Configuración de OCR

El extractor usa múltiples modos de escaneo para capturar TODO el texto:

- **PSM 3:** Modo automático (mejor para tablas)
- **PSM 6:** Bloque uniforme de texto
- **PSM 11:** Texto disperso

Esto asegura que se capture:
- ✅ Tablas y columnas
- ✅ Texto corrido
- ✅ Números y datos
- ✅ Encabezados y pie de página

---

## 🔍 Calidad del OCR

### Factores que Afectan la Calidad

**✅ Buena Calidad:**
- PDFs escaneados a 300 DPI o más
- Texto claro y legible
- Fondo limpio sin manchas
- Orientación correcta de la página

**❌ Mala Calidad:**
- Escaneado a baja resolución (< 150 DPI)
- Texto borroso o manchado
- Fondo con ruido o texturas
- Páginas torcidas o mal alineadas

### Consejos para Mejores Resultados

1. **Escanea a alta resolución** - Mínimo 300 DPI
2. **Usa PDFs originales** - No copies de copias
3. **Páginas rectas** - Evita páginas torcidas
4. **Buen contraste** - Texto negro en fondo blanco ideal
5. **Limpieza** - Elimina manchas y marcas

---

## 📊 Rendimiento

### Tiempos de Procesamiento Aproximados

| Páginas | Método ocrmypdf | Método PyMuPDF |
|---------|----------------|----------------|
| 1-5     | 10-30 seg      | 5-15 seg       |
| 6-20    | 30-90 seg      | 15-45 seg      |
| 21-50   | 2-5 min        | 1-3 min        |
| 51-100  | 5-10 min       | 3-6 min        |

**Nota:** Los tiempos varían según:
- Resolución del PDF
- Complejidad del contenido
- Potencia del servidor
- Carga del sistema

---

## ❓ Problemas Comunes

### "Tesseract no encontrado"

**Solución:**
```bash
# Verificar instalación
tesseract --version

# Si no está instalado:
# Windows: Descargar de https://github.com/UB-Mannheim/tesseract/wiki
# Linux: sudo apt install tesseract-ocr
# MacOS: brew install tesseract
```

### "Error: No se pudo generar el archivo PDF"

**Causas posibles:**
1. PDF corrupto o protegido
2. Falta de espacio en disco
3. Permisos insuficientes

**Solución:**
- Verificar que el PDF se abre correctamente
- Verificar espacio en disco
- Intentar con otro PDF para descartar el archivo

### "OCR produce texto ilegible"

**Causas:**
- PDF de muy baja calidad
- Texto muy pequeño
- Idioma no configurado

**Solución:**
```bash
# Instalar paquete de idioma español
# Linux:
sudo apt install tesseract-ocr-spa

# Verificar idiomas disponibles:
tesseract --list-langs
```

### "Conversión muy lenta"

**Solución:**
- Reducir resolución del PDF original
- Procesar pocas páginas a la vez
- Usar método PyMuPDF en vez de ocrmypdf
- Actualizar hardware del servidor

---

## 🔐 Seguridad y Privacidad

### Procesamiento Local
- ✅ Todo el procesamiento es local en el servidor
- ✅ No se envían PDFs a servicios externos
- ✅ Los archivos temporales se eliminan automáticamente

### Archivos Temporales
- PDFs de entrada se eliminan inmediatamente después del procesamiento
- PDFs de salida se mantienen por 1 hora
- Limpieza automática de archivos antiguos

### Recomendaciones
- No subas documentos confidenciales sin autorización
- Descarga los PDFs procesados inmediatamente
- Elimina archivos del panel de notificaciones cuando no los necesites

---

## 🚀 Procesamiento en Segundo Plano

Al igual que el Extractor de Tablas, esta herramienta procesa en segundo plano:

1. **Inicia conversión** → Puedes navegar libremente
2. **Panel de notificaciones** → Muestra progreso en tiempo real
3. **Badge en sidebar** → Indica trabajos activos
4. **Descarga cuando esté listo** → Desde cualquier lugar

### Ver Progreso
- Panel flotante en esquina inferior derecha
- Barra de progreso en tiempo real
- Notificación cuando termina
- Botón de descarga directo

---

## 📈 Ejemplos de Uso

### Ejemplo 1: Factura Escaneada

```
1. Usuario carga "Factura_Enero_2025.pdf" (escaneado)
2. Hace clic en "Convertir a OCR"
3. Sistema procesa en segundo plano (30 segundos)
4. Descarga "Factura_Enero_2025_OCR.pdf"
5. Ahora puede copiar números de factura, montos, etc.
```

### Ejemplo 2: Contrato Legal

```
1. Usuario tiene contrato escaneado de 20 páginas
2. Carga el PDF y convierte a OCR
3. Continúa trabajando en otras tareas
4. Recibe notificación cuando termina (2 minutos)
5. Descarga el PDF
6. Ahora puede buscar cláusulas específicas con Ctrl+F
```

### Ejemplo 3: Extracto Bancario Antiguo

```
1. Usuario tiene extracto antiguo solo como imagen
2. Convierte a OCR primero
3. Luego usa "Extractor de Tablas" con el PDF OCR
4. Obtiene Excel con todas las transacciones
```

---

## 📞 Soporte

### Verificar Configuración

```bash
# Backend
cd backend
python check_setup.py

# Ver versión de Tesseract
tesseract --version

# Ver idiomas disponibles
tesseract --list-langs
```

### Si Nada Funciona

1. Verifica que Tesseract esté instalado
2. Verifica que las dependencias Python estén instaladas
3. Prueba con un PDF simple de 1 página
4. Revisa los logs del backend
5. Contacta al administrador del sistema

---

## 🎉 ¡Listo para Usar!

La herramienta está completamente integrada con:
- ✅ Procesamiento en segundo plano
- ✅ Panel de notificaciones
- ✅ Indicadores visuales
- ✅ Descarga automática
- ✅ Múltiples archivos simultáneos

**¡Convierte tus PDFs escaneados en documentos completamente buscables!** 🚀

---

**Versión:** 1.0.0  
**Fecha:** 11 de Noviembre, 2025  
**Estado:** ✅ Funcional (requiere instalación de Tesseract)
















