# 🔐 Configurar Google OAuth con Backend Local (ngrok)

## 📍 Configuración Rápida para Desarrollo Local

Esta guía es específica para cuando usas el backend localmente con ngrok.

---

## 🚀 Pasos Rápidos

### PASO 1: Configurar Variables de Entorno Locales

Crea o edita el archivo `.env` en la carpeta `backend/`:

```env
GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```
⚠️ Obtén estos valores de Google Cloud Console → Credenciales → Tu Client ID

**O** puedes agregarlas directamente en `8-iniciar-todo-ngrok.bat` antes de iniciar el servidor:

```bat
set GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```
⚠️ Obtén estos valores de Google Cloud Console → Credenciales → Tu Client ID

---

### PASO 2: Iniciar el Backend con ngrok

1. Abre una terminal en la carpeta `backend/`
2. Ejecuta: `8-iniciar-todo-ngrok.bat`
3. Espera a que ngrok muestre la URL pública, por ejemplo:
   ```
   Forwarding  https://abc123.ngrok-free.app -> http://localhost:5000
   ```
4. **Copia esa URL** (ej: `https://abc123.ngrok-free.app`)

---

### PASO 3: Configurar en Vercel

1. Ve a: https://vercel.com/dashboard
2. Tu proyecto → **Settings** → **Environment Variables**
3. Agrega o edita:
   - **Name**: `VITE_BACKEND_URL`
   - **Value**: `https://abc123.ngrok-free.app` (la URL de ngrok)
   - **Environments**: Production, Preview, Development
4. Guarda y **redesplega**

---

### PASO 4: Verificar que Funciona

1. Prueba acceder a: `https://abc123.ngrok-free.app/health`
   - Debería responder con `{"status": "ok", ...}`
2. Prueba acceder a: `https://abc123.ngrok-free.app/api/google/oauth/token` (debería dar error 405 o similar, pero no 404)
3. Intenta autenticar con Google Drive desde tu app en Vercel

---

## ⚠️ IMPORTANTE: URL de ngrok Cambia

Cada vez que reinicies ngrok, obtendrás una URL nueva. Debes:

1. **Actualizar `VITE_BACKEND_URL` en Vercel** con la nueva URL
2. **Redesplegar** el frontend en Vercel

---

## 🔄 Workflow Recomendado

### Para Desarrollo Local:

1. Inicia el backend: `8-iniciar-todo-ngrok.bat`
2. Copia la URL de ngrok
3. Actualiza `.env` local (si desarrollas localmente):
   ```env
   VITE_BACKEND_URL=https://nueva-url.ngrok-free.app
   ```
4. Reinicia el servidor de desarrollo: `npm run dev`

### Para Producción (Vercel):

1. Inicia el backend: `8-iniciar-todo-ngrok.bat`
2. Copia la URL de ngrok
3. Actualiza `VITE_BACKEND_URL` en Vercel Dashboard
4. Redesplega el frontend

---

## 🐛 Troubleshooting

### Problema: Error 404 en `/api/google/oauth/token`

**Solución**: 
- Verifica que el backend esté corriendo (`8-iniciar-todo-ngrok.bat`)
- Verifica que la URL de ngrok sea correcta
- Prueba acceder a `https://tu-url-ngrok.ngrok-free.app/health` primero

### Problema: Error 500 en el backend

**Solución**:
- Verifica que las variables `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén configuradas
- Revisa los logs del servidor Flask para ver el error específico

### Problema: CORS Error

**Solución**:
- El backend ya tiene CORS configurado para permitir todos los orígenes
- Si persiste, verifica que la URL del frontend esté en la lista de orígenes permitidos

---

## 📝 Resumen de Variables

### Backend Local (Ya configurado en `8-iniciar-todo-ngrok.bat`):
```
GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```
✅ **Ya están configuradas en el script `8-iniciar-todo-ngrok.bat`**

**O** puedes crear un archivo `.env` en la carpeta `backend/` con estas mismas credenciales.

### Frontend (Vercel):
```
VITE_GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
VITE_BACKEND_URL=https://xxxxx.ngrok-free.app  # Actualizar cada vez que reinicies ngrok
```

**⚠️ IMPORTANTE**: 
- NO necesitas `VITE_GOOGLE_CLIENT_SECRET` si usas el backend con ngrok
- Actualiza `VITE_BACKEND_URL` en Vercel cada vez que reinicies ngrok (la URL cambia)

---

## 💡 Tips

- **URL estable**: Si necesitas una URL que no cambie, considera usar ngrok con dominio fijo (Plan Pro) o Cloudflare Tunnel permanente
- **Dashboard ngrok**: Abre http://localhost:4040 para ver todas las requests y la URL actual
- **Mantener ngrok activo**: No cierres la ventana de ngrok mientras uses la app

---

¡Listo! Tu aplicación ahora usa el backend local con ngrok para el intercambio de tokens OAuth. 🚀

