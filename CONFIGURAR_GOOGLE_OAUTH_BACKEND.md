# 🔐 Configurar Google OAuth en el Backend (Recomendado)

## 📍 Seguridad Mejorada

Esta guía explica cómo configurar Google OAuth usando el backend, que es **más seguro** que exponer el Client Secret en el frontend.

---

## 🚀 Pasos de Configuración

### PASO 1: Configurar Variables de Entorno en el Backend

En **Railway** o **Render** (donde está tu backend), agrega estas variables de entorno:

**En Railway:**
1. Ve a tu proyecto → **Variables**
2. Agrega:
   - `GOOGLE_CLIENT_ID` = `TU_CLIENT_ID_AQUI.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` = `TU_CLIENT_SECRET_AQUI`
   - ⚠️ Obtén estos valores de Google Cloud Console → Credenciales → Tu Client ID
3. Guarda y redesplega

**En Render:**
1. Ve a tu servicio → **Environment**
2. Agrega las mismas variables
3. Guarda y redesplega

---

### PASO 2: Obtener la URL de tu Backend

Tu backend tiene una URL como:
- Railway: `https://tu-proyecto.up.railway.app`
- Render: `https://tu-proyecto.onrender.com`
- Local con ngrok: `https://xxxxx.ngrok-free.app`

---

### PASO 3: Configurar Variable en Vercel (Frontend)

1. Ve a: https://vercel.com/dashboard
2. Tu proyecto → **Settings** → **Environment Variables**
3. Agrega:
   - **Name**: `VITE_BACKEND_URL`
   - **Value**: `https://tu-proyecto.up.railway.app` (o tu URL de backend)
   - **Environments**: Production, Preview, Development
4. **IMPORTANTE**: NO necesitas `VITE_GOOGLE_CLIENT_SECRET` si usas el backend
5. Guarda y redesplega

---

### PASO 4: Verificar que Funciona

1. Abre tu app en Vercel
2. Intenta autenticar con Google Drive
3. El intercambio de tokens se hará a través del backend (más seguro)

---

## ✅ Ventajas de Usar el Backend

| Aspecto | Frontend Directo | Backend |
|---------|-----------------|---------|
| **Seguridad** | ❌ Client Secret expuesto | ✅ Client Secret en servidor |
| **Mejores Prácticas** | ❌ No recomendado | ✅ Recomendado por OAuth 2.0 |
| **Complejidad** | ✅ Baja | ⚠️ Media |

---

## 🔄 Fallback Automático

El código del frontend está diseñado para:
1. **Intentar usar el backend primero** (si `VITE_BACKEND_URL` está configurado)
2. **Usar método directo como fallback** (si el backend no está disponible)

Esto asegura que la aplicación funcione incluso si el backend no está disponible, aunque con menor seguridad.

---

## 🐛 Troubleshooting

### Problema: El backend no responde

**Solución**: 
- Verifica que el backend esté desplegado y funcionando
- Verifica que la URL en `VITE_BACKEND_URL` sea correcta
- Verifica que CORS esté configurado en el backend (ya está configurado en `server.py`)

### Problema: Error 500 en el backend

**Solución**:
- Verifica que las variables `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén configuradas en el backend
- Revisa los logs del backend para ver el error específico

### Problema: CORS Error

**Solución**:
- El backend ya tiene CORS configurado para permitir todos los orígenes
- Si persiste, verifica que la URL del frontend esté en la lista de orígenes permitidos

---

## 📝 Resumen de Variables

### Backend (Railway/Render):
```
GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```
⚠️ Obtén estos valores de Google Cloud Console → Credenciales → Tu Client ID

### Frontend (Vercel):
```
VITE_GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
VITE_BACKEND_URL=https://tu-proyecto.up.railway.app
```
⚠️ Obtén el Client ID de Google Cloud Console → Credenciales → Tu Client ID

**⚠️ NO necesitas `VITE_GOOGLE_CLIENT_SECRET` si usas el backend**

---

¡Listo! Tu aplicación ahora usa el backend para el intercambio de tokens, lo cual es mucho más seguro. 🚀

