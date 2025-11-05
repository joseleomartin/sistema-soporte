# 🔧 Guía de Compilación - FABINSA CONTROL

## 📦 Archivo Ejecutable Generado

Se ha creado exitosamente el archivo ejecutable **FABINSA_CONTROL.exe** en la carpeta `dist/`.

## 📋 Archivos Incluidos en la Distribución

La carpeta `dist/` contiene todos los archivos necesarios para ejecutar la aplicación:

```
dist/
├── FABINSA_CONTROL.exe      ← Ejecutable principal
├── data.json                 ← Base de datos
├── logo_fabinsa.png         ← Logo principal
├── Fabinsa logo.png         ← Logo alternativo
├── plantilla_stock.xlsx     ← Plantilla para importar datos
└── INSTRUCCIONES_USO.txt    ← Manual de usuario
```

## 🛠️ Proceso de Compilación

### Método Usado

Se utilizó **PyInstaller 6.16.0** con las siguientes características:

- **Archivo de configuración:** `FABINSA_APP.spec`
- **Tipo:** Ejecutable de un solo archivo (onefile)
- **Modo:** Sin consola (windowed)
- **Icono:** logo_fabinsa.png

### Dependencias Incluidas

El ejecutable incluye todas las bibliotecas necesarias:

- ✅ tkinter (Interfaz gráfica)
- ✅ pandas (Manejo de datos)
- ✅ openpyxl (Lectura/escritura Excel)
- ✅ Pillow/PIL (Procesamiento de imágenes)
- ✅ matplotlib (Gráficos)
- ✅ numpy (Cálculos numéricos)
- ✅ scipy (Cálculos científicos)

### Recursos Empaquetados

Los siguientes archivos se empaquetan automáticamente dentro del .exe:

- `data.json` (se copia al directorio de ejecución)
- `logo_fabinsa.png` (se extrae al ejecutar)
- `Fabinsa logo.png` (se extrae al ejecutar)

## 🔄 Recompilar el Ejecutable

Si necesitas volver a compilar el programa después de hacer cambios:

### Opción 1: Usando el archivo .spec (Recomendado)

```bash
pyinstaller --clean FABINSA_APP.spec
```

### Opción 2: Comando completo de PyInstaller

```bash
pyinstaller --name="FABINSA_CONTROL" ^
    --onefile ^
    --windowed ^
    --icon=logo_fabinsa.png ^
    --add-data "data.json;." ^
    --add-data "logo_fabinsa.png;." ^
    --add-data "Fabinsa logo.png;." ^
    --hidden-import PIL._tkinter_finder ^
    --hidden-import openpyxl ^
    --hidden-import matplotlib.backends.backend_tkagg ^
    app_rentabilidad.py
```

### Opción 3: Crear un script batch

Crea un archivo `compilar.bat` con:

```batch
@echo off
echo Compilando FABINSA_CONTROL...
pyinstaller --clean FABINSA_APP.spec
echo.
echo Compilación completada!
echo El ejecutable está en: dist\FABINSA_CONTROL.exe
pause
```

## 📝 Notas Importantes

### Advertencias Durante la Compilación

- ⚠️ `Hidden import "scipy.special._cdflib" not found` - Esto es normal y no afecta el funcionamiento

### Tamaño del Ejecutable

- El archivo .exe puede ser grande (~200-300 MB) debido a las bibliotecas científicas incluidas
- Esto es normal para aplicaciones que usan pandas, numpy, scipy y matplotlib

### Optimizaciones

Si necesitas reducir el tamaño:

1. Remover dependencias no utilizadas
2. Usar `--exclude-module` para módulos innecesarios
3. Comprimir el ejecutable con UPX (ya activado con `upx=True`)

## 🚀 Distribución

Para distribuir la aplicación:

1. **Opción Simple:** Comparte toda la carpeta `dist/`
2. **Opción Profesional:** Crea un instalador con:
   - Inno Setup
   - NSIS
   - WiX Toolset

## 🔍 Verificación

Para verificar que el ejecutable funciona correctamente:

1. Cierra todos los procesos de Python
2. Ve a la carpeta `dist/`
3. Ejecuta `FABINSA_CONTROL.exe`
4. Verifica que:
   - La interfaz se carga correctamente
   - Los logos se muestran
   - Puedes cargar/guardar datos
   - Las funciones principales funcionan

## 📊 Información Técnica

- **Python:** 3.12.6
- **PyInstaller:** 6.16.0
- **Plataforma:** Windows 10 (64-bit)
- **Bootloader:** runw.exe (sin consola)
- **Compresión:** UPX habilitada

## 🐛 Solución de Problemas

### El ejecutable no inicia

```bash
# Compila en modo debug para ver errores
pyinstaller --debug=all FABINSA_APP.spec
```

### Error de importación de módulos

```bash
# Limpia cachés y recompila
pyinstaller --clean --noconfirm FABINSA_APP.spec
```

### Archivos de recursos no se encuentran

Asegúrate de que los archivos están en la misma carpeta que el .exe:
- data.json
- logo_fabinsa.png
- Fabinsa logo.png

---

**Última compilación:** Octubre 2025  
**Desarrollado para:** FABINSA  
**Versión:** 2.0


