# 🚀 Guía Completa de Despliegue

## Sistema de Gestión de Soporte - Producción

---

## 📦 **Arquitectura de Despliegue**

- **Frontend (React + Vite)**: Vercel
- **Backend (Flask)**: Railway o Render
- **Base de Datos**: Supabase (ya configurado)
- **Storage**: Supabase Storage (ya configurado)

---

## 🎨 **PARTE 1: Desplegar Frontend en Vercel**

### **Paso 1: Crear cuenta en Vercel**

1. Ve a https://vercel.com
2. Haz clic en **"Sign Up"**
3. Regístrate con GitHub (recomendado)

### **Paso 2: Subir código a GitHub**

Si aún no tienes el código en GitHub:

```bash
cd C:\Users\relim\Desktop\bolt\project
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### **Paso 3: Importar proyecto en Vercel**

1. En Vercel, haz clic en **"New Project"**
2. Selecciona tu repositorio de GitHub
3. Configura el proyecto:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (raíz del proyecto)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### **Paso 4: Configurar Variables de Entorno**

En la sección **Environment Variables**, agrega:

```
VITE_SUPABASE_URL=https://yevbgutnuoivcuqnmrzi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldmJndXRudW9pdmN1cW5tcnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTI0NTQsImV4cCI6MjA3ODQ2ODQ1NH0.COkMSMvFvpCM2q9FC0fYukS-mCzLacqilH9q1aHAQR4
VITE_API_URL=https://tu-backend.railway.app
```

**Nota**: `VITE_API_URL` lo configurarás después de desplegar el backend.

### **Paso 5: Desplegar**

1. Haz clic en **"Deploy"**
2. Espera 2-3 minutos
3. ¡Tu frontend estará en línea! 🎉

URL ejemplo: `https://tu-proyecto.vercel.app`

---

## 🔧 **PARTE 2: Desplegar Backend en Railway**

### **Opción A: Railway (Recomendado)**

#### **Paso 1: Crear cuenta en Railway**

1. Ve a https://railway.app
2. Regístrate con GitHub

#### **Paso 2: Crear nuevo proyecto**

1. Haz clic en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Selecciona tu repositorio

#### **Paso 3: Configurar el servicio**

1. Railway detectará automáticamente que es Python
2. Configura:
   - **Root Directory**: `backend`
   - **Start Command**: `gunicorn server:app`

#### **Paso 4: Agregar archivo de configuración**

Crea `backend/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "gunicorn server:app --bind 0.0.0.0:$PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### **Paso 5: Instalar Gunicorn**

Agrega a `backend/requirements.txt`:

```
gunicorn==21.2.0
```

#### **Paso 6: Variables de Entorno**

En Railway, agrega:

```
FLASK_ENV=production
PORT=8080
```

#### **Paso 7: Desplegar**

1. Haz clic en **"Deploy"**
2. Espera 3-5 minutos
3. Copia la URL generada (ej: `https://tu-backend.railway.app`)

---

### **Opción B: Render (Alternativa Gratuita)**

#### **Paso 1: Crear cuenta en Render**

1. Ve a https://render.com
2. Regístrate con GitHub

#### **Paso 2: Crear Web Service**

1. Haz clic en **"New +"** → **"Web Service"**
2. Conecta tu repositorio de GitHub
3. Configura:
   - **Name**: `sistema-soporte-backend`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app --bind 0.0.0.0:$PORT`

#### **Paso 3: Variables de Entorno**

```
FLASK_ENV=production
PORT=10000
```

#### **Paso 4: Desplegar**

1. Haz clic en **"Create Web Service"**
2. Espera 5-10 minutos
3. Copia la URL generada

---

## 🔗 **PARTE 3: Conectar Frontend con Backend**

### **Paso 1: Actualizar URL del Backend**

1. Ve a tu proyecto en Vercel
2. Ve a **Settings** → **Environment Variables**
3. Actualiza `VITE_API_URL` con la URL de Railway/Render:
   ```
   VITE_API_URL=https://tu-backend.railway.app
   ```

### **Paso 2: Configurar CORS en el Backend**

Asegúrate de que `backend/server.py` tenga:

```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=[
    "https://tu-proyecto.vercel.app",
    "http://localhost:5173"
])
```

### **Paso 3: Re-desplegar**

1. **Backend**: Haz un commit y push para re-desplegar
2. **Frontend**: Vercel se re-desplegará automáticamente

---

## 🔒 **PARTE 4: Configurar Supabase para Producción**

### **Paso 1: Configurar URLs permitidas**

1. Ve a tu proyecto en Supabase
2. Ve a **Authentication** → **URL Configuration**
3. Agrega en **Site URL**:
   ```
   https://tu-proyecto.vercel.app
   ```

4. Agrega en **Redirect URLs**:
   ```
   https://tu-proyecto.vercel.app/**
   ```

### **Paso 2: Configurar CORS en Storage**

1. Ve a **Storage** → **Policies**
2. Asegúrate de que los buckets `avatars` y `ticket-attachments` sean públicos

---

## 📝 **PARTE 5: Archivos Necesarios**

### **1. backend/requirements.txt**

```txt
Flask==3.0.0
Flask-CORS==4.0.0
gunicorn==21.2.0
pdfplumber==0.10.3
camelot-py[cv]==0.11.0
pytesseract==0.3.10
Pillow==10.1.0
PyMuPDF==1.23.8
ocrmypdf==15.4.4
opencv-python-headless==4.8.1.78
```

### **2. backend/railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "gunicorn server:app --bind 0.0.0.0:$PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### **3. vercel.json** (ya creado)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 🧪 **PARTE 6: Verificación**

### **Checklist de Despliegue**

- [ ] Frontend desplegado en Vercel
- [ ] Backend desplegado en Railway/Render
- [ ] Variables de entorno configuradas
- [ ] CORS configurado correctamente
- [ ] Supabase URLs actualizadas
- [ ] Login funciona correctamente
- [ ] Subida de archivos funciona
- [ ] Extractor de PDFs funciona
- [ ] Calendario funciona
- [ ] Departamentos funcionan

### **Pruebas a Realizar**

1. **Autenticación**:
   - [ ] Iniciar sesión
   - [ ] Cerrar sesión
   - [ ] Roles funcionan correctamente

2. **Tickets**:
   - [ ] Crear ticket
   - [ ] Ver tickets
   - [ ] Comentar en tickets
   - [ ] Subir archivos

3. **Clientes (Foros)**:
   - [ ] Ver clientes
   - [ ] Acceder a subforos
   - [ ] Enviar mensajes
   - [ ] Ver archivos

4. **Herramientas**:
   - [ ] Extractor de tablas funciona
   - [ ] PDF a OCR funciona

5. **Departamentos**:
   - [ ] Ver departamentos
   - [ ] Asignar usuarios (admin)
   - [ ] Permisos por departamento

6. **Calendario**:
   - [ ] Crear eventos personales
   - [ ] Asignar eventos a usuarios
   - [ ] Asignar eventos a departamentos

---

## 🐛 **Solución de Problemas Comunes**

### **Error: "Failed to fetch"**

**Causa**: CORS no configurado correctamente

**Solución**:
1. Verifica que `VITE_API_URL` esté correctamente configurado en Vercel
2. Asegúrate de que el backend tenga CORS habilitado para tu dominio de Vercel

### **Error: "Network Error" al subir archivos**

**Causa**: Límite de tamaño de archivo

**Solución**:
- Vercel: Límite de 4.5MB por request
- Railway: Límite de 100MB
- Considera usar Supabase Storage directamente desde el frontend

### **Error: "Module not found"**

**Causa**: Dependencias no instaladas

**Solución**:
```bash
cd backend
pip install -r requirements.txt
```

### **Backend no inicia**

**Causa**: Puerto incorrecto o comando de inicio

**Solución**:
- Railway: Usa `gunicorn server:app --bind 0.0.0.0:$PORT`
- Render: Usa `gunicorn server:app --bind 0.0.0.0:$PORT`

---

## 💰 **Costos Estimados**

### **Plan Gratuito (Recomendado para empezar)**

- ✅ **Vercel**: Gratis (100 GB bandwidth/mes)
- ✅ **Railway**: $5 crédito gratis/mes (suficiente para desarrollo)
- ✅ **Supabase**: Gratis (500MB database, 1GB storage)

**Total**: $0-5/mes

### **Plan de Producción (Para uso real)**

- 💰 **Vercel Pro**: $20/mes
- 💰 **Railway**: $10-20/mes
- 💰 **Supabase Pro**: $25/mes

**Total**: $55-65/mes

---

## 🔄 **Actualizaciones Futuras**

Para actualizar la aplicación:

1. Haz cambios en tu código local
2. Commit y push a GitHub:
   ```bash
   git add .
   git commit -m "Descripción de cambios"
   git push
   ```
3. Vercel y Railway se re-desplegarán automáticamente

---

## 📞 **Soporte**

Si tienes problemas:

1. Revisa los logs en Vercel/Railway
2. Verifica las variables de entorno
3. Prueba localmente primero
4. Consulta la documentación oficial

---

## ✅ **Siguiente Paso**

1. **Ahora mismo**: Sube tu código a GitHub
2. **Luego**: Despliega el frontend en Vercel
3. **Después**: Despliega el backend en Railway
4. **Finalmente**: Conecta todo y prueba

¿Necesitas ayuda con algún paso específico? 🚀


















