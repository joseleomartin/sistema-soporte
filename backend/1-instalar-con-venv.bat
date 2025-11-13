@echo off
REM Script para crear entorno virtual e instalar dependencias (RECOMENDADO)

echo ================================================
echo  INSTALACION CON ENTORNO VIRTUAL (RECOMENDADO)
echo ================================================
echo.
echo Este metodo es mas seguro y evita conflictos
echo.

REM Verificar Python
python --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python no esta instalado
    pause
    exit /b 1
)

echo ================================================
echo  PASO 1: Creando entorno virtual
echo ================================================
echo.

REM Eliminar venv anterior si existe
if exist venv (
    echo Eliminando entorno virtual anterior...
    rmdir /s /q venv
)

REM Crear nuevo entorno virtual
python -m venv venv
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: No se pudo crear el entorno virtual
    pause
    exit /b 1
)

echo Entorno virtual creado exitosamente
echo.

echo ================================================
echo  PASO 2: Activando entorno virtual
echo ================================================
echo.

REM Activar entorno virtual
call venv\Scripts\activate.bat

echo Entorno virtual activado
echo.

echo ================================================
echo  PASO 3: Actualizando pip
echo ================================================
echo.

python -m pip install --upgrade pip --no-cache-dir

echo.
echo ================================================
echo  PASO 4: Instalando dependencias
echo ================================================
echo.
echo Esto tomara 2-3 minutos...
echo.

REM Limpiar cache antes de instalar
python -m pip cache purge

REM Instalar dependencias
python -m pip install --no-cache-dir -r requirements.txt

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo  INSTALACION COMPLETADA EXITOSAMENTE
    echo ================================================
    echo.
    echo El entorno virtual esta en: venv\
    echo.
    echo Para usar el servidor:
    echo   1. Ejecuta: 2-iniciar-servidor.bat
    echo   2. O manualmente: venv\Scripts\activate ^&^& python server.py
    echo.
) else (
    echo.
    echo ================================================
    echo  ERROR EN LA INSTALACION
    echo ================================================
    echo.
    echo Intentando instalacion individual...
    echo.
    
    python -m pip install --no-cache-dir flask==3.0.0
    python -m pip install --no-cache-dir flask-cors==4.0.0
    python -m pip install --no-cache-dir gunicorn==21.2.0
    python -m pip install --no-cache-dir pandas==2.1.3
    python -m pip install --no-cache-dir pdfplumber==0.10.3
    python -m pip install --no-cache-dir opencv-python-headless==4.8.1.78
    python -m pip install --no-cache-dir openpyxl==3.1.2
    python -m pip install --no-cache-dir xlsxwriter==3.1.9
    python -m pip install --no-cache-dir pytesseract==0.3.10
    python -m pip install --no-cache-dir Pillow==10.1.0
    python -m pip install --no-cache-dir PyMuPDF==1.23.8
    python -m pip install --no-cache-dir ocrmypdf==15.4.4
    
    echo.
    echo Instalacion completada (metodo alternativo)
    echo.
)

pause



