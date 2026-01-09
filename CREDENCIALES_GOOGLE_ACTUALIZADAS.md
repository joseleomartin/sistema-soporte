# 🔑 Credenciales de Google Drive API Actualizadas

## 📅 Fecha de Actualización
Actualizado con las nuevas credenciales de Google OAuth 2.0

---

## 🔐 Credenciales Actuales

### Client ID
```
TU_CLIENT_ID_AQUI.apps.googleusercontent.com
```

### Client Secret
```
TU_CLIENT_SECRET_AQUI
```
*(Obtenido del archivo JSON, creado el 18 de noviembre de 2025)*

---

## 📝 Configuración de Variables de Entorno

### Frontend (Vercel) ✅

**Ya configurado:**
```env
VITE_GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
```

**⚠️ NOTA IMPORTANTE**: 
- NO incluyas el Client Secret en el frontend por seguridad
- Si usas el backend para OAuth, solo necesitas el Client ID aquí

### Backend

**Opción 1: Backend Local con ngrok (Tu caso actual)** ✅

Las credenciales ya están configuradas en el script `backend/8-iniciar-todo-ngrok.bat`:
```bat
GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```

**Solo necesitas:**
1. Ejecutar `backend/8-iniciar-todo-ngrok.bat`
2. Copiar la URL de ngrok que aparece
3. Configurar `VITE_BACKEND_URL` en Vercel con esa URL

**Opción 2: Backend Desplegado en Railway/Render/Otro Servicio**

Si el backend está desplegado en un servicio externo, agrega estas variables de entorno:

```env
GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```

**Opción 3: Backend en Vercel (Serverless Functions)**

Si el backend está desplegado en Vercel como serverless functions, agrega en Vercel → Settings → Environment Variables:

```env
GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```

**Para usar con ngrok:**
1. Ejecuta `backend/8-iniciar-todo-ngrok.bat`
2. Espera a que ngrok muestre la URL pública (ej: `https://abc123.ngrok-free.app`)
3. Copia esa URL
4. Agrega la URL a Google Cloud Console → Credenciales → Tu Client ID → URIs de redirección:
   - `https://abc123.ngrok-free.app/google-oauth-callback`
5. Configura `VITE_BACKEND_URL` en Vercel con la URL de ngrok
6. Redesplega el frontend en Vercel

---

## 🚀 Configuración en Vercel

### Frontend (Ya configurado) ✅

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Verifica que exista:
   - **Name**: `VITE_GOOGLE_CLIENT_ID`
   - **Value**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com`
   - **Environments**: Production, Preview, Development

### Backend (Solo si el backend está en Vercel)

Si el backend está desplegado en Vercel como serverless functions:

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega:
   - **Name**: `GOOGLE_CLIENT_ID`
   - **Value**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com`
   - **Environments**: Production, Preview, Development
   - **Save**
5. Agrega:
   - **Name**: `GOOGLE_CLIENT_SECRET`
   - **Value**: `TU_CLIENT_SECRET_AQUI`
   - **Environments**: Production, Preview, Development
   - **Save**
6. **Redesplega** la aplicación

---

## 🔧 Pasos para Actualizar en Railway/Render

### Railway
1. Ve a tu proyecto → **Variables**
2. Actualiza o agrega:
   - `GOOGLE_CLIENT_ID` = `TU_CLIENT_ID_AQUI`
   - `GOOGLE_CLIENT_SECRET` = `TU_CLIENT_SECRET_AQUI`
3. Guarda y redesplega

### Render
1. Ve a tu servicio → **Environment**
2. Actualiza o agrega las mismas variables
3. Guarda y redesplega

---

## ✅ Archivos Actualizados

Los siguientes archivos ya fueron actualizados con las nuevas credenciales:

- ✅ `project/src/lib/googleAuth.ts` - Fallback de Client ID actualizado
- ✅ `project/backend/8-iniciar-todo-ngrok.bat` - Credenciales del script actualizadas

---

## ⚠️ Notas Importantes

1. **Seguridad**: El Client Secret nunca debe estar en el frontend. Solo úsalo en el backend.

2. **Archivo JSON Antiguo**: El archivo `backend/client_secret_TU_CLIENT_ID_AQUI.apps.googleusercontent.com.json` 
   es de las credenciales antiguas. Puedes eliminarlo si ya no lo necesitas.

3. **URLs de Redirección en Google Cloud Console**: 

   Ve a Google Cloud Console → Credenciales → Tu Client ID → Editar
   
   Agrega estas URLs en "URI de redirección autorizados":
   - `https://tu-proyecto.vercel.app/google-oauth-callback`
   - `https://*.vercel.app/google-oauth-callback`
   - `http://localhost:5173/google-oauth-callback`
   - `http://127.0.0.1:5173/google-oauth-callback`
   
   **⚠️ IMPORTANTE si usas ngrok**: También debes agregar:
   - `https://tu-url-ngrok.ngrok-free.app/google-oauth-callback`
   - O usa un patrón como: `https://*.ngrok-free.app/google-oauth-callback`
   
   **Nota**: Cada vez que reinicies ngrok y obtengas una URL nueva, debes agregarla a esta lista.

---

## 🔍 Verificar Configuración

### Si usas ngrok (tu caso):

1. ✅ **Backend**: Las credenciales ya están en `8-iniciar-todo-ngrok.bat`
2. ✅ **Vercel**: 
   - Verifica que `VITE_GOOGLE_CLIENT_ID` esté configurado
   - Verifica que `VITE_BACKEND_URL` tenga la URL actual de ngrok
3. ✅ **Google Cloud Console**:
   - Verifica que la URL de ngrok esté en "URI de redirección autorizados"
   - Formato: `https://tu-url-ngrok.ngrok-free.app/google-oauth-callback`
4. ✅ **Prueba**: Intenta autenticar con Google Drive desde tu app en Vercel

### Verificaciones adicionales:

- La pantalla de consentimiento OAuth esté configurada en Google Cloud Console
- El backend esté corriendo (`8-iniciar-todo-ngrok.bat` debe estar activo)
- ngrok esté mostrando una URL activa (no cerrado)
- Prueba acceder a `https://tu-url-ngrok.ngrok-free.app/health` para verificar que el backend responde

---

¡Listo! Las nuevas credenciales están configuradas y listas para usar. 🚀

