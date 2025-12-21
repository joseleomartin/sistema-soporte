# 🔍 Verificar y Corregir Client ID de Google OAuth

## 📍 Problema: "The OAuth client was not found"

Este error significa que el **Client ID que estás usando no existe** en Google Cloud Console o fue eliminado.

---

## ✅ Solución Paso a Paso

### PASO 1: Verificar qué Client ID se está usando

**En la consola del navegador (F12), busca:**
```
📍 Client ID usado: ...
```

Este es el Client ID que se está intentando usar.

### PASO 2: Verificar en Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Ve a **"APIs y servicios"** → **"Credenciales"**
4. Busca el Client ID que aparece en la consola del navegador

**Si NO encuentras el Client ID:**
- El Client ID fue eliminado o nunca existió
- Necesitas crear uno nuevo o usar uno existente

**Si SÍ encuentras el Client ID:**
- Verifica que sea de tipo **"Aplicación web"** (no "Aplicación de escritorio")
- Continúa con el PASO 3

### PASO 3: Verificar Configuración del Client ID

En Google Cloud Console, haz clic en tu Client ID y verifica:

#### A. Tipo de Aplicación
- Debe ser: **"Aplicación web"**
- Si es "Aplicación de escritorio", crea uno nuevo de tipo "Aplicación web"

#### B. URI de redirección autorizados
Debe incluir:
```
https://app.somosemagroup.com/google-oauth-callback
```

**También agrega URLs de desarrollo (si las usas):**
```
http://localhost:5173/google-oauth-callback
http://127.0.0.1:5173/google-oauth-callback
```

#### C. Orígenes JavaScript autorizados
Debe incluir:
```
https://app.somosemagroup.com
```

**También agrega orígenes de desarrollo:**
```
http://localhost:5173
http://127.0.0.1:5173
```

### PASO 4: Verificar Variables de Entorno

#### Frontend (Vercel)

**Opción A: Usar Backend (Recomendado)**
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que `VITE_BACKEND_URL` esté configurado
3. El backend debe tener `GOOGLE_CLIENT_ID` configurado

**Opción B: Usar Variable Directa**
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que `VITE_GOOGLE_CLIENT_ID` esté configurado
3. El valor debe ser el Client ID que existe en Google Cloud Console

#### Backend

1. Verifica que `GOOGLE_CLIENT_ID` esté configurado
2. Verifica que `GOOGLE_CLIENT_SECRET` esté configurado
3. **IMPORTANTE**: El Client ID del backend DEBE ser el mismo que el del frontend

### PASO 5: Crear Nuevo Client ID (si no existe)

Si el Client ID no existe en Google Cloud Console:

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Haz clic en **"+ CREAR CREDENCIALES"** → **"ID de cliente de OAuth"**
3. Selecciona tipo: **"Aplicación web"**
4. Nombre: `Sistema Soporte - Web App`
5. **URI de redirección autorizados:**
   ```
   https://app.somosemagroup.com/google-oauth-callback
   http://localhost:5173/google-oauth-callback
   ```
6. **Orígenes JavaScript autorizados:**
   ```
   https://app.somosemagroup.com
   http://localhost:5173
   ```
7. Haz clic en **"CREAR"**
8. Copia el **Client ID** y el **Client Secret**

### PASO 6: Actualizar Variables de Entorno

#### En Vercel (Frontend)

**Si usas backend:**
- Solo necesitas `VITE_BACKEND_URL` configurado
- El backend debe tener el nuevo `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`

**Si NO usas backend:**
- Actualiza `VITE_GOOGLE_CLIENT_ID` con el nuevo Client ID
- También necesitas `VITE_GOOGLE_CLIENT_SECRET` (menos seguro)

#### En el Backend

1. Actualiza `GOOGLE_CLIENT_ID` con el nuevo Client ID
2. Actualiza `GOOGLE_CLIENT_SECRET` con el nuevo Client Secret
3. Reinicia el backend

### PASO 7: Redesplegar

1. **Vercel**: Redesplega la aplicación (automático si usas Git, o manual desde el dashboard)
2. **Backend**: Reinicia el servidor
3. Espera 1-2 minutos para que los cambios se propaguen

### PASO 8: Probar Nuevamente

1. Abre la aplicación
2. Intenta autenticarte con Google
3. Verifica en la consola del navegador que el Client ID sea el correcto

---

## 🔍 Debugging

### Ver Logs del Frontend

Abre la consola del navegador (F12) y busca:
- `📍 Client ID usado: ...` - Este es el Client ID que se está usando
- `✅ Client ID obtenido del backend` - Si se obtuvo del backend
- `✅ Client ID obtenido de variable de entorno` - Si se obtuvo de Vercel

### Ver Logs del Backend

En los logs del backend, busca:
- `Client ID usado: ...` - El Client ID que el backend está usando
- `Client Secret configurado: SÍ/NO` - Si el Client Secret está configurado

### Verificar que Coincidan

**El Client ID del frontend DEBE ser exactamente igual al Client ID del backend.**

Si no coinciden:
1. Verifica las variables de entorno
2. Asegúrate de que ambos usen el mismo Client ID
3. Redesplega/reinicia ambos

---

## ⚠️ Errores Comunes

### Error: "The OAuth client was not found"
- **Causa**: El Client ID no existe en Google Cloud Console
- **Solución**: Crea un nuevo Client ID o verifica que el Client ID esté correcto

### Error: "redirect_uri_mismatch"
- **Causa**: El redirect_uri no está configurado en Google Cloud Console
- **Solución**: Agrega `https://app.somosemagroup.com/google-oauth-callback` en "URI de redirección autorizados"

### Error: "invalid_client"
- **Causa**: El Client ID del frontend no coincide con el Client Secret del backend
- **Solución**: Verifica que ambos usen el mismo Client ID y Client Secret

### Error: "idpiframe_initialization_failed"
- **Causa**: El origen no está autorizado en Google Cloud Console
- **Solución**: Agrega `https://app.somosemagroup.com` en "Orígenes JavaScript autorizados"

---

## 📚 Referencias

- [Google Cloud Console - Credenciales](https://console.cloud.google.com/apis/credentials)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)






