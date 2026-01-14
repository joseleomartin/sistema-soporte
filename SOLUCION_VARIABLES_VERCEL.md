# 🔧 Solución: Variables Configuradas pero No Funcionan

## 📍 Problema

Las variables de entorno están configuradas en Vercel (`VITE_GOOGLE_CLIENT_ID` y `VITE_BACKEND_URL`), pero el error persiste.

---

## ✅ Solución: Redesplegar la Aplicación

**IMPORTANTE**: Después de agregar o modificar variables de entorno en Vercel, **DEBES redesplegar** la aplicación para que los cambios surtan efecto.

### Pasos para Redesplegar:

1. **Ve a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Selecciona tu proyecto

2. **Ve a la pestaña "Deployments"**

3. **Haz clic en los 3 puntos (⋯) del último deployment**

4. **Selecciona "Redeploy"**

5. **Confirma el redespliegue**

**O simplemente:**
- Haz un commit y push a tu repositorio
- Vercel redesplegará automáticamente

---

## 🔍 Verificar la Configuración

### Si tienes AMBAS variables configuradas:

- `VITE_BACKEND_URL` = URL de tu backend
- `VITE_GOOGLE_CLIENT_ID` = Client ID de Google

**Comportamiento:**
- El código intentará obtener el Client ID del backend primero
- Si el backend no está disponible (timeout de 3 segundos), usará `VITE_GOOGLE_CLIENT_ID` como fallback

**Recomendación:**
- Si el backend está siempre disponible: Deja ambas configuradas
- Si el backend NO está siempre disponible: Elimina `VITE_BACKEND_URL` y usa solo `VITE_GOOGLE_CLIENT_ID`

---

## 🎯 Configuración Recomendada

### Opción A: Solo Client ID Directo (Más Simple) ✅

**Variables en Vercel:**
- ✅ `VITE_GOOGLE_CLIENT_ID` = `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`
- ❌ `VITE_BACKEND_URL` = **NO configurado** (o elimínalo)

**Ventajas:**
- Más rápido (no necesita consultar el backend)
- Más confiable (no depende de que el backend esté disponible)
- Funciona inmediatamente después del redespliegue

---

### Opción B: Usar Backend (Si lo Tienes Disponible)

**Variables en Vercel:**
- ✅ `VITE_BACKEND_URL` = `https://TU-URL-NGROK.ngrok-free.app`
- ✅ `VITE_GOOGLE_CLIENT_ID` = `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com` (como fallback)

**Ventajas:**
- Más seguro (el Client Secret no se expone en el frontend)
- Centraliza la configuración en el backend

**Desventajas:**
- Requiere que el backend esté siempre disponible
- Si el backend no está disponible, usará el fallback automáticamente

---

## ✅ Verificación Después del Redespliegue

1. **Abre tu aplicación** en el navegador
2. **Abre la consola** (F12 → Console)
3. **Busca estos mensajes:**

   **Si usa Client ID directo:**
   ```
   ✅ Client ID obtenido de variable de entorno: 398160017868...
   ```

   **Si usa backend:**
   ```
   ✅ Client ID obtenido del backend: 398160017868...
   ```

   **Si hay problemas:**
   ```
   ⚠️ Timeout al obtener Client ID del backend (3s). Usando VITE_GOOGLE_CLIENT_ID como fallback...
   ✅ Client ID obtenido de variable de entorno: 398160017868...
   ```

---

## ⚠️ Errores Comunes

### Error: "VITE_GOOGLE_CLIENT_ID no está configurada"

**Causa:** La aplicación no se redesplegó después de agregar la variable.

**Solución:**
1. Verifica que la variable esté en Vercel → Settings → Environment Variables
2. **Redesplega** la aplicación
3. Espera a que termine el despliegue
4. Recarga la página (Ctrl+F5 para forzar recarga)

---

### Error: "El backend no está disponible"

**Causa:** `VITE_BACKEND_URL` está configurado pero el backend no está corriendo.

**Solución:**
1. Verifica que el backend esté corriendo
2. Verifica que la URL en `VITE_BACKEND_URL` sea correcta
3. O elimina `VITE_BACKEND_URL` y usa solo `VITE_GOOGLE_CLIENT_ID`

---

## 📝 Resumen

1. ✅ Variables configuradas en Vercel
2. ✅ **Redesplegar** la aplicación (MUY IMPORTANTE)
3. ✅ Verificar en la consola del navegador que el Client ID se está usando correctamente

**Si después de redesplegar el error persiste:**
- Verifica que el Client ID existe en Google Cloud Console
- Verifica que el Client ID sea de tipo "Aplicación web"
- Revisa la consola del navegador para ver mensajes más específicos
