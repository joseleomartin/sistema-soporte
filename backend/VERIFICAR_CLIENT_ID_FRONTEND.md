# 🔍 Verificar qué Client ID está usando el Frontend

## 📍 Problema

El error "OAuth client was not found" (401: invalid_client) puede ocurrir si el frontend está usando un Client ID diferente al configurado en el backend o que no existe en Google Cloud Console.

---

## ✅ Pasos para Diagnosticar

### PASO 1: Abrir la Consola del Navegador

1. Abre tu aplicación en el navegador
2. Presiona **F12** para abrir las herramientas de desarrollador
3. Ve a la pestaña **"Console"**

### PASO 2: Buscar el Client ID que se está usando

En la consola, busca estos mensajes:

```
📍 Client ID usado: ...
```

O:

```
✅ Client ID obtenido del backend
```

O:

```
✅ Client ID obtenido de variable de entorno: ...
```

**Copia ese Client ID completo**

---

### PASO 3: Verificar en Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Proyecto: **EMAGROUP**
3. Busca el Client ID que copiaste en el PASO 2

**Si NO encuentras el Client ID:**
- ❌ **Este es el problema**: El Client ID que está usando el frontend no existe
- El Client ID fue eliminado o nunca existió
- Necesitas usar el Client ID correcto: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`

**Si SÍ encuentras el Client ID:**
- Continúa con el PASO 4

---

### PASO 4: Verificar Variables de Entorno en Vercel

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**

**Verifica estas variables:**

#### A. Si usas Backend (Recomendado):
- ✅ `VITE_BACKEND_URL` debe estar configurado con la URL de ngrok
- ❌ `VITE_GOOGLE_CLIENT_ID` NO debe estar configurado (o debe ser el mismo que el del backend)

#### B. Si NO usas Backend:
- ✅ `VITE_GOOGLE_CLIENT_ID` debe ser: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`

---

### PASO 5: Verificar que el Client ID Coincida

El Client ID que está usando el frontend DEBE ser exactamente:
```
398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com
```

**Si es diferente:**
- Actualiza `VITE_GOOGLE_CLIENT_ID` en Vercel con el Client ID correcto
- O asegúrate de que `VITE_BACKEND_URL` esté configurado y el backend tenga el Client ID correcto
- **Redesplega** la aplicación en Vercel

---

## 🔧 Solución Rápida

### Opción 1: Usar Backend (Recomendado)

1. **En Vercel**, configura:
   - `VITE_BACKEND_URL` = `https://TU-URL-NGROK.ngrok-free.app`
   - **NO** configures `VITE_GOOGLE_CLIENT_ID` (déjalo vacío o elimínalo)

2. **En el backend**, el script `8-iniciar-todo-ngrok.bat` ya tiene el Client ID correcto configurado

3. **Redesplega** en Vercel

### Opción 2: Usar Variable de Entorno Directa

1. **En Vercel**, configura:
   - `VITE_GOOGLE_CLIENT_ID` = `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`
   - **NO** configures `VITE_BACKEND_URL` (o elimínalo)

2. **Redesplega** en Vercel

---

## ⚠️ Importante

- El Client ID debe existir en Google Cloud Console
- El Client ID debe ser de tipo **"Aplicación web"** (no "Aplicación de escritorio")
- Si cambias las variables de entorno en Vercel, **debes redesplegar** para que los cambios surtan efecto

---

## 📝 Verificación Final

Después de hacer los cambios:

1. **Redesplega** en Vercel
2. **Abre la consola del navegador** (F12)
3. **Busca**: `📍 Client ID usado: 398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve...`
4. Si aparece ese Client ID, el problema debería estar resuelto
5. Si sigue apareciendo un Client ID diferente, verifica las variables de entorno en Vercel










