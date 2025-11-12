@echo off
echo ==========================================
echo Iniciando Backend de Extractores
echo ==========================================

REM Verificar si existe el entorno virtual
if not exist "venv\" (
    echo.
    echo No se encontro el entorno virtual. Creandolo...
    python -m venv venv
    echo Entorno virtual creado.
)

REM Activar entorno virtual
echo.
echo Activando entorno virtual...
call venv\Scripts\activate

REM Instalar dependencias
echo.
echo Instalando dependencias...
pip install -r requirements.txt

REM Verificar configuracion
echo.
echo Verificando configuracion...
python check_setup.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: La configuracion tiene problemas.
    echo Por favor revisa los mensajes arriba.
    pause
    exit /b 1
)

REM Iniciar servidor
echo.
echo ==========================================
echo Iniciando servidor en http://localhost:5000
echo ==========================================
echo.
python server.py

pause

