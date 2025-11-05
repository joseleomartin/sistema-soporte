@echo off
echo ========================================
echo    EMPAQUETANDO FABINSA CONTROL v0.7
echo ========================================
echo.

REM Crear carpeta de distribución
if exist "FABINSA_CONTROL_v0.7" rmdir /s /q "FABINSA_CONTROL_v0.7"
mkdir "FABINSA_CONTROL_v0.7"

echo [1/4] Copiando archivos principales...
copy "dist\FABINSA_0.7.exe" "FABINSA_CONTROL_v0.7\"
copy "logo_fabinsa.png" "FABINSA_CONTROL_v0.7\"
copy "plantilla_stock.xlsx" "FABINSA_CONTROL_v0.7\"
echo.

echo [2/4] Copiando documentación...
copy "README_FABINSA_0.7.md" "FABINSA_CONTROL_v0.7\"
copy "INSTRUCCIONES_IMPORTACION_STOCK.md" "FABINSA_CONTROL_v0.7\"
copy "INSTRUCCIONES_DISTRIBUCION_FABINSA_0.7.txt" "FABINSA_CONTROL_v0.7\"
echo.

echo [3/4] Creando archivo de datos inicial...
if not exist "FABINSA_CONTROL_v0.7\data.json" (
    copy "data.json" "FABINSA_CONTROL_v0.7\"
) else (
    echo data.json ya existe, manteniendo el existente
)
echo.

echo [4/4] Creando archivo de información del paquete...
echo FABINSA CONTROL v0.7 - Sistema Profesional de Gestión y Análisis Empresarial > "FABINSA_CONTROL_v0.7\INFO.txt"
echo. >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo Archivos incluidos: >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo - FABINSA_0.7.exe (Ejecutable principal) >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo - data.json (Base de datos) >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo - logo_fabinsa.png (Logo de la empresa) >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo - plantilla_stock.xlsx (Plantilla para importar stock) >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo - README_FABINSA_0.7.md (Documentación completa) >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo - INSTRUCCIONES_IMPORTACION_STOCK.md (Guía de importación) >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo - INSTRUCCIONES_DISTRIBUCION_FABINSA_0.7.txt (Instrucciones de distribución) >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo. >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo Para usar: Ejecutar FABINSA_0.7.exe >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo. >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo © 2025 FABINSA - Todos los derechos reservados >> "FABINSA_CONTROL_v0.7\INFO.txt"
echo.

echo ========================================
echo    ¡EMPAQUETADO COMPLETADO!
echo ========================================
echo.
echo Carpeta creada: FABINSA_CONTROL_v0.7
echo.
echo Archivos incluidos:
dir "FABINSA_CONTROL_v0.7" /b
echo.
echo Para distribuir:
echo 1. Comprimir la carpeta FABINSA_CONTROL_v0.7 en ZIP o RAR
echo 2. Enviar el archivo comprimido
echo 3. El usuario debe extraer y ejecutar FABINSA_0.7.exe
echo.
echo Tamaño del ejecutable: 
for %%I in ("FABINSA_CONTROL_v0.7\FABINSA_0.7.exe") do echo %%~zI bytes
echo.
pause

