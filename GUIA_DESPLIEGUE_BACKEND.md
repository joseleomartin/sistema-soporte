# 🚀 Guía de Despliegue del Backend de Extractores

## Opción 1: Railway (Recomendado)

### Paso 1: Preparar el repositorio

1. Asegúrate de que todos los cambios estén en Git:
```bash
cd C:\Users\relim\Desktop\bolt\project
git add backend/
git commit -m "Preparar backend para despliegue"
git push origin main
```

### Paso 2: Crear proyecto en Railway

1. Ve a [Railway.app](https://railway.app/) e inicia sesión con GitHub
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Elige tu repositorio
5. Railway detectará automáticamente que es un proyecto Python

### Paso 3: Configurar el servicio

1. Una vez creado el proyecto, ve a **Settings**
2. En **Root Directory**, pon: `backend`
3. En **Variables**, agrega:
   - `PORT` = `5000` (Railway lo asigna automáticamente, pero por si acaso)
   - `PYTHONUNBUFFERED` = `1`
   - `EXTRACTOR_HOST` = `0.0.0.0`

### Paso 4: Instalar dependencias del sistema (para OCR)

Railway usa Nixpacks. Crea un archivo `nixpacks.toml` en `backend/`:

```toml
[phases.setup]
aptPkgs = ["tesseract-ocr", "tesseract-ocr-spa", "ghostscript"]
```

Luego:
```bash
git add backend/nixpacks.toml
git commit -m "Agregar dependencias del sistema"
git push
```

Railway redesplegará automáticamente.

### Paso 5: Obtener la URL

1. En el dashboard de Railway, verás una URL como:
   `https://tu-proyecto.up.railway.app`
2. Copia esa URL

### Paso 6: Configurar el frontend

#### En Vercel:
1. Ve a tu proyecto → **Settings** → **Environment Variables**
2. Agrega o edita:
   - `VITE_EXTRACTOR_API_URL` = `https://tu-proyecto.up.railway.app`
3. Ve a **Deployments** → **Redeploy**

#### En local:
1. Crea/edita `project/.env`:
```env
VITE_EXTRACTOR_API_URL=https://tu-proyecto.up.railway.app
```
2. Reinicia el servidor de desarrollo: `npm run dev`

---

## Opción 2: Render

### Paso 1: Preparar el repositorio (igual que Railway)

```bash
git add backend/
git commit -m "Preparar backend para Render"
git push origin main
```

### Paso 2: Crear Web Service en Render

1. Ve a [Render.com](https://render.com/) e inicia sesión
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name**: `extractores-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app --bind 0.0.0.0:$PORT --timeout 300 --workers 2`

### Paso 3: Variables de entorno

En la sección **Environment**:
- `PYTHON_VERSION` = `3.11.0`
- `PYTHONUNBUFFERED` = `1`

### Paso 4: Instalar dependencias del sistema

En **Settings** → **Build & Deploy**, agrega en **Build Command**:
```bash
apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-spa ghostscript && pip install -r requirements.txt
```

### Paso 5: Deploy y obtener URL

1. Click en **"Create Web Service"**
2. Espera a que termine el build (5-10 minutos)
3. Copia la URL: `https://extractores-backend.onrender.com`
4. Configura el frontend igual que en Railway

---

## Opción 3: Heroku

### Paso 1: Instalar Heroku CLI

Descarga desde [heroku.com/cli](https://devcenter.heroku.com/articles/heroku-cli)

### Paso 2: Login y crear app

```bash
heroku login
cd C:\Users\relim\Desktop\bolt\project\backend
heroku create extractores-backend
```

### Paso 3: Agregar buildpacks

```bash
heroku buildpacks:add --index 1 heroku/python
heroku buildpacks:add --index 2 https://github.com/heroku/heroku-buildpack-apt
```

### Paso 4: Crear Aptfile para dependencias del sistema

Crea `backend/Aptfile`:
```
tesseract-ocr
tesseract-ocr-spa
ghostscript
```

### Paso 5: Deploy

```bash
git add .
git commit -m "Preparar para Heroku"
git push heroku main
```

### Paso 6: Configurar variables

```bash
heroku config:set PYTHONUNBUFFERED=1
```

### Paso 7: Obtener URL

```bash
heroku open
```

Copia la URL y configura el frontend.

---

## 🧪 Probar el Backend

Una vez desplegado, prueba estos endpoints:

```bash
# Health check
curl https://tu-url/health

# Listar extractores
curl https://tu-url/extractors
```

Deberías ver respuestas JSON correctas.

---

## 🐛 Solución de Problemas

### Error: "No module named 'cv2'"
- Asegúrate de que `opencv-python-headless` está en `requirements.txt`

### Error: "Tesseract not found"
- Verifica que instalaste las dependencias del sistema (tesseract-ocr)

### Timeout en extracciones grandes
- Aumenta el timeout en el comando de gunicorn: `--timeout 600`

### Error de memoria
- En Railway/Render, considera actualizar al plan con más RAM
- O reduce el número de workers: `--workers 1`

---

## 💰 Costos Estimados

### Railway
- **Gratis**: $5 de crédito mensual (~500 horas)
- **Pro**: $20/mes (uso ilimitado)

### Render
- **Gratis**: 750 horas/mes (se duerme después de 15 min sin uso)
- **Starter**: $7/mes (siempre activo)

### Heroku
- **Eco**: $5/mes por dyno
- **Basic**: $7/mes

---

## ✅ Checklist Final

- [ ] Backend desplegado y funcionando
- [ ] URL pública obtenida
- [ ] `VITE_EXTRACTOR_API_URL` configurada en Vercel
- [ ] `VITE_EXTRACTOR_API_URL` configurada en `.env` local
- [ ] Frontend redesplegado
- [ ] Probado desde otra PC/red

---

## 📞 Soporte

Si algo falla:
1. Revisa los logs del servicio (Railway/Render/Heroku tienen viewer de logs)
2. Verifica que todas las dependencias estén en `requirements.txt`
3. Confirma que el puerto se está usando correctamente (`$PORT`)

¡Listo! Tu backend de extractores estará disponible 24/7 para todos los usuarios.






