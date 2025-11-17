# 🔧 Solución: Error de Directorio Temporal

## 🐛 Problema Identificado

**Error en los logs**:
```
Error general: [Errno 2] No such file or directory: 'C:\\Users\\relim\\AppData\\Local\\Temp\\extractores_temp\\banco_galicia_Extracto Banco Galicia.pdf'
```

**Causa**: El directorio temporal no existe o no se puede crear.

---

## ✅ Solución Aplicada

He corregido el código del servidor para:

1. **Crear el directorio con `parents=True`**: Asegura que se creen todos los directorios padres si no existen
2. **Manejo de errores**: Si falla, usa un directorio alternativo en la carpeta del proyecto
3. **Limpiar nombres de archivo**: Remueve espacios y caracteres problemáticos del nombre del archivo
4. **Verificar directorio antes de guardar**: Asegura que el directorio existe antes de guardar cada archivo

---

## 🔄 Cambios Realizados

### 1. Creación del Directorio Temporal (Inicio del servidor)

```python
# Antes:
TEMP_DIR.mkdir(exist_ok=True)

# Ahora:
try:
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Directorio temporal creado/verificado: {TEMP_DIR}")
except Exception as e:
    logger.error(f"Error al crear directorio temporal: {e}")
    # Fallback a directorio en la carpeta del proyecto
    TEMP_DIR = Path(__file__).parent / 'temp'
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Usando directorio temporal alternativo: {TEMP_DIR}")
```

### 2. Guardar Archivo en `/extract`

```python
# Antes:
pdf_filename = f"{banco_id}_{pdf_file.filename}"
pdf_path = TEMP_DIR / pdf_filename
pdf_file.save(str(pdf_path))

# Ahora:
pdf_filename = f"{banco_id}_{pdf_file.filename}"
# Limpiar nombre de archivo (remover caracteres problemáticos)
pdf_filename = pdf_filename.replace(' ', '_').replace('/', '_').replace('\\', '_')
pdf_path = TEMP_DIR / pdf_filename

# Asegurar que el directorio existe
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Guardar archivo
pdf_file.save(str(pdf_path))
logger.info(f"PDF guardado temporalmente en: {pdf_path}")
```

### 3. Guardar Archivo en `/pdf-to-ocr`

Mismo cambio aplicado para consistencia.

---

## 🚀 Próximos Pasos

### PASO 1: Reiniciar el Servidor

**Cierra el servidor actual** (Ctrl+C) y reinícialo:

```cmd
cd C:\Users\relim\Desktop\bolt\project\backend
set PORT=5000
python server.py
```

**Verifica en los logs** que aparezca:
```
[INFO] Directorio temporal creado/verificado: C:\Users\relim\AppData\Local\Temp\extractores_temp
```

---

### PASO 2: Probar de Nuevo

1. Abre tu aplicación en Vercel
2. Intenta extraer un PDF
3. Debería funcionar correctamente ahora

---

### PASO 3: Verificar Directorio

Si quieres verificar que el directorio se creó:

```cmd
dir C:\Users\relim\AppData\Local\Temp\extractores_temp
```

O si usa el directorio alternativo:

```cmd
dir C:\Users\relim\Desktop\bolt\project\backend\temp
```

---

## 🔍 Verificación

Después de reiniciar el servidor, en los logs deberías ver:

```
[INFO] Directorio temporal creado/verificado: C:\Users\relim\AppData\Local\Temp\extractores_temp
```

Y cuando hagas una request:

```
[INFO] PDF guardado temporalmente en: C:\Users\relim\AppData\Local\Temp\extractores_temp\banco_galicia_Extracto_Banco_Galicia.pdf
```

---

## 📝 Notas

- **`parents=True`**: Crea todos los directorios padres si no existen
- **`exist_ok=True`**: No da error si el directorio ya existe
- **Limpieza de nombres**: Los espacios se reemplazan por `_` para evitar problemas en Windows
- **Fallback**: Si falla el directorio temporal del sistema, usa uno en la carpeta del proyecto

---

## ✅ Checklist

- [x] Código corregido para crear directorio con `parents=True`
- [x] Código corregido para limpiar nombres de archivo
- [x] Código corregido para verificar directorio antes de guardar
- [ ] Servidor reiniciado
- [ ] Logs verificados (debe mostrar directorio creado)
- [ ] Prueba de extracción realizada

---

¡Reinicia el servidor y prueba de nuevo! Debería funcionar ahora. 🚀




