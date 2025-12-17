@echo off
REM Script para instalar todas las dependencias necesarias

echo ================================================
echo  INSTALACION DE DEPENDENCIAS
echo ================================================
echo.

REM Verificar Python
echo Verificando Python...
python --version
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Python no esta instalado
    echo Descarga Python desde: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo.
echo Python encontrado. Procediendo con la instalacion...
echo.

REM Actualizar pip
echo Actualizando pip...
python -m pip install --upgrade pip

echo.
echo ================================================
echo  INSTALANDO DEPENDENCIAS DE REQUIREMENTS.TXT
echo ================================================
echo.
echo Esto tomara 2-3 minutos...
echo.

REM Instalar dependencias
python -m pip install -r requirements.txt

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo  INSTALACION COMPLETADA EXITOSAMENTE
    echo ================================================
    echo.
    echo Ahora puedes ejecutar: 2-iniciar-servidor.bat
    echo.
) else (
    echo.
    echo ================================================
    echo  ERROR EN LA INSTALACION
    echo ================================================
    echo.
    echo Revisa los errores arriba e intentalo de nuevo
    echo.
)

pause




















