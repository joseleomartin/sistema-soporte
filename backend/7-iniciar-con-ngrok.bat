@echo off
REM Script para iniciar servidor y exponerlo con ngrok

echo ================================================
echo  SERVIDOR DE EXTRACTORES - CON NGROK
echo ================================================
echo.

REM Verificar que ngrok esta instalado
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: ngrok no esta instalado
    echo.
    echo Ejecuta primero: instalar-ngrok.bat
    echo.
    pause
    exit /b 1
)

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    echo Activando entorno virtual...
    call venv\Scripts\activate.bat
    echo.
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
    echo O ejecuta: 2-iniciar-servidor.bat
    echo.
    pause
    exit /b 1
)

echo Servidor verificado correctamente
echo.

REM Cerrar túneles ngrok anteriores
echo Cerrando túneles ngrok anteriores...
taskkill /FI "IMAGENAME eq ngrok.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo ================================================
echo  INICIANDO TUNEL NGROK
echo ================================================
echo.
echo Tu servidor estara disponible en una URL publica
echo La URL aparecera a continuacion...
echo.
echo IMPORTANTE: Copia la URL y usala en tu frontend
echo.
echo Presiona Ctrl+C para detener
echo ================================================
echo.

REM Iniciar túnel de ngrok
ngrok http 5000

REM Limpiar cuando se cierre
echo.
echo Deteniendo...
taskkill /FI "IMAGENAME eq ngrok.exe" /F >nul 2>&1
echo.

pause


















