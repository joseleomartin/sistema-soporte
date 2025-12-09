#!/bin/bash
# Script para probar los endpoints del servidor

set -e

# Configuración
BASE_URL="${BASE_URL:-http://localhost:5000}"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================"
echo "Test de Endpoints - Servidor Extractores"
echo "================================"
echo ""
echo "Base URL: $BASE_URL"
echo ""

# Función para hacer request y mostrar resultado
test_endpoint() {
    local method=$1
    local endpoint=$2
    local name=$3
    
    echo -e "${BLUE}Testing: $name${NC}"
    echo -e "${YELLOW}$method $endpoint${NC}"
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" == "200" ]; then
        echo -e "${GREEN}✓ Status: $http_code${NC}"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Status: $http_code${NC}"
        echo "$body"
    fi
    
    echo ""
}

# Verificar que el servidor esté corriendo
echo "Verificando que el servidor esté accesible..."
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo -e "${RED}Error: No se puede conectar al servidor en $BASE_URL${NC}"
    echo "Asegúrate de que el servidor esté corriendo:"
    echo "  ./test_local.sh"
    exit 1
fi

echo -e "${GREEN}✓ Servidor accesible${NC}"
echo ""

# Probar endpoints
test_endpoint "GET" "/" "Endpoint Raíz"
test_endpoint "GET" "/health" "Health Check"
test_endpoint "GET" "/extractors" "Lista de Extractores"

echo "================================"
echo -e "${GREEN}Tests completados${NC}"
echo "================================"
echo ""
echo "Para probar la extracción de PDFs, usa:"
echo "  curl -X POST $BASE_URL/extract \\"
echo "    -F 'pdf=@/ruta/a/tu/archivo.pdf' \\"
echo "    -F 'banco=banco_galicia'"
















