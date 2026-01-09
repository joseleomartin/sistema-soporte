@echo off
REM Script para iniciar SOLO el túnel (cuando el servidor ya está corriendo)

echo ================================================
echo  INICIAR TUNEL CLOUDFLARE
echo ================================================
echo.
echo IMPORTANTE: Asegurate de que el servidor Flask
echo ya este corriendo en otra ventana en puerto 5000
echo.
echo Si no esta corriendo, ejecuta primero:
echo   2-iniciar-servidor.bat
echo.
pause

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
    echo Ejecuta primero: 2-iniciar-servidor.bat
    echo.
    pause
    exit /b 1
)

echo Servidor verificado correctamente
echo.

echo ================================================
echo  INICIANDO TUNEL CLOUDFLARE
echo ================================================
echo.
echo Tu servidor estara disponible en una URL publica
echo La URL aparecera a continuacion...
echo.
echo IMPORTANTE: Copia la URL y usala en tu frontend
echo.
echo Presiona Ctrl+C para detener el tunel
echo ================================================
echo.

REM Iniciar tunel de Cloudflare
cloudflared tunnel --url http://localhost:5000

pause





























