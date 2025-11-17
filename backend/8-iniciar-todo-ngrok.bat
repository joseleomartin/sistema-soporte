@echo off
REM Script completo: Inicia servidor y ngrok automaticamente

echo ================================================
echo  SERVIDOR + NGROK (AUTOMATICO)
echo ================================================
echo.

REM Verificar ngrok
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: ngrok no esta instalado
    echo Ejecuta: instalar-ngrok.bat
    pause
    exit /b 1
)

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Configurar puerto
set PORT=5000

echo ================================================
echo  PASO 1: Iniciando servidor Flask
echo ================================================
echo.

REM Iniciar servidor en segundo plano
start "Servidor Flask" /MIN python server.py

echo Servidor iniciando...
echo Esperando a que el servidor este listo...
echo.

REM Esperar y verificar
set MAX_ATTEMPTS=60
set ATTEMPT=0

:wait_loop
set /a ATTEMPT+=1
if %ATTEMPT% GTR %MAX_ATTEMPTS% (
    echo ERROR: El servidor no respondio
    pause
    exit /b 1
)

curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    curl -s http://localhost:5000/health | findstr "ok" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Servidor verificado y respondiendo
        echo.
        goto :ngrok_start
    )
)

timeout /t 1 /nobreak >nul
if %ATTEMPT% LSS 10 (
    echo Esperando servidor... (%ATTEMPT%/%MAX_ATTEMPTS%)
)
goto :wait_loop

:ngrok_start
REM Cerrar túneles anteriores
taskkill /FI "IMAGENAME eq ngrok.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo ================================================
echo  PASO 2: Iniciando tunel ngrok
echo ================================================
echo.
echo Tu servidor estara disponible en una URL publica
echo.
echo IMPORTANTE: ngrok mostrara una URL tipo:
echo   https://xxxx-xx-xx-xx-xx.ngrok-free.app
echo.
echo Copia esa URL y usala en tu frontend
echo.
echo Presiona Ctrl+C para detener todo
echo ================================================
echo.

REM Iniciar túnel de ngrok
ngrok http 5000

REM Limpiar
echo.
echo Deteniendo servidor...
taskkill /FI "WINDOWTITLE eq Servidor Flask*" /F >nul 2>&1
taskkill /FI "IMAGENAME eq ngrok.exe" /F >nul 2>&1
echo Servidor detenido
echo.

pause




