@echo off
REM Script para instalar ngrok

echo ================================================
echo  INSTALACION DE NGROK
echo ================================================
echo.

REM Verificar si ngrok ya esta instalado
where ngrok >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ngrok ya esta instalado
    ngrok version
    echo.
    echo Puedes usar: 7-iniciar-con-ngrok.bat
    pause
    exit /b 0
)

echo ngrok no esta instalado
echo.
echo ================================================
echo  OPCIONES DE INSTALACION
echo ================================================
echo.
echo Opcion 1: Con Chocolatey (Recomendado)
echo   choco install ngrok
echo.
echo Opcion 2: Con winget
echo   winget install ngrok
echo.
echo Opcion 3: Descarga manual
echo   1. Ve a: https://ngrok.com/download
echo   2. Descarga: ngrok-windows-amd64.zip
echo   3. Extrae ngrok.exe a una carpeta en tu PATH
echo      (ej: C:\Windows\System32)
echo.
echo ================================================
echo.

REM Intentar instalar con winget
echo Intentando instalar con winget...
winget install ngrok 2>nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ngrok instalado exitosamente con winget
    echo.
    echo IMPORTANTE: Necesitas crear una cuenta gratis en ngrok.com
    echo y obtener tu authtoken del dashboard
    echo.
    pause
    exit /b 0
)

REM Intentar con Chocolatey
echo winget fallo, intentando con Chocolatey...
choco install ngrok -y 2>nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ngrok instalado exitosamente con Chocolatey
    echo.
    echo IMPORTANTE: Necesitas crear una cuenta gratis en ngrok.com
    echo y obtener tu authtoken del dashboard
    echo.
    pause
    exit /b 0
)

echo.
echo No se pudo instalar automaticamente
echo.
echo Por favor instala manualmente:
echo   1. Ve a: https://ngrok.com/download
echo   2. Descarga: ngrok-windows-amd64.zip
echo   3. Extrae ngrok.exe
echo   4. Copia a: C:\Windows\System32 (o agrega al PATH)
echo.
pause
























