#!/bin/bash
# Script para probar el servidor localmente antes de desplegar a Railway

set -e

echo "================================"
echo "Test Local - Servidor Extractores"
echo "================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "server.py" ]; then
    echo -e "${RED}Error: No se encuentra server.py${NC}"
    echo "Ejecuta este script desde project/backend/"
    exit 1
fi

# Verificar que existe el entorno virtual
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creando entorno virtual...${NC}"
    python3 -m venv venv
fi

# Activar entorno virtual
echo -e "${GREEN}Activando entorno virtual...${NC}"
source venv/bin/activate

# Instalar/actualizar dependencias
echo -e "${GREEN}Instalando dependencias...${NC}"
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1

echo -e "${GREEN}✓ Dependencias instaladas${NC}"
echo ""

# Verificar dependencias del sistema
echo -e "${YELLOW}Verificando dependencias del sistema...${NC}"

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓ $1 instalado${NC}"
        return 0
    else
        echo -e "${RED}✗ $1 NO encontrado${NC}"
        return 1
    fi
}

MISSING_DEPS=0

check_command tesseract || MISSING_DEPS=1
check_command gs || MISSING_DEPS=1
check_command pdfinfo || MISSING_DEPS=1

echo ""

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "${YELLOW}Algunas dependencias del sistema faltan.${NC}"
    echo "Instálalas con:"
    echo "  sudo apt-get install tesseract-ocr tesseract-ocr-spa ghostscript poppler-utils"
    echo ""
    echo -e "${YELLOW}Continuando de todas formas...${NC}"
    echo ""
fi

# Configurar puerto
export PORT=5000

# Iniciar servidor con Gunicorn (simula Railway)
echo -e "${GREEN}Iniciando servidor con Gunicorn en puerto $PORT...${NC}"
echo "Simula el entorno de Railway"
echo ""
echo "Presiona Ctrl+C para detener"
echo ""

gunicorn server:app \
    --bind 0.0.0.0:$PORT \
    --workers 1 \
    --timeout 300 \
    --log-level info \
    --access-logfile - \
    --error-logfile - \
    --preload


















