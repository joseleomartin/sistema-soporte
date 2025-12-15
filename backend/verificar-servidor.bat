@echo off
REM Script para verificar que el servidor está funcionando localmente

echo ================================================
echo  VERIFICACION DEL SERVIDOR
echo ================================================
echo.

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

echo Verificando que el servidor responda en localhost:5000...
echo.

REM Probar endpoint raíz
echo 1. Probando endpoint raiz (/):
curl -s http://localhost:5000/ | python -m json.tool 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo    ERROR: No se pudo conectar al servidor
    echo.
    echo    El servidor NO esta corriendo en localhost:5000
    echo    Ejecuta primero: 2-iniciar-servidor.bat
    echo.
    pause
    exit /b 1
)

echo.
echo 2. Probando endpoint /health:
curl -s http://localhost:5000/health | python -m json.tool 2>nul

echo.
echo 3. Probando endpoint /extractors:
curl -s http://localhost:5000/extractors | python -m json.tool 2>nul

echo.
echo ================================================
echo  VERIFICACION COMPLETADA
echo ================================================
echo.
echo Si todos los endpoints respondieron correctamente,
echo el problema esta en la configuracion del tunel.
echo.
pause



















