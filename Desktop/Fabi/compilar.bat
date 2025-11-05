@echo off
chcp 65001 >nul
cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                COMPILADOR FABINSA CONTROL                      ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo [1/3] Limpiando archivos anteriores...
if exist build rmdir /s /q build
if exist dist\FABINSA_CONTROL.exe del /q dist\FABINSA_CONTROL.exe
echo ✓ Limpieza completada
echo.

echo [2/3] Compilando aplicación con PyInstaller...
echo.
pyinstaller --clean FABINSA_APP.spec
echo.

if %ERRORLEVEL% EQU 0 (
    echo ✓ Compilación exitosa!
    echo.
    echo [3/3] Copiando archivos necesarios a dist...
    copy /y plantilla_stock.xlsx dist\ >nul 2>&1
    copy /y data.json dist\ >nul 2>&1
    copy /y logo_fabinsa.png dist\ >nul 2>&1
    copy /y "Fabinsa logo.png" dist\ >nul 2>&1
    echo ✓ Archivos copiados
    echo.
    echo ════════════════════════════════════════════════════════════════
    echo.
    echo ✅ COMPILACIÓN COMPLETADA EXITOSAMENTE
    echo.
    echo 📁 El ejecutable está en: dist\FABINSA_CONTROL.exe
    echo.
    echo Archivos incluidos en dist:
    dir /b dist\*.exe
    echo.
    echo ════════════════════════════════════════════════════════════════
) else (
    echo.
    echo ❌ Error durante la compilación
    echo.
    echo Por favor revisa los mensajes de error arriba.
    echo.
)

echo.
echo Presiona cualquier tecla para salir...
pause >nul


