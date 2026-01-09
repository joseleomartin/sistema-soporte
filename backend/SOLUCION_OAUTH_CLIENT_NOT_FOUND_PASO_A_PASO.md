# 🔧 Solución Completa: Error "OAuth client was not found"

## 📍 Error que estás viendo

```
Error 401: invalid_client
The OAuth client was not found.
```

Este error significa que **Google no puede encontrar el Client ID** que estás intentando usar.

---

## ✅ Solución Paso a Paso

### PASO 1: Verificar el Client ID que estás usando

**En el script `8-iniciar-todo-ngrok.bat` (línea 59):**
```
set GOOGLE_CLIENT_ID=398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com
```

**Anota este Client ID completo:**
```
398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com
```

---

### PASO 2: Obtener la URL de ngrok

1. **Ejecuta** `8-iniciar-todo-ngrok.bat`
2. **Busca la ventana "ngrok - Túnel Público"**
3. **Copia la URL**, por ejemplo:
   ```
   https://abc123-def456-ghi789.ngrok-free.app
   ```

**O también puedes:**
- Abrir http://localhost:4040 en tu navegador
- Ver la URL en la sección "Forwarding"

**Anota esta URL de ngrok** (la necesitarás en el siguiente paso).

---

### PASO 3: Ir a Google Cloud Console

1. Ve a: **https://console.cloud.google.com/**
2. **Selecciona el proyecto:** `silken-tape-478614-b6`
   - Si no ves este proyecto, verifica que estés usando la cuenta correcta de Google
3. Ve a **"APIs y servicios"** → **"Credenciales"**
4. **Busca el Client ID:** `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve`

---

### PASO 4: Verificar si el Client ID Existe

**Si NO encuentras el Client ID:**

❌ **El Client ID no existe o fue eliminado**

**Solución:**
1. Haz clic en **"+ CREAR CREDENCIALES"** → **"ID de cliente de OAuth 2.0"**
2. **Tipo de aplicación:** Selecciona **"Aplicación web"** (NO "Aplicación de escritorio")
3. **Nombre:** Ponle cualquier nombre (ej: "Sistema Soporte - Drive")
4. **URI de redirección autorizados:** Agrega:
   ```
   http://localhost:5173/google-oauth-callback
   http://127.0.0.1:5173/google-oauth-callback
   https://app.somosemagroup.com/google-oauth-callback
   https://TU-URL-NGROK.ngrok-free.app/google-oauth-callback
   ```
   (Reemplaza `TU-URL-NGROK` con la URL que obtuviste en el PASO 2)
5. **Orígenes JavaScript autorizados:** Agrega:
   ```
   http://localhost:5173
   http://127.0.0.1:5173
   https://app.somosemagroup.com
   https://TU-URL-NGROK.ngrok-free.app
   ```
6. Haz clic en **"CREAR"**
7. **Copia el nuevo Client ID y Client Secret**
8. **Actualiza el script `8-iniciar-todo-ngrok.bat`:**
   - Línea 59: Reemplaza con el nuevo Client ID
   - Línea 64: Reemplaza con el nuevo Client Secret
9. **Reinicia el servidor Flask**

**Si SÍ encuentras el Client ID:**

✅ **El Client ID existe, pero falta configurar las URLs**

Continúa con el PASO 5.

---

### PASO 5: Agregar URI de Redirección de ngrok

1. **Haz clic en el Client ID** para editarlo
2. En la sección **"URI de redirección autorizados"**, haz clic en **"+ AGREGAR URI"**
3. Agrega la URL completa:
   ```
   https://TU-URL-NGROK.ngrok-free.app/google-oauth-callback
   ```
   (Reemplaza `TU-URL-NGROK` con la URL que obtuviste en el PASO 2)

**Ejemplo:**
```
https://abc123-def456-ghi789.ngrok-free.app/google-oauth-callback
```

4. **Asegúrate de que también estén estas URLs:**
   ```
   http://localhost:5173/google-oauth-callback
   http://127.0.0.1:5173/google-oauth-callback
   https://app.somosemagroup.com/google-oauth-callback
   ```

---

### PASO 6: Agregar Origen JavaScript de ngrok

1. En la sección **"Orígenes JavaScript autorizados"**, haz clic en **"+ AGREGAR ORIGEN"**
2. Agrega la URL base (sin `/google-oauth-callback`):
   ```
   https://TU-URL-NGROK.ngrok-free.app
   ```
   (Reemplaza `TU-URL-NGROK` con la URL que obtuviste en el PASO 2)

**Ejemplo:**
```
https://abc123-def456-ghi789.ngrok-free.app
```

3. **Asegúrate de que también estén estos orígenes:**
   ```
   http://localhost:5173
   http://127.0.0.1:5173
   https://app.somosemagroup.com
   ```

---

### PASO 7: Verificar Tipo de Aplicación

**IMPORTANTE:** El Client ID debe ser de tipo **"Aplicación web"**, NO "Aplicación de escritorio".

Si es de tipo "Aplicación de escritorio":
1. **NO puedes editarlo**, debes crear uno nuevo
2. Sigue las instrucciones del PASO 4 para crear uno nuevo

---

### PASO 8: Guardar y Esperar

1. Haz clic en **"GUARDAR"** en la parte inferior de la página
2. **Espera 1-2 minutos** para que los cambios se propaguen en los servidores de Google
3. **Cierra y vuelve a abrir tu navegador** (o limpia la caché)
4. **Reinicia el servidor Flask** (cierra y vuelve a ejecutar `8-iniciar-todo-ngrok.bat`)
5. **Prueba la autenticación nuevamente**

---

## 🔍 Verificación Final

### En la Consola del Navegador (F12):

Busca estos mensajes cuando intentes autenticarte:

```
✅ Client ID obtenido del backend: 398160017868...
📍 Client ID usado: 398160017868...
📍 URL de retorno: https://TU-URL-NGROK.ngrok-free.app/google-oauth-callback
```

**Verifica que:**
- El Client ID coincida con el de Google Cloud Console
- La URL de retorno coincida con una de las URLs configuradas en Google Cloud Console

### En la Ventana "Servidor Flask":

Busca estos mensajes:

```
Client ID usado: 398160017868...
Client Secret configurado: SÍ
```

**Si no aparecen:**
- Las credenciales no se están pasando correctamente al servidor
- Verifica que el script `8-iniciar-todo-ngrok.bat` tenga las credenciales correctas

---

## ⚠️ Problemas Comunes

### Problema 1: "El Client ID no existe"

**Solución:** Crea uno nuevo siguiendo el PASO 4.

### Problema 2: "redirect_uri_mismatch"

**Solución:** 
- Verifica que la URL de ngrok esté exactamente igual en Google Cloud Console
- Asegúrate de incluir `/google-oauth-callback` al final
- Verifica que no haya espacios o caracteres extra

### Problema 3: "El Client ID es de tipo 'Aplicación de escritorio'"

**Solución:** Crea uno nuevo de tipo "Aplicación web" (PASO 4).

### Problema 4: "Sigo viendo el error después de configurar todo"

**Solución:**
1. Espera 2-3 minutos más (los cambios pueden tardar)
2. Limpia la caché del navegador (Ctrl+Shift+Delete)
3. Cierra todas las ventanas del navegador y vuelve a abrir
4. Verifica que el Client ID en el script coincida exactamente con el de Google Cloud Console
5. Verifica que el Client Secret también coincida

---

## 📝 Resumen Rápido

1. ✅ Obtén la URL de ngrok
2. ✅ Ve a Google Cloud Console → Credenciales
3. ✅ Verifica que el Client ID exista (o créalo si no existe)
4. ✅ Agrega `https://TU-URL-NGROK.ngrok-free.app/google-oauth-callback` en "URI de redirección autorizados"
5. ✅ Agrega `https://TU-URL-NGROK.ngrok-free.app` en "Orígenes JavaScript autorizados"
6. ✅ Guarda y espera 1-2 minutos
7. ✅ Reinicia el servidor Flask
8. ✅ Prueba nuevamente

---

## 🔄 Cada vez que reinicies ngrok

Si reinicias ngrok y obtienes una URL nueva:

1. **Agrega la nueva URL** a Google Cloud Console (PASO 5 y 6)
2. **O mantén el túnel ngrok abierto** para reutilizar la misma URL

---

## 💡 Tip: Usar Dominio Estático

Si te cansas de agregar URLs nuevas cada vez:

1. Crea una cuenta gratuita en ngrok: https://dashboard.ngrok.com/signup
2. Configura autenticación para obtener un dominio más estable
3. O simplemente no cierres el túnel ngrok para mantener la misma URL










