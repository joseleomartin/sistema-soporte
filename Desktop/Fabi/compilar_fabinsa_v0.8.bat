@echo off
echo ========================================
echo    COMPILANDO FABINSA CONTROL v0.8
echo ========================================
echo.

echo Limpiando compilaciones anteriores...
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"

echo.
echo Compilando ejecutable...
pyinstaller --clean FABINSA_CONTROL_v0.8.spec

echo.
if exist "dist\FABINSA_CONTROL_v0.8.exe" (
    echo ========================================
    echo    COMPILACION EXITOSA!
    echo ========================================
    echo.
    echo El ejecutable se encuentra en: dist\FABINSA_CONTROL_v0.8.exe
    echo.
    echo Archivos incluidos:
    echo - FABINSA_CONTROL_v0.8.exe (ejecutable principal)
    echo - logo_fabinsa.png (logo de la empresa)
    echo - plantilla_stock.xlsx (plantilla para importar stock)
    echo.
    echo Para distribuir, copia toda la carpeta 'dist' a la computadora destino.
    echo.
    pause
) else (
    echo ========================================
    echo    ERROR EN LA COMPILACION!
    echo ========================================
    echo.
    echo Revisa los errores anteriores.
    echo.
    pause
)






