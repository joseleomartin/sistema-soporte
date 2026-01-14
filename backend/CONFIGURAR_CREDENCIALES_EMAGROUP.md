# 🔑 Configurar Credenciales de Google Drive - Proyecto EMAGROUP

## 📍 Información del Proyecto

- **Proyecto de Google Cloud**: `EMAGROUP`
- **Cliente OAuth**: `EMADRIVE`
- **Client ID**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com` (configurar localmente)
- **Client Secret**: `TU_CLIENT_SECRET_AQUI` (configurar localmente)

---

## 🔧 Configuración del Script del Backend

### Paso 1: Editar el Script

Edita el archivo `backend/8-iniciar-todo-ngrok.bat` y reemplaza los placeholders:

**Línea ~60:**
```bat
set GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
```

**Línea ~67:**
```bat
set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```

**⚠️ IMPORTANTE**: Reemplaza `TU_CLIENT_ID_AQUI` y `TU_CLIENT_SECRET_AQUI` con las credenciales reales que obtuviste de Google Cloud Console.

### Paso 2: Verificar en Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. **Selecciona el proyecto: `EMAGROUP`** (no "silken-tape-478614-b6")
3. Busca el Client ID que configuraste
4. Verifica que:
   - ✅ El Client ID exista
   - ✅ Sea de tipo "Aplicación web"
   - ✅ Esté habilitado
   - ✅ El Client Secret que configuraste esté en la lista de secretos

### Paso 3: Verificar URIs de Redirección

En Google Cloud Console, en el Client ID, verifica que estén configuradas:

**URI de redirección autorizados:**
- `http://localhost:5173/google-oauth-callback`
- `http://127.0.0.1:5173/google-oauth-callback`
- `https://app.somosemagroup.com/google-oauth-callback`
- `https://TU-URL-NGROK.ngrok-free.app/google-oauth-callback` (agregar cuando uses ngrok)

**Orígenes JavaScript autorizados:**
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://app.somosemagroup.com`
- `https://TU-URL-NGROK.ngrok-free.app` (agregar cuando uses ngrok)

---

## ⚠️ Solución al Error "Client ID no existe"

Si recibes el error "El Client ID no existe en Google Cloud Console":

1. **Verifica que estés en el proyecto correcto**: `EMAGROUP` (no "silken-tape-478614-b6")
2. **Verifica que el Client ID sea correcto** (el que configuraste en el script)
3. **Verifica que el Client Secret sea correcto** (el que configuraste en el script)
4. **Reinicia el backend** después de actualizar las credenciales

---

## 🔒 Seguridad

- **NUNCA** subas las credenciales reales a Git
- El script usa placeholders (`TU_CLIENT_ID_AQUI`) en el repositorio
- Reemplaza los placeholders localmente con las credenciales reales
