@echo off
REM Script mejorado: Inicia servidor, espera, y luego inicia el túnel

echo ================================================
echo  SERVIDOR + TUNEL CLOUDFLARE (MEJORADO)
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
    echo Instalalo con: winget install --id Cloudflare.cloudflared
    echo.
    pause
    exit /b 1
)

REM Configurar puerto
set PORT=5000

echo ================================================
echo  PASO 1: Iniciando servidor Flask
echo ================================================
echo.

REM Iniciar servidor en segundo plano
start "Servidor Flask" /MIN python server.py

echo Servidor iniciando en segundo plano...
echo Esperando a que el servidor este listo...
echo.

REM Esperar y verificar que el servidor responda
set MAX_ATTEMPTS=60
set ATTEMPT=0

echo Esperando a que el servidor este completamente iniciado...
echo Esto puede tomar 10-15 segundos...
echo.

:wait_loop
set /a ATTEMPT+=1
if %ATTEMPT% GTR %MAX_ATTEMPTS% (
    echo.
    echo ERROR: El servidor no respondio despues de 60 segundos
    echo.
    echo Verifica que:
    echo   1. No haya errores en el servidor
    echo   2. El puerto 5000 no este ocupado por otro proceso
    echo   3. Las dependencias esten instaladas correctamente
    echo.
    echo Abre otra ventana y ejecuta: diagnostico-completo.bat
    echo.
    pause
    exit /b 1
)

REM Intentar conectar al servidor - probar varios endpoints
curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    REM Verificar que realmente responda con contenido
    curl -s http://localhost:5000/health | findstr "ok" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo Servidor verificado y respondiendo correctamente
        echo Probando endpoints...
        curl -s http://localhost:5000/ | findstr "status" >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo Todos los endpoints funcionando correctamente
            echo.
            goto :tunnel_start
        )
    )
)

REM Esperar 1 segundo antes de intentar de nuevo
timeout /t 1 /nobreak >nul
if %ATTEMPT% LSS 10 (
    echo Esperando servidor... (%ATTEMPT%/%MAX_ATTEMPTS%)
) else (
    if %ATTEMPT% EQU 10 (
        echo El servidor esta tardando mas de lo esperado...
        echo Verificando procesos...
        tasklist | findstr python
        echo.
    )
    if %ATTEMPT% MOD 5 EQU 0 (
        echo Aun esperando... (%ATTEMPT%/%MAX_ATTEMPTS%)
    )
)
goto :wait_loop

:tunnel_start
echo ================================================
echo  PASO 2: Iniciando tunel Cloudflare
echo ================================================
echo.
echo Tu servidor estara disponible en una URL publica
echo La URL aparecera a continuacion...
echo.
echo IMPORTANTE: Copia la URL y usala en tu frontend
echo.
echo Presiona Ctrl+C para detener todo
echo ================================================
echo.

REM Iniciar tunel de Cloudflare
cloudflared tunnel --url http://localhost:5000

REM Limpiar: cerrar servidor cuando se cierre el tunel
echo.
echo Deteniendo servidor...
taskkill /FI "WINDOWTITLE eq Servidor Flask*" /F >nul 2>&1
echo Servidor detenido
echo.

pause

