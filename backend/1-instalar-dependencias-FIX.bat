@echo off
REM Script mejorado para instalar dependencias (con solucion de errores)

echo ================================================
echo  INSTALACION DE DEPENDENCIAS - VERSION MEJORADA
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
echo ================================================
echo  PASO 1: Limpiando cache de pip
echo ================================================
echo.
python -m pip cache purge
echo Cache limpiado
echo.

echo ================================================
echo  PASO 2: Actualizando pip
echo ================================================
echo.
python -m pip install --upgrade pip --no-cache-dir
echo.

echo ================================================
echo  PASO 3: Instalando dependencias (sin cache)
echo ================================================
echo.
echo Esto tomara 2-3 minutos...
echo.

REM Instalar dependencias sin cache para evitar errores
python -m pip install --no-cache-dir -r requirements.txt

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
    echo Intentando metodo alternativo...
    echo.
    goto :install_manual
)

pause
exit /b 0

:install_manual
echo ================================================
echo  METODO ALTERNATIVO: Instalacion individual
echo ================================================
echo.
echo Instalando dependencias una por una...
echo.

python -m pip install --no-cache-dir flask==3.0.0
python -m pip install --no-cache-dir flask-cors==4.0.0
python -m pip install --no-cache-dir gunicorn==21.2.0
python -m pip install --no-cache-dir pandas==2.1.3
python -m pip install --no-cache-dir pdfplumber==0.10.3
python -m pip install --no-cache-dir camelot-py==0.11.0
python -m pip install --no-cache-dir opencv-python-headless==4.8.1.78
python -m pip install --no-cache-dir openpyxl==3.1.2
python -m pip install --no-cache-dir xlsxwriter==3.1.9
python -m pip install --no-cache-dir pytesseract==0.3.10
python -m pip install --no-cache-dir Pillow==10.1.0
python -m pip install --no-cache-dir PyMuPDF==1.23.8
python -m pip install --no-cache-dir ocrmypdf==15.4.4

echo.
echo ================================================
echo  INSTALACION COMPLETADA
echo ================================================
echo.
pause


