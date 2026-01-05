@echo off
REM Script para probar que el backend devuelve el Client ID correcto

echo ================================================
echo  PROBAR BACKEND - CLIENT ID
echo ================================================
echo.

REM Verificar que el servidor esté corriendo
echo Verificando si el servidor está corriendo en localhost:5000...
curl -s http://localhost:5000/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: El servidor NO está corriendo en localhost:5000
    echo.
    echo Inicia el servidor primero:
    echo   8-iniciar-todo-ngrok.bat
    echo.
    pause
    exit /b 1
)

echo Servidor detectado
echo.

REM Obtener la URL de ngrok si está configurada
echo Si usas ngrok, obtén la URL de la ventana de ngrok
echo o de http://localhost:4040
echo.
set /p NGROK_URL="Pega la URL de ngrok aquí (o presiona Enter para usar localhost:5000): "

if "%NGROK_URL%"=="" (
    set BACKEND_URL=http://localhost:5000
) else (
    set BACKEND_URL=%NGROK_URL%
)

echo.
echo ================================================
echo  Probando: %BACKEND_URL%/api/google/client-id
echo ================================================
echo.

REM Probar el endpoint
curl -H "Origin: http://localhost:5173" -H "ngrok-skip-browser-warning: true" "%BACKEND_URL%/api/google/client-id"

echo.
echo.
echo ================================================
echo  RESULTADO
echo ================================================
echo.
echo Si ves un JSON con "client_id", el backend está funcionando
echo Si ves un error, revisa los logs del servidor Flask
echo.
pause

