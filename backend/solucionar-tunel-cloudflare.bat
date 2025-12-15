@echo off
REM Script para solucionar problemas del tunel de Cloudflare

echo ================================================
echo  SOLUCIONAR TUNEL CLOUDFLARE
echo ================================================
echo.

REM Verificar que cloudflared esta instalado
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: cloudflared no esta instalado
    echo.
    echo Instalalo con: winget install --id Cloudflare.cloudflared
    echo.
    pause
    exit /b 1
)

REM Verificar que el servidor esta corriendo
echo Verificando que el servidor este corriendo...
curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: El servidor NO esta corriendo en localhost:5000
    echo.
    echo Inicia el servidor primero en otra ventana:
    echo   cd C:\Users\relim\Desktop\bolt\project\backend
    echo   set PORT=5000
    echo   python server.py
    echo.
    pause
    exit /b 1
)

echo Servidor verificado correctamente
echo.

REM Cerrar cualquier tunel anterior
echo Cerrando túneles anteriores...
taskkill /FI "IMAGENAME eq cloudflared.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo ================================================
echo  CREANDO NUEVO TUNEL
echo ================================================
echo.
echo IMPORTANTE: Asegurate de que el servidor este
echo corriendo en otra ventana en localhost:5000
echo.
echo El servidor debe mostrar:
echo   [INFO] Escuchando en http://0.0.0.0:5000
echo.
pause

echo.
echo Creando nuevo tunel...
echo.

REM Crear nuevo tunel con opciones mejoradas
cloudflared tunnel --url http://localhost:5000 --no-autoupdate

pause



















