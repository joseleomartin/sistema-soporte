@echo off
REM Script completo: Inicia servidor y ngrok automaticamente

echo ================================================
echo  SERVIDOR + NGROK (AUTOMATICO)
echo ================================================
echo.

REM Verificar ngrok
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: ngrok no esta instalado
    echo Ejecuta: instalar-ngrok.bat
    pause
    exit /b 1
)

REM Activar entorno virtual si existe
if exist "venv\Scripts\activate.bat" (
    echo Activando entorno virtual...
    call venv\Scripts\activate.bat
    echo.
) else (
    echo ADVERTENCIA: No se encontro entorno virtual
    echo Continuando sin entorno virtual...
    echo.
)

REM Verificar que Python este disponible
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python no esta instalado o no esta en el PATH
    pause
    exit /b 1
)

REM Verificar que server.py existe
if not exist "server.py" (
    echo ERROR: No se encontro server.py
    echo Asegurate de ejecutar este script desde la carpeta backend/
    pause
    exit /b 1
)

REM Configurar puerto
set PORT=5000
set EXTRACTOR_PORT=5000

REM Configurar Google OAuth
REM El script intentará obtener las credenciales en este orden:
REM 1. Variables de entorno del sistema (si ya están configuradas)
REM 2. Archivo .env en esta carpeta (si existe)
REM 3. Archivo client_secret_*.json en esta carpeta (si existe)
REM
REM Si ninguna de las opciones anteriores está disponible, configura las credenciales manualmente:
REM - Crea un archivo .env en esta carpeta con:
REM   GOOGLE_CLIENT_ID=tu_client_id_real.apps.googleusercontent.com
REM   GOOGLE_CLIENT_SECRET=tu_client_secret_real
REM - O configura las variables de entorno del sistema Windows
REM
REM Las credenciales reales están en el archivo client_secret_*.json en esta carpeta
REM
REM Cargar credenciales desde archivo JSON si no están en variables de entorno
if "%GOOGLE_CLIENT_ID%"=="" (
    REM Buscar archivo client_secret_*.json
    for %%f in (client_secret_*.json) do (
        REM Extraer Client ID y Client Secret del archivo JSON usando PowerShell
        for /f "delims=" %%i in ('powershell -Command "$json = Get-Content '%%f' | ConvertFrom-Json; $json.web.client_id"') do set GOOGLE_CLIENT_ID=%%i
        for /f "delims=" %%i in ('powershell -Command "$json = Get-Content '%%f' | ConvertFrom-Json; $json.web.client_secret"') do set GOOGLE_CLIENT_SECRET=%%i
        goto :credentials_loaded
    )
    :credentials_loaded
)

echo ================================================
echo  PASO 1: Iniciando servidor Flask
echo ================================================
echo.

REM Verificar que el puerto no este en uso
netstat -an | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ADVERTENCIA: El puerto %PORT% ya esta en uso
    echo Intentando detener procesos anteriores...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    echo.
)

REM Iniciar servidor en una ventana visible para ver errores
echo Iniciando servidor Flask...
echo.
echo NOTA: Se abrira una ventana "Servidor Flask" donde veras los logs
echo Si hay errores, apareceran en esa ventana
echo.
start "Servidor Flask" cmd /k "python server.py"

echo Servidor iniciando...
echo Esperando a que el servidor este listo...
echo.

REM Verificar primero si el servidor ya está corriendo
echo Verificando si el servidor ya esta corriendo...
netstat -an | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Servidor detectado en puerto 5000 (ya estaba corriendo)
    echo Continuando directamente con ngrok...
    echo.
    goto :ngrok_start
)

REM Esperar y verificar
set MAX_ATTEMPTS=30
set ATTEMPT=0

:wait_loop
set /a ATTEMPT+=1
if %ATTEMPT% GTR %MAX_ATTEMPTS% (
    echo.
    echo ================================================
    echo  ADVERTENCIA: El servidor no respondio en /health
    echo ================================================
    echo.
    echo Verificando si el puerto esta en uso...
    netstat -an | findstr ":5000" | findstr "LISTENING" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo Puerto 5000 esta en uso - continuando con ngrok de todas formas
        echo.
        goto :ngrok_start
    )
    echo.
    echo ERROR: El servidor no esta corriendo
    echo.
    echo Posibles causas:
    echo   1. Error al iniciar el servidor (revisa la ventana "Servidor Flask")
    echo   2. Dependencias faltantes (ejecuta: pip install -r requirements.txt)
    echo.
    echo Revisa la ventana "Servidor Flask" para ver el error
    echo.
    pause
    exit /b 1
)

REM Verificar si el servidor está respondiendo
powershell -Command "$ErrorActionPreference='Stop'; try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Servidor verificado y respondiendo
    echo.
    goto :ngrok_start
)

REM Si falla con 127.0.0.1, intentar con localhost
powershell -Command "$ErrorActionPreference='Stop'; try { $r = Invoke-WebRequest -Uri 'http://localhost:5000/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Servidor verificado y respondiendo
    echo.
    goto :ngrok_start
)

REM Verificar que el puerto esté en uso (servidor corriendo)
netstat -an | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Servidor detectado en puerto 5000, continuando con ngrok...
    echo.
    goto :ngrok_start
)

timeout /t 1 /nobreak >nul
if %ATTEMPT% LSS 5 (
    echo Esperando servidor... (%ATTEMPT%/%MAX_ATTEMPTS%)
) else if %ATTEMPT% EQU 5 (
    echo.
    echo Verificando estado del servidor...
    netstat -an | findstr ":5000" | findstr "LISTENING"
    if %ERRORLEVEL% EQU 0 (
        echo Puerto 5000 esta en uso - servidor probablemente corriendo
        echo Continuando con ngrok...
        echo.
        goto :ngrok_start
    )
    echo.
)
goto :wait_loop

:ngrok_start
REM Cerrar túneles anteriores
taskkill /FI "IMAGENAME eq ngrok.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo ================================================
echo  PASO 2: Iniciando tunel ngrok
echo ================================================
echo.
echo Tu servidor estara disponible en una URL publica
echo.
echo IMPORTANTE: ngrok mostrara una URL tipo:
echo   https://xxxx-xx-xx-xx-xx.ngrok-free.app
echo.
echo Copia esa URL y usala en VITE_BACKEND_URL en Vercel
echo.
echo Presiona Ctrl+C para detener todo
echo ================================================
echo.
echo Iniciando ngrok en 3 segundos...
timeout /t 3 /nobreak >nul

REM Iniciar túnel de ngrok en una ventana visible
start "ngrok - Túnel Público" cmd /k "ngrok http 5000"
echo.
echo ngrok iniciado en una ventana separada
echo.
echo Busca la ventana "ngrok - Túnel Público" para ver la URL
echo.
echo La URL aparecera en esa ventana, busca una linea como:
echo   Forwarding  https://xxxxx.ngrok-free.app -^> http://localhost:5000
echo.
echo Tambien puedes abrir http://localhost:4040 en tu navegador
echo para ver el dashboard de ngrok con la URL
echo.
echo Presiona cualquier tecla para mantener esta ventana abierta
echo (o cierra esta ventana si ya copiaste la URL)
pause >nul

REM Limpiar
echo.
echo Deteniendo servidor...
taskkill /FI "WINDOWTITLE eq Servidor Flask*" /F >nul 2>&1
taskkill /FI "IMAGENAME eq ngrok.exe" /F >nul 2>&1
echo Servidor detenido
echo.

pause






