@echo off
echo ========================================
echo    COMPILANDO FABINSA CONTROL v0.7
echo ========================================
echo.

REM Limpiar compilaciones anteriores
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
if exist "__pycache__" rmdir /s /q "__pycache__"

echo [1/4] Limpiando archivos temporales...
echo.

echo [2/4] Instalando dependencias necesarias...
pip install pyinstaller --upgrade
pip install pandas openpyxl xlrd pillow matplotlib numpy --upgrade
echo.

echo [3/4] Compilando ejecutable...
pyinstaller --clean FABINSA_0.7.spec
echo.

if exist "dist\FABINSA_0.7.exe" (
    echo [4/4] ¡Compilación exitosa!
    echo.
    echo El ejecutable se encuentra en: dist\FABINSA_0.7.exe
    echo.
    echo ========================================
    echo    FABINSA CONTROL v0.7 COMPILADO
    echo ========================================
    echo.
    echo Archivos incluidos:
    echo - FABINSA_0.7.exe (Ejecutable principal)
    echo - data.json (Datos de la aplicación)
    echo - logo_fabinsa.png (Logo de la empresa)
    echo - plantillas Excel (Para importación de datos)
    echo - Instrucciones de uso
    echo.
    echo Para distribuir, copia toda la carpeta 'dist' a la ubicación deseada.
    echo.
    pause
) else (
    echo [ERROR] La compilación falló. Revisa los errores arriba.
    echo.
    pause
)

