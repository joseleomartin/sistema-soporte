#!/bin/bash

echo "=========================================="
echo "Iniciando Backend de Extractores"
echo "=========================================="

# Verificar si existe el entorno virtual
if [ ! -d "venv" ]; then
    echo ""
    echo "No se encontró el entorno virtual. Creándolo..."
    python3 -m venv venv
    echo "Entorno virtual creado."
fi

# Activar entorno virtual
echo ""
echo "Activando entorno virtual..."
source venv/bin/activate

# Instalar dependencias
echo ""
echo "Instalando dependencias..."
pip install -r requirements.txt

# Verificar configuración
echo ""
echo "Verificando configuración..."
python check_setup.py
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: La configuración tiene problemas."
    echo "Por favor revisa los mensajes arriba."
    exit 1
fi

# Iniciar servidor
echo ""
echo "=========================================="
echo "Iniciando servidor en http://localhost:5000"
echo "=========================================="
echo ""
python server.py

