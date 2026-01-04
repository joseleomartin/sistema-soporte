# 🔧 Solución: Error 401: invalid_client en Google OAuth

## 📍 Problema

Cuando intentas autenticarte con Google Drive, recibes el error:
```
Error 401: invalid_client
```

Este error ocurre durante la selección de cuenta en el flujo de OAuth de Google.

---

## 🔍 Causas Comunes

El error `401: invalid_client` puede ocurrir por varias razones:

1. **El redirect_uri no está configurado en Google Cloud Console** (más común)
2. **El Client ID del frontend no coincide con el Client Secret del backend**
3. **El Client ID no es válido o está mal configurado**
4. **El tipo de aplicación OAuth no coincide** (Web vs Desktop)

---

## ✅ Solución Paso a Paso

### PASO 1: Verificar el redirect_uri

El redirect_uri que estás usando es:
```
https://app.somosemagroup.com/google-oauth-callback
```

**⚠️ IMPORTANTE**: Este redirect_uri DEBE estar configurado en Google Cloud Console.

### PASO 2: Configurar en Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Ve a **"APIs y servicios"** → **"Credenciales"**
4. Haz clic en tu **Client ID** (el que estás usando)

### PASO 3: Agregar URI de Redirección

En la sección **"URI de redirección autorizados"**, agrega:

```
https://app.somosemagroup.com/google-oauth-callback
```

**También agrega las URLs de desarrollo (si las usas):**
```
http://localhost:5173/google-oauth-callback
http://127.0.0.1:5173/google-oauth-callback
```

### PASO 4: Agregar Origen JavaScript Autorizado

En la sección **"Orígenes JavaScript autorizados"**, agrega:

```
https://app.somosemagroup.com
```

**También agrega los orígenes de desarrollo:**
```
http://localhost:5173
http://127.0.0.1:5173
```

### PASO 5: Guardar y Esperar

1. Haz clic en **"GUARDAR"**
2. **Espera 1-2 minutos** para que los cambios se propaguen
3. Prueba la autenticación nuevamente

---

## 🔍 Verificar que el Client ID Coincide

### Verificar en el Frontend

El frontend obtiene el Client ID de:
- Backend: `/api/google/client-id` (si `VITE_BACKEND_URL` está configurado)
- Variable de entorno: `VITE_GOOGLE_CLIENT_ID`

**Para verificar qué Client ID está usando el frontend:**
1. Abre la consola del navegador (F12)
2. Busca el mensaje: `📍 Client ID usado: ...`
3. Copia ese Client ID

### Verificar en el Backend

El backend usa:
- Variable de entorno: `GOOGLE_CLIENT_ID`
- Variable de entorno: `GOOGLE_CLIENT_SECRET`

**⚠️ IMPORTANTE**: El Client ID del frontend DEBE ser el mismo que el Client ID del backend.

**Para verificar en los logs del backend:**
1. Busca en los logs: `Client ID usado: ...`
2. Compara con el Client ID del frontend
3. Deben ser **exactamente iguales**

---

## 🔧 Verificar Tipo de Aplicación OAuth

El Client ID debe ser de tipo **"Aplicación web"**, NO "Aplicación de escritorio".

**Para verificar:**
1. Ve a Google Cloud Console → Credenciales
2. Haz clic en tu Client ID
3. Verifica que el tipo sea **"Aplicación web"**
4. Si es "Aplicación de escritorio", crea uno nuevo de tipo "Aplicación web"

---

## 📝 Checklist de Verificación

Antes de probar nuevamente, verifica:

- [ ] El redirect_uri está configurado en Google Cloud Console
- [ ] El origen JavaScript está configurado en Google Cloud Console
- [ ] El Client ID del frontend coincide con el Client ID del backend
- [ ] El Client Secret está configurado en el backend (`GOOGLE_CLIENT_SECRET`)
- [ ] El Client ID es de tipo "Aplicación web"
- [ ] Esperaste 1-2 minutos después de guardar en Google Cloud Console

---

## 🐛 Debugging Adicional

### Ver Logs del Frontend

Abre la consola del navegador (F12) y busca:
- `📍 Client ID usado: ...`
- `📍 URL de retorno: ...`
- `📍 Origen actual: ...`

### Ver Logs del Backend

En los logs del backend, busca:
- `Client ID usado: ...`
- `Client Secret configurado: ...`
- `Intercambiando código por token (redirect_uri: ...)`

### Verificar Variables de Entorno

**Frontend (Vercel):**
- `VITE_GOOGLE_CLIENT_ID` (opcional si usas backend)
- `VITE_BACKEND_URL` (recomendado)

**Backend:**
- `GOOGLE_CLIENT_ID` (requerido)
- `GOOGLE_CLIENT_SECRET` (requerido)

---

## 🚨 Si el Problema Persiste

1. **Verifica que el Client ID y Client Secret sean del mismo proyecto en Google Cloud Console**
2. **Asegúrate de que el Client ID no haya sido eliminado o deshabilitado**
3. **Verifica que el proyecto de Google Cloud Console tenga la API de Google Drive habilitada**
4. **Revisa los logs del backend para ver el error exacto de Google**

---

## 📚 Referencias

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console - Credenciales](https://console.cloud.google.com/apis/credentials)








