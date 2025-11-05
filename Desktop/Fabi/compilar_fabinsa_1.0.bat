@echo off
echo Compilando FABINSA CONTROL v1.0...
echo.

REM Verificar que PyInstaller esté instalado
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo PyInstaller no está instalado. Instalando...
    pip install pyinstaller
    if errorlevel 1 (
        echo Error al instalar PyInstaller
        pause
        exit /b 1
    )
)

REM Limpiar compilaciones anteriores
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
if exist "FABINSA_CONTROL_v1.0.exe" del "FABINSA_CONTROL_v1.0.exe"

echo Compilando aplicación...
pyinstaller FABINSA_CONTROL_v1.0.spec

if errorlevel 1 (
    echo Error durante la compilación
    pause
    exit /b 1
)

echo.
echo Compilación completada exitosamente!
echo El ejecutable se encuentra en: dist\FABINSA_CONTROL_v1.0.exe
echo.

REM Copiar el ejecutable a la carpeta principal
if exist "dist\FABINSA_CONTROL_v1.0.exe" (
    copy "dist\FABINSA_CONTROL_v1.0.exe" "FABINSA_CONTROL_v1.0.exe"
    echo Ejecutable copiado a la carpeta principal.
)

echo.
echo Presiona cualquier tecla para continuar...
pause >nul







