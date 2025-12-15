@echo off
REM Script para crear tunel con opciones avanzadas

echo ================================================
echo  TUNEL CLOUDFLARE CON OPCIONES AVANZADAS
echo ================================================
echo.

REM Verificar servidor
curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: El servidor NO esta corriendo
    echo Inicia el servidor primero en otra ventana
    pause
    exit /b 1
)

echo Servidor verificado
echo.

REM Cerrar túneles anteriores
taskkill /FI "IMAGENAME eq cloudflared.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo Creando tunel con opciones mejoradas...
echo.

REM Opcion 1: Tunel simple con protocolo HTTP/2
echo Intentando con protocolo HTTP/2...
cloudflared tunnel --url http://localhost:5000 --protocol http2

REM Si falla, intentar con otras opciones
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Protocolo HTTP/2 fallo, intentando con opciones por defecto...
    cloudflared tunnel --url http://localhost:5000
)

pause



















