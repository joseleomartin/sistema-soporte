@echo off
REM Script que muestra instrucciones para usar 2 ventanas manualmente

echo ================================================
echo  INSTRUCCIONES: INICIAR EN 2 VENTANAS
echo ================================================
echo.
echo Este es el metodo MAS CONFIABLE
echo.
echo ================================================
echo  VENTANA 1 - SERVIDOR (Ejecuta esto primero)
echo ================================================
echo.
echo Copia y pega estos comandos en una ventana CMD:
echo.
echo   cd C:\Users\relim\Desktop\bolt\project\backend
echo   if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat
echo   set PORT=5000
echo   python server.py
echo.
echo ESPERA a ver esta linea:
echo   [INFO] Escuchando en http://0.0.0.0:5000
echo.
echo NO CIERRES esta ventana
echo.
echo ================================================
echo  VENTANA 2 - TUNEL (Despues de que el servidor este listo)
echo ================================================
echo.
echo Abre OTRA ventana CMD y ejecuta:
echo.
echo   cloudflared tunnel --url http://localhost:5000
echo.
echo Copia la URL que aparece (ej: https://xxxxx.trycloudflare.com)
echo.
echo ================================================
echo  PROBAR
echo ================================================
echo.
echo Abre tu navegador y prueba:
echo   https://tu-url.trycloudflare.com/health
echo.
echo Debe mostrar: {"status": "ok", ...}
echo.
echo ================================================
echo.
echo Presiona cualquier tecla para abrir las ventanas...
pause >nul

echo.
echo Abriendo ventana 1 (Servidor)...
start cmd /k "cd /d C:\Users\relim\Desktop\bolt\project\backend && if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat && set PORT=5000 && echo ================================================ && echo  VENTANA 1: SERVIDOR FLASK && echo ================================================ && echo. && echo Espera a ver: [INFO] Escuchando en http://0.0.0.0:5000 && echo. && echo NO CIERRES esta ventana && echo. && python server.py"

timeout /t 3 /nobreak >nul

echo.
echo Abriendo ventana 2 (Tunel)...
echo Espera 10 segundos a que el servidor inicie, luego presiona Enter en la ventana del tunel
echo.
start cmd /k "echo ================================================ && echo  VENTANA 2: TUNEL CLOUDFLARE && echo ================================================ && echo. && echo Espera 10 segundos a que el servidor inicie... && echo Luego presiona Enter para continuar && pause && cloudflared tunnel --url http://localhost:5000"

echo.
echo ================================================
echo  VENTANAS ABIERTAS
echo ================================================
echo.
echo Ventana 1: Servidor Flask (debe mostrar "Escuchando en...")
echo Ventana 2: Tunel Cloudflare (mostrara la URL publica)
echo.
echo Cuando veas la URL en la ventana 2, copiala y prueba en el navegador
echo.
pause












