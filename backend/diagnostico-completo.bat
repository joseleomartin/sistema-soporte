@echo off
REM Script de diagnostico completo del servidor y tunel

echo ================================================
echo  DIAGNOSTICO COMPLETO
echo ================================================
echo.

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

echo [1/5] Verificando Python...
python --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python no encontrado
    pause
    exit /b 1
)
echo OK
echo.

echo [2/5] Verificando que Flask este instalado...
python -c "import flask; print('Flask version:', flask.__version__)" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Flask no esta instalado
    pause
    exit /b 1
)
echo OK
echo.

echo [3/5] Verificando que el servidor este corriendo...
curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: El servidor NO esta corriendo en localhost:5000
    echo.
    echo Inicia el servidor primero con: 2-iniciar-servidor.bat
    echo.
    pause
    exit /b 1
)
echo OK - Servidor respondiendo
echo.

echo [4/5] Probando endpoints localmente...
echo.
echo Endpoint /:
curl -s http://localhost:5000/ | python -m json.tool 2>nul
echo.
echo Endpoint /health:
curl -s http://localhost:5000/health | python -m json.tool 2>nul
echo.
echo Endpoint /extractors:
curl -s http://localhost:5000/extractors | python -m json.tool 2>nul
echo.

echo [5/5] Verificando procesos...
echo.
echo Procesos Python corriendo:
tasklist | findstr python
echo.
echo Procesos cloudflared corriendo:
tasklist | findstr cloudflared
echo.

echo ================================================
echo  DIAGNOSTICO COMPLETADO
echo ================================================
echo.
echo Si todos los endpoints locales funcionan pero
echo el tunel da 404, el problema es de Cloudflare.
echo.
echo Solucion: Reinicia el tunel DESPUES de que
echo el servidor este completamente iniciado.
echo.
pause



















