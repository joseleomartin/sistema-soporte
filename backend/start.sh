#!/bin/bash
set -e

echo "Iniciando servidor..."

cd /app

# Usa gunicorn apuntando al módulo y variable 'app'
exec /opt/venv/bin/gunicorn server:app \
  --bind 0.0.0.0:${PORT:-8080} \
  --timeout 300 \
  --workers 2 \
  --log-level info \
  --access-logfile - \
  --error-logfile -