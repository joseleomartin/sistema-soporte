# 🔧 Solución: Error "OAuth client was not found" (401: invalid_client)

## 📍 Problema

Cuando intentas autenticarte con Google Drive usando ngrok, recibes el error:
```
Error 401: invalid_client
The OAuth client was not found.
```

## 🔍 Causas

Este error ocurre porque:

1. **La URL de ngrok no está configurada en Google Cloud Console**
   - Cada vez que reinicias ngrok, obtienes una URL nueva
   - Esta URL debe estar en "URI de redirección autorizados" en Google Cloud Console

2. **El Client ID no existe o fue eliminado**
   - El Client ID `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com` debe existir en Google Cloud Console

---

## ✅ Solución Paso a Paso

### PASO 1: Obtener la URL de ngrok

1. Ejecuta `8-iniciar-todo-ngrok.bat` o `9-iniciar-todo-ngrok-simple.bat`
2. Busca la ventana "ngrok - Túnel Público"
3. Copia la URL que aparece, por ejemplo:
   ```
   https://abc123-def456-ghi789.ngrok-free.app
   ```
4. La URL de redirección completa será:
   ```
   https://abc123-def456-ghi789.ngrok-free.app/google-oauth-callback
   ```

**O también puedes:**
- Abrir http://localhost:4040 en tu navegador (dashboard de ngrok)
- Ver la URL en la sección "Forwarding"

---

### PASO 2: Ir a Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Selecciona el proyecto: **silken-tape-478614-b6**
3. Ve a **"APIs y servicios"** → **"Credenciales"**
4. Busca y haz clic en el Client ID:
   ```
   398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com
   ```

---

### PASO 3: Agregar URI de Redirección de ngrok

En la sección **"URI de redirección autorizados"**, agrega:

**La URL completa de ngrok:**
```
https://TU-URL-NGROK.ngrok-free.app/google-oauth-callback
```

**Ejemplo:**
```
https://abc123-def456-ghi789.ngrok-free.app/google-oauth-callback
```

**⚠️ IMPORTANTE:**
- Reemplaza `TU-URL-NGROK` con la URL real de tu túnel ngrok
- Cada vez que reinicies ngrok y obtengas una URL nueva, debes agregarla aquí
- Puedes agregar múltiples URLs (una por cada túnel ngrok que uses)

---

### PASO 4: Agregar Origen JavaScript de ngrok

En la sección **"Orígenes JavaScript autorizados"**, agrega:

**La URL base de ngrok (sin /google-oauth-callback):**
```
https://TU-URL-NGROK.ngrok-free.app
```

**Ejemplo:**
```
https://abc123-def456-ghi789.ngrok-free.app
```

---

### PASO 5: Mantener URLs de Desarrollo

Asegúrate de que también estén configuradas estas URLs (si las usas):

**URI de redirección autorizados:**
```
http://localhost:5173/google-oauth-callback
http://127.0.0.1:5173/google-oauth-callback
https://app.somosemagroup.com/google-oauth-callback
```

**Orígenes JavaScript autorizados:**
```
http://localhost:5173
http://127.0.0.1:5173
https://app.somosemagroup.com
```

---

### PASO 6: Guardar y Esperar

1. Haz clic en **"GUARDAR"** en la parte inferior de la página
2. **Espera 1-2 minutos** para que los cambios se propaguen en los servidores de Google
3. Prueba la autenticación nuevamente

---

## 🔄 Solución Alternativa: Usar Dominio Estático de ngrok

Si te cansas de agregar URLs nuevas cada vez, puedes:

1. **Crear una cuenta gratuita en ngrok**: https://dashboard.ngrok.com/signup
2. **Configurar un dominio estático** (solo en planes de pago) o usar el dominio gratuito
3. **O simplemente reutilizar el mismo túnel** sin cerrarlo

---

## 🔍 Verificar que el Client ID Existe

Si después de agregar las URLs sigues teniendo el error:

1. Ve a Google Cloud Console → Credenciales
2. Busca el Client ID: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve`
3. Si **NO lo encuentras**:
   - El Client ID fue eliminado
   - Necesitas crear uno nuevo o usar uno existente
4. Si **SÍ lo encuentras**:
   - Verifica que sea de tipo **"Aplicación web"** (no "Aplicación de escritorio")
   - Verifica que las URLs estén correctamente escritas (sin espacios, con https://, etc.)

---

## 📝 Resumen Rápido

1. ✅ Obtén la URL de ngrok (ej: `https://abc123.ngrok-free.app`)
2. ✅ Ve a Google Cloud Console → Credenciales → Tu Client ID
3. ✅ Agrega `https://abc123.ngrok-free.app/google-oauth-callback` en "URI de redirección autorizados"
4. ✅ Agrega `https://abc123.ngrok-free.app` en "Orígenes JavaScript autorizados"
5. ✅ Guarda y espera 1-2 minutos
6. ✅ Prueba nuevamente

---

## ⚠️ Nota Importante

Cada vez que reinicies ngrok y obtengas una URL nueva, debes:
1. Agregar la nueva URL a Google Cloud Console
2. O mantener el túnel ngrok abierto para reutilizar la misma URL

