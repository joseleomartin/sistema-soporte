# 🔧 Configuración del Backend en Vercel

## 📍 Estado Actual

✅ **Frontend (Vercel)**: `VITE_GOOGLE_CLIENT_ID` ya está configurado  
⚠️ **Backend**: Falta configurar variables de entorno

---

## 🎯 ¿Dónde está el Backend?

El backend puede estar en dos lugares:

### Opción 1: Backend Local con ngrok (Tu caso actual)
Si el backend está corriendo localmente con ngrok, **NO necesitas configurar nada en Vercel** para el backend. Las credenciales ya están en el script `8-iniciar-todo-ngrok.bat`.

**Verificación:**
- ✅ El script `8-iniciar-todo-ngrok.bat` ya tiene configurado:
  - `GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com`
  - `GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI`

**Solo necesitas:**
1. Ejecutar `8-iniciar-todo-ngrok.bat` para iniciar el backend
2. Copiar la URL de ngrok que aparece
3. Configurar `VITE_BACKEND_URL` en Vercel con esa URL

---

### Opción 2: Backend Desplegado en Railway/Render/Otro Servicio

Si el backend está desplegado en un servicio como Railway, Render, etc., **SÍ necesitas configurar las variables ahí**.

---

## 🚀 Configuración en Vercel (Solo si el Backend está en Vercel)

**⚠️ NOTA**: Esto solo aplica si el backend también está desplegado en Vercel. Si usas ngrok local, **NO necesitas esto**.

### Variables a Agregar en Vercel → Settings → Environment Variables:

#### Para el Backend (si está en Vercel):

```env
GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```

**Configuración:**
- **Name**: `GOOGLE_CLIENT_ID`
- **Value**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com`
- **Environments**: Production, Preview, Development
- **Save**

- **Name**: `GOOGLE_CLIENT_SECRET`
- **Value**: `TU_CLIENT_SECRET_AQUI`
- **Environments**: Production, Preview, Development
- **Save**

---

## ✅ Verificación Rápida

### Si usas ngrok (local):
1. ✅ `VITE_GOOGLE_CLIENT_ID` en Vercel → Ya configurado
2. ✅ `VITE_BACKEND_URL` en Vercel → Debe tener la URL de ngrok
3. ✅ Script `8-iniciar-todo-ngrok.bat` → Ya tiene las credenciales
4. ✅ Ejecutar el script para iniciar el backend

### Si el backend está en otro servicio (Railway/Render):
1. ✅ `VITE_GOOGLE_CLIENT_ID` en Vercel → Ya configurado
2. ⚠️ `GOOGLE_CLIENT_ID` en Railway/Render → **Falta configurar**
3. ⚠️ `GOOGLE_CLIENT_SECRET` en Railway/Render → **Falta configurar**

---

## 🔍 ¿Cómo Saber Dónde Está el Backend?

Revisa el archivo `.env` o las variables de entorno en Vercel:

- Si `VITE_BACKEND_URL` apunta a una URL de ngrok (ej: `https://abc123.ngrok-free.app`) → Backend local con ngrok
- Si `VITE_BACKEND_URL` apunta a Railway/Render → Backend desplegado en ese servicio
- Si no hay `VITE_BACKEND_URL` → El frontend usa el Client ID directamente

---

## 📝 Resumen

**Para tu caso (ngrok local):**
- ✅ Frontend: `VITE_GOOGLE_CLIENT_ID` ya configurado en Vercel
- ✅ Backend: Credenciales ya en `8-iniciar-todo-ngrok.bat`
- ⚠️ Solo falta: Verificar que `VITE_BACKEND_URL` en Vercel tenga la URL actual de ngrok

**Si el backend está en otro servicio:**
- ✅ Frontend: `VITE_GOOGLE_CLIENT_ID` ya configurado en Vercel
- ⚠️ Backend: Agregar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Railway/Render/etc.










