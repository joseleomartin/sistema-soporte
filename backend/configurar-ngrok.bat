@echo off
REM Script para configurar ngrok (solo primera vez)

echo ================================================
echo  CONFIGURACION DE NGROK (SOLO PRIMERA VEZ)
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

echo ngrok encontrado
echo.

REM Verificar si ya esta configurado
if exist "%USERPROFILE%\.ngrok2\ngrok.yml" (
    echo ngrok ya esta configurado
    echo.
    echo Si quieres cambiar el authtoken, ejecuta:
    echo   ngrok config add-authtoken TU_TOKEN
    echo.
    pause
    exit /b 0
)

echo ================================================
echo  CONFIGURACION INICIAL DE NGROK
echo ================================================
echo.
echo Para usar ngrok necesitas:
echo.
echo 1. Crear una cuenta gratis en: https://ngrok.com/signup
echo 2. Obtener tu authtoken del dashboard: https://dashboard.ngrok.com/get-started/your-authtoken
echo.
echo El authtoken se ve asi: ngrok_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
echo.
echo ================================================
echo.

set /p AUTHTOKEN="Pega tu authtoken aqui: "

if "%AUTHTOKEN%"=="" (
    echo.
    echo ERROR: No ingresaste un authtoken
    pause
    exit /b 1
)

echo.
echo Configurando ngrok...
ngrok config add-authtoken %AUTHTOKEN%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo  CONFIGURACION EXITOSA
    echo ================================================
    echo.
    echo ngrok esta listo para usar
    echo.
    echo Ahora puedes ejecutar: 7-iniciar-con-ngrok.bat
    echo.
) else (
    echo.
    echo ERROR: No se pudo configurar ngrok
    echo Verifica que el authtoken sea correcto
    echo.
)

pause























