# 🚀 Guía Completa de Deploy en Railway

## ⚠️ IMPORTANTE: Antes de Empezar

### ❌ Elimina estas variables en Railway:
1. Ve a Railway Dashboard → Tu Servicio → **Variables**
2. Elimina: `PORT=8080` (Railway la asigna automáticamente)
3. Elimina: `EXTRACTOR_HOST=0.0.0.0` (no es necesaria)

### ✅ Deja solo esta variable:
- `PYTHONUNBUFFERED=1` ← Esta está bien

---

## 🎯 MÉTODO 1: Deploy desde GitHub (Ya Conectado)

**Tu caso**: Ya tienes el repo conectado a Railway.

### Paso 1: Commit y Push los Cambios

```powershell
# Abre PowerShell en: C:\Users\relim\Desktop\bolt\project\backend

# Ver qué archivos cambiaron
git status

# Agregar todos los cambios
git add .

# Hacer commit
git commit -m "Configurar Flask directo para Railway"

# Hacer push
git push origin main
```

**¿No tienes Git configurado?** Salta al MÉTODO 2 (Railway CLI).

---

### Paso 2: Railway Detecta Cambios Automáticamente

Railway detectará el push y empezará a deployar automáticamente.

**Ver el progreso**:
1. Ve a Railway Dashboard
2. Tu servicio → Pestaña **Deployments**
3. Verás un nuevo deployment en progreso

---

### Paso 3: Monitorear el Deploy

**Build Phase** (2-3 minutos):
```
✓ Installing system dependencies (tesseract, poppler)
✓ Creating virtual environment
✓ Installing Python packages
✓ Build complete
```

**Deploy Phase** (30 segundos):
```
✓ Starting application
✓ Server listening on 0.0.0.0:XXXX
✓ Health check passed
```

---

### Paso 4: Verificar que Funciona

```bash
# Reemplaza con tu URL de Railway
curl https://sistema-soporte-production.up.railway.app/health

# Debería responder:
{
  "status": "ok",
  "message": "Servidor funcionando correctamente",
  "extractors_count": 16
}
```

---

## 🎯 MÉTODO 2: Deploy con Railway CLI (Alternativo)

**Si no tienes Git o prefieres CLI:**

### Paso 1: Instalar Railway CLI

```powershell
# Instalar con npm
npm install -g @railway/cli

# Verificar instalación
railway --version
```

---

### Paso 2: Login en Railway

```powershell
railway login
```

Se abrirá tu navegador para autenticarte.

---

### Paso 3: Vincular al Proyecto Existente

```powershell
# Ir a la carpeta backend
cd C:\Users\relim\Desktop\bolt\project\backend

# Vincular al proyecto existente
railway link
```

Selecciona tu proyecto: `sistema-soporte-production`

---

### Paso 4: Deploy Directo

```powershell
# Deploy desde la carpeta actual
railway up
```

Railway subirá todos los archivos y hará el deploy.

---

### Paso 5: Ver Logs en Tiempo Real

```powershell
railway logs
```

---

## 🎯 MÉTODO 3: Redeploy Manual (Más Rápido)

**Si ya hiciste cambios y solo quieres redeploy:**

### Opción A: Desde Dashboard

1. Railway Dashboard → Tu Servicio
2. Pestaña **Deployments**
3. Menu (⋮) del último deployment
4. Click **Redeploy**

### Opción B: Desde CLI

```powershell
railway redeploy
```

---

## 📊 Estructura de Tu Proyecto en Railway

Asegúrate de tener esta configuración:

```
Settings → General:
├─ Root Directory: /backend
├─ Builder: Nixpacks
└─ Branch: main

Settings → Variables:
└─ PYTHONUNBUFFERED=1 ✅
```

---

## 🐛 Troubleshooting Durante el Deploy

### Error: "Build failed - requirements.txt not found"

**Causa**: Root Directory incorrecto

**Solución**:
```
Railway → Settings → General → Root Directory: /backend
```

---

### Error: "502 Bad Gateway"

**Causa**: App no escucha en el puerto correcto

**Solución**:
1. Elimina variable `PORT` manual en Railway
2. Verifica logs: `railway logs`
3. Busca línea: "Escuchando en http://0.0.0.0:XXXX"

---

### Error: "Connection Refused"

**Causas comunes**:
- Variable `PORT=8080` configurada manualmente ❌
- App crasheó durante el inicio
- Dependencias faltantes

**Solución**:
```powershell
# Ver logs completos
railway logs

# Buscar errores de Python
# ModuleNotFoundError, ImportError, etc.
```

---

### Error: "Module not found"

**Causa**: Falta una dependencia en requirements.txt

**Solución**:
```powershell
# Verificar requirements.txt localmente
pip install -r requirements.txt

# Si funciona local, hacer push
git add requirements.txt
git commit -m "Actualizar dependencias"
git push
```

---

## ✅ Checklist Pre-Deploy

Antes de hacer deploy, verifica:

- [ ] Eliminaste variable `PORT` manual en Railway
- [ ] Root Directory = `/backend` o `/project/backend`
- [ ] nixpacks.toml existe en la raíz del Root Directory
- [ ] requirements.txt tiene todas las dependencias
- [ ] Código probado localmente (opcional)

---

## 🎯 Después del Deploy Exitoso

### 1. Obtén tu URL

```powershell
railway status
```

O en Dashboard: Settings → Domains

---

### 2. Prueba los Endpoints

```bash
# Health check
curl https://tu-app.up.railway.app/health

# Listar extractores
curl https://tu-app.up.railway.app/extractors

# Endpoint raíz
curl https://tu-app.up.railway.app/
```

---

### 3. Configura el Dominio en tu Frontend

Actualiza la URL del backend en tu aplicación frontend:

```javascript
// En tu frontend
const BACKEND_URL = 'https://tu-app.up.railway.app';
```

---

## 🔄 Workflow Normal de Desarrollo

Una vez configurado, tu workflow será:

```powershell
# 1. Hacer cambios en el código
# Editas server.py, extractores, etc.

# 2. Commit
git add .
git commit -m "Descripción de cambios"

# 3. Push (deploy automático)
git push

# 4. Railway detecta y deploya automáticamente
# Espera 2-3 minutos

# 5. Verificar
curl https://tu-app.up.railway.app/health
```

---

## 📱 Monitoreo y Mantenimiento

### Ver Logs en Tiempo Real

```powershell
railway logs --follow
```

O en Dashboard: Deployments → View Logs

---

### Ver Métricas

Railway Dashboard → Tu Servicio → Metrics:
- CPU usage
- Memory usage
- Network traffic

---

### Rollback a Versión Anterior

```powershell
# Desde Dashboard
Deployments → Deployment anterior → Menu → Redeploy
```

---

## 🎉 ¡Listo!

Tu backend está ahora en producción. URLs importantes:

- **Dashboard**: https://railway.app/dashboard
- **Tu App**: https://sistema-soporte-production.up.railway.app
- **Health Check**: https://sistema-soporte-production.up.railway.app/health
- **Docs Railway**: https://docs.railway.app/

---

## 💡 Tips Extras

### Variables de Entorno Adicionales (Opcional)

Si más adelante necesitas configurar algo:

```
EXTRACTOR_DEBUG=false
FLASK_ENV=production
```

### Escalar el Servicio

Si necesitas más recursos:
```
Railway → Settings → Resources
- Ajustar CPU/RAM
```

### Configurar Dominio Personalizado

```
Railway → Settings → Domains → Add Domain
```

---

¿Problemas durante el deploy? Comparte los logs y te ayudo. 🚀


