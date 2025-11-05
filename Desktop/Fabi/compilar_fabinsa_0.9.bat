@echo off
echo ========================================
echo   COMPILANDO FABINSA CONTROL v0.9
echo ========================================
echo.

echo Limpiando compilaciones anteriores...
if exist "build" rmdir /s /q "build"
if exist "dist\FABINSA_0.9.exe" del "dist\FABINSA_0.9.exe"

echo.
echo Iniciando compilacion con PyInstaller...
pyinstaller --clean FABINSA_0.9.spec

echo.
if exist "dist\FABINSA_0.9.exe" (
    echo ========================================
    echo   COMPILACION EXITOSA!
    echo ========================================
    echo.
    echo El ejecutable se ha creado en: dist\FABINSA_0.9.exe
    echo.
    echo Archivos necesarios para distribucion:
    echo - dist\FABINSA_0.9.exe
    echo - logo_fabinsa.png
    echo - plantilla_stock.xlsx
    echo - README_FABINSA_0.9.md
    echo - INSTRUCCIONES_IMPORTACION_STOCK.md
    echo.
    echo Presiona cualquier tecla para abrir la carpeta dist...
    pause >nul
    explorer dist
) else (
    echo ========================================
    echo   ERROR EN LA COMPILACION!
    echo ========================================
    echo.
    echo Revisa los errores mostrados arriba.
    pause
)









