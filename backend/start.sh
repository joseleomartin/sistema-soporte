#!/bin/bash
set -e

echo "Iniciando servidor..."

# Cambiar al directorio de la aplicación
cd /app

# Iniciar gunicorn
exec /opt/venv/bin/gunicorn server:app \
  --bind 0.0.0.0:${PORT:-5000} \
  --timeout 300 \
  --workers 2 \
  --log-level info \
  --access-logfile - \
  --error-logfile - \
  --preload
