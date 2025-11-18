# 🔐 Configurar Google Drive en Vercel

## 📍 Problema: Error `redirect_uri_mismatch`

Este error ocurre porque la URL de redirección de tu aplicación en Vercel no está configurada en Google Cloud Console.

---

## 🚀 Solución: Agregar URLs de Vercel a Google Cloud Console

### PASO 1: Obtener la URL de tu aplicación en Vercel

Tu aplicación en Vercel tiene una URL como:
```
https://tu-proyecto.vercel.app
```

La URL de redirección completa será:
```
https://tu-proyecto.vercel.app/google-oauth-callback
```

---

### PASO 2: Ir a Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Ve a **"APIs y servicios"** → **"Credenciales"**
4. Haz clic en tu **Client ID**: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve`

---

### PASO 3: Agregar URI de Redirección Autorizado

En la sección **"URI de redirección autorizados"**, agrega:

**Para Producción:**
```
https://tu-proyecto.vercel.app/google-oauth-callback
```

**Para Preview (si usas branches):**
```
https://tu-proyecto-git-*.vercel.app/google-oauth-callback
```

**O usa el patrón wildcard:**
```
https://*.vercel.app/google-oauth-callback
```

**También mantén las URLs de desarrollo local:**
```
http://localhost:5173/google-oauth-callback
http://127.0.0.1:5173/google-oauth-callback
```

---

### PASO 4: Agregar Origen JavaScript Autorizado

En la sección **"Orígenes JavaScript autorizados"**, agrega:

**Para Producción:**
```
https://tu-proyecto.vercel.app
```

**Para Preview:**
```
https://*.vercel.app
```

**También mantén los orígenes de desarrollo:**
```
http://localhost:5173
http://127.0.0.1:5173
```

---

### PASO 5: Guardar y Esperar

1. Haz clic en **"GUARDAR"**
2. Espera 1-2 minutos para que los cambios se propaguen
3. Prueba la autenticación nuevamente

---

## 🔧 Configurar Variable de Entorno en Vercel

### PASO 1: Ir al Dashboard de Vercel

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**

---

### PASO 2: Agregar Variables de Entorno

Necesitas agregar **DOS** variables:

**Variable 1: Client ID**
1. Click en **"Add New"**
2. **Name**: `VITE_GOOGLE_CLIENT_ID`
3. **Value**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com`
   - ⚠️ **IMPORTANTE**: Obtén este valor de Google Cloud Console → Credenciales → Tu Client ID
4. **Environments**: Selecciona:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Click en **"Save"**

**Variable 2: Client Secret**
1. Click en **"Add New"** nuevamente
2. **Name**: `VITE_GOOGLE_CLIENT_SECRET`
3. **Value**: `TU_CLIENT_SECRET_AQUI`
   - ⚠️ **IMPORTANTE**: Este valor está en el archivo `backend/client_secret_*.json`
   - Busca el campo `client_secret` en ese archivo
   - O obténlo de Google Cloud Console → Credenciales → Tu Client ID → Client Secret
4. **Environments**: Selecciona:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
5. Click en **"Save"**

**⚠️ NOTA DE SEGURIDAD**: 
- El Client Secret en el frontend no es ideal por seguridad
- En el futuro, esto debería manejarse en el backend
- Por ahora, esta es la solución más rápida para que funcione

---

### PASO 3: Redesplegar

**IMPORTANTE**: Después de agregar la variable, Vercel necesita redesplegar.

**Opción A: Desde el Dashboard**
1. Ve a la pestaña **"Deployments"**
2. Click en el menú (⋮) del último deployment
3. Click en **"Redeploy"**
4. Espera 1-2 minutos

**Opción B: Desde Git**
```cmd
git commit --allow-empty -m "Trigger redeploy - add Google Client ID"
git push
```

---

## ✅ Verificar que Funciona

1. Abre tu app en Vercel
2. Intenta autenticar con Google Drive
3. El error `redirect_uri_mismatch` debería desaparecer

---

## 🎯 Resumen de URLs a Configurar

### En Google Cloud Console → Credenciales → Tu Client ID:

**URI de redirección autorizados:**
```
https://tu-proyecto.vercel.app/google-oauth-callback
https://*.vercel.app/google-oauth-callback
http://localhost:5173/google-oauth-callback
http://127.0.0.1:5173/google-oauth-callback
```

**Orígenes JavaScript autorizados:**
```
https://tu-proyecto.vercel.app
https://*.vercel.app
http://localhost:5173
http://127.0.0.1:5173
```

### En Vercel → Settings → Environment Variables:

```
VITE_GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```

**⚠️ IMPORTANTE**: 
- El Client ID se obtiene de Google Cloud Console → Credenciales → Tu Client ID
- El Client Secret se obtiene del archivo `backend/client_secret_*.json` o de Google Cloud Console → Credenciales → Tu Client ID → Client Secret

---

## 🐛 Troubleshooting

### Problema: Sigue dando `redirect_uri_mismatch`

**Solución**: 
1. Verifica que la URL en Google Cloud Console sea exactamente igual a la que usa tu app
2. Asegúrate de incluir el protocolo (`https://` o `http://`)
3. Asegúrate de incluir la ruta completa (`/google-oauth-callback`)
4. Espera 2-3 minutos después de guardar en Google Cloud Console
5. Limpia la caché del navegador (Ctrl+Shift+R)

### Problema: La variable no se aplica en Vercel

**Solución**: 
- Asegúrate de redesplegar después de agregar/actualizar la variable
- Las variables de entorno solo se cargan durante el build
- Verifica que seleccionaste todos los environments (Production, Preview, Development)

---

## 💡 Notas Importantes

- **URLs exactas**: Google es muy estricto con las URLs. Deben coincidir exactamente.
- **Protocolo**: Asegúrate de usar `https://` para producción y `http://` para desarrollo local.
- **Ruta completa**: Incluye siempre la ruta completa `/google-oauth-callback`.
- **Wildcards**: Puedes usar `*.vercel.app` para cubrir todas las URLs de preview de Vercel.
- **Tiempo de propagación**: Los cambios en Google Cloud Console pueden tardar 1-2 minutos en aplicarse.

---

¡Listo! Tu aplicación en Vercel ahora debería poder autenticar con Google Drive correctamente. 🚀
