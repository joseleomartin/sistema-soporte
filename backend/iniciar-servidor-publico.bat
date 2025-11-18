@echo off
REM Script para iniciar servidor local y exponerlo con Cloudflare Tunnel

echo ================================================
echo  SERVIDOR DE EXTRACTORES - ACCESO PUBLICO
echo ================================================
echo.

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    echo Activando entorno virtual...
    call venv\Scripts\activate.bat
)

REM Configurar puerto
set PORT=5000

echo.
echo Iniciando servidor Flask en puerto %PORT%...
echo URL Local: http://localhost:%PORT%
echo.

REM Iniciar servidor en segundo plano
start "Servidor Flask" /MIN python server.py

REM Esperar 3 segundos a que el servidor inicie
timeout /t 3 /nobreak >nul

echo.
echo ================================================
echo  INICIANDO TUNEL CLOUDFLARE
echo ================================================
echo.
echo Tu servidor estara disponible en una URL publica
echo La URL aparecera a continuacion...
echo.
echo Presiona Ctrl+C para detener el servidor
echo ================================================
echo.

REM Iniciar túnel de Cloudflare (modo rápido)
cloudflared tunnel --url http://localhost:%PORT%

REM Si se cierra el túnel, cerrar también el servidor
taskkill /FI "WINDOWTITLE eq Servidor Flask" /F >nul 2>&1






