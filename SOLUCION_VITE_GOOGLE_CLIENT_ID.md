# 🔧 Solución: Error "VITE_GOOGLE_CLIENT_ID no está configurada"

## 📍 Problema

El error indica que la aplicación no puede encontrar el Client ID de Google. Esto ocurre cuando:
- No está configurado `VITE_GOOGLE_CLIENT_ID` en Vercel, Y
- No está configurado `VITE_BACKEND_URL` (o el backend no está disponible)

---

## ✅ Solución Rápida (2 Opciones)

### Opción 1: Usar Backend (Recomendado) 🚀

Si tienes un backend corriendo (con ngrok o desplegado):

1. **Ve a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Selecciona tu proyecto
   - Ve a **Settings** → **Environment Variables**

2. **Agrega o verifica esta variable:**
   - **Name**: `VITE_BACKEND_URL`
   - **Value**: `https://TU-URL-NGROK.ngrok-free.app` (o la URL de tu backend)
   - **Environments**: Production, Preview, Development
   - **Save**

3. **Asegúrate de que el backend tenga configurado:**
   - `GOOGLE_CLIENT_ID` = `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET` = (tu Client Secret)

4. **Redesplega** la aplicación en Vercel

---

### Opción 2: Configurar Client ID Directamente (Sin Backend) 🔑

Si NO usas backend o prefieres configurarlo directamente:

1. **Ve a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Selecciona tu proyecto
   - Ve a **Settings** → **Environment Variables**

2. **Agrega esta variable:**
   - **Name**: `VITE_GOOGLE_CLIENT_ID`
   - **Value**: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`
   - **Environments**: Production, Preview, Development
   - **Save**

3. **Si tienes `VITE_BACKEND_URL` configurado, elimínalo o déjalo vacío** (para que use el Client ID directo)

4. **Redesplega** la aplicación en Vercel

---

## 🔍 Verificar que el Client ID Existe en Google Cloud Console

**IMPORTANTE**: El Client ID debe existir en Google Cloud Console.

1. **Ve a Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials
   - Proyecto: **silken-tape-478614-b6**

2. **Busca el Client ID:**
   - `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`

3. **Si NO lo encuentras:**
   - El Client ID fue eliminado o no existe
   - Necesitas crear uno nuevo o usar uno existente
   - Ve a: **+ CREAR CREDENCIALES** → **ID de cliente de OAuth 2.0**
   - Tipo: **"Aplicación web"**
   - Copia el nuevo Client ID y actualiza `VITE_GOOGLE_CLIENT_ID` en Vercel

4. **Si SÍ lo encuentras, verifica:**
   - Tipo: Debe ser **"Aplicación web"** (no "Aplicación de escritorio")
   - Estado: Debe estar **habilitado**
   - **URI de redirección autorizados** debe incluir:
     - `https://app.somosemagroup.com/google-oauth-callback`
     - `http://localhost:5173/google-oauth-callback` (para desarrollo)
   - **Orígenes JavaScript autorizados** debe incluir:
     - `https://app.somosemagroup.com`
     - `http://localhost:5173` (para desarrollo)

---

## 📝 Pasos Detallados en Vercel

### Paso 1: Ir a Environment Variables

1. Abre: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Haz clic en **Settings** (en el menú superior)
4. Haz clic en **Environment Variables** (en el menú lateral)

### Paso 2: Agregar Variable

1. Haz clic en **Add New**
2. En **Key**, escribe: `VITE_GOOGLE_CLIENT_ID`
3. En **Value**, escribe: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`
4. Selecciona los **Environments**: Production, Preview, Development
5. Haz clic en **Save**

### Paso 3: Redesplegar

**IMPORTANTE**: Después de agregar/modificar variables de entorno, debes redesplegar:

1. Ve a la pestaña **Deployments**
2. Haz clic en los **3 puntos** (⋯) del último deployment
3. Selecciona **Redeploy**
4. Confirma el redespliegue

O simplemente:
- Haz un commit y push a tu repositorio
- Vercel redesplegará automáticamente

---

## ✅ Verificación

Después de configurar y redesplegar:

1. **Abre tu aplicación** en el navegador
2. **Abre la consola** (F12 → Console)
3. **Busca estos mensajes:**
   - ✅ `✅ Client ID obtenido de variable de entorno: 398160017868...`
   - ✅ `📍 Client ID usado: 398160017868...`

Si ves estos mensajes, la configuración está correcta.

---

## ⚠️ Errores Comunes

### Error: "El Client ID no tiene el formato correcto"
- **Causa**: El Client ID no termina en `.apps.googleusercontent.com`
- **Solución**: Verifica que copiaste el Client ID completo

### Error: "OAuth client was not found" (401: invalid_client)
- **Causa**: El Client ID no existe en Google Cloud Console
- **Solución**: Verifica que el Client ID existe en Google Cloud Console o crea uno nuevo

### Error: "redirect_uri_mismatch"
- **Causa**: La URL de redirección no está configurada en Google Cloud Console
- **Solución**: Agrega `https://app.somosemagroup.com/google-oauth-callback` en Google Cloud Console

---

## 📞 ¿Necesitas Ayuda?

Si después de seguir estos pasos el error persiste:

1. Verifica que el Client ID existe en Google Cloud Console
2. Verifica que las variables de entorno están correctamente configuradas en Vercel
3. Verifica que redesplegaste la aplicación después de cambiar las variables
4. Revisa la consola del navegador para ver mensajes de error más específicos
