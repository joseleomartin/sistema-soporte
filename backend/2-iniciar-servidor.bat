@echo off
REM Script para iniciar el servidor Flask (solo local)

echo ================================================
echo  SERVIDOR DE EXTRACTORES - LOCAL
echo ================================================
echo.

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    echo Activando entorno virtual...
    call venv\Scripts\activate.bat
    echo.
)

REM Configurar puerto
set PORT=5000

echo Iniciando servidor Flask en puerto %PORT%...
echo.
echo URL Local: http://localhost:%PORT%
echo.
echo ================================================
echo  Endpoints disponibles:
echo ================================================
echo  - http://localhost:%PORT%/
echo  - http://localhost:%PORT%/health
echo  - http://localhost:%PORT%/extractors
echo ================================================
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

REM Iniciar servidor
python server.py

pause

