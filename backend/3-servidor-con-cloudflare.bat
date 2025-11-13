@echo off
REM Script para iniciar servidor y exponerlo con Cloudflare Tunnel

echo ================================================
echo  SERVIDOR DE EXTRACTORES - ACCESO PUBLICO
echo ================================================
echo.

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    echo Activando entorno virtual...
    call venv\Scripts\activate.bat
    echo.
)

REM Verificar que cloudflared esta instalado
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: cloudflared no esta instalado
    echo.
    echo Instalalo con uno de estos metodos:
    echo   1. winget install --id Cloudflare.cloudflared
    echo   2. Descarga desde: https://github.com/cloudflare/cloudflared/releases
    echo.
    pause
    exit /b 1
)

echo Cloudflared encontrado
echo.

REM Configurar puerto
set PORT=5000

echo Iniciando servidor Flask en puerto %PORT%...
echo.

REM Iniciar servidor en segundo plano
start "Servidor Flask" /MIN python server.py

REM Esperar a que el servidor inicie
echo Esperando a que el servidor inicie...
timeout /t 5 /nobreak >nul

echo.
echo ================================================
echo  INICIANDO TUNEL CLOUDFLARE
echo ================================================
echo.
echo Tu servidor estara disponible en una URL publica
echo La URL aparecera a continuacion...
echo.
echo IMPORTANTE: Copia la URL que aparezca y usalas en tu frontend
echo.
echo Presiona Ctrl+C para detener
echo ================================================
echo.

REM Iniciar tunel de Cloudflare
cloudflared tunnel --url http://localhost:%PORT%

REM Limpiar: cerrar servidor cuando se cierre el tunel
echo.
echo Deteniendo servidor...
taskkill /FI "WINDOWTITLE eq Servidor Flask*" /F >nul 2>&1
echo Servidor detenido
echo.

pause

