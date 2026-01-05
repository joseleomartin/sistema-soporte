# 🔍 Diagnóstico: Error 401: invalid_client

## 📍 Posibles Causas

El error "401: invalid_client" puede deberse a varias razones:

### 1. **URL de Redirección no Configurada en Google Cloud Console** (MÁS COMÚN)

**Síntoma:** El error ocurre cuando Google intenta redirigir después de la autenticación.

**Solución:**
1. Obtén la URL de ngrok (ej: `https://abc123.ngrok-free.app`)
2. Ve a Google Cloud Console → Credenciales → Tu Client ID
3. Agrega en "URI de redirección autorizados":
   ```
   https://TU-URL-NGROK.ngrok-free.app/google-oauth-callback
   ```
4. Guarda y espera 1-2 minutos

---

### 2. **Client ID o Client Secret Incorrectos**

**Síntoma:** El error ocurre inmediatamente al iniciar la autenticación.

**Verificación:**
- Client ID debe coincidir con el configurado en el script `8-iniciar-todo-ngrok.bat`
- Client Secret debe coincidir con el configurado en el script `8-iniciar-todo-ngrok.bat`

**Solución:**
1. Verifica en Google Cloud Console que el Client ID existe
2. Verifica que el Client Secret coincida
3. Si no coinciden, actualiza las credenciales en el script `8-iniciar-todo-ngrok.bat`

---

### 3. **Client ID no Existe o fue Eliminado**

**Síntoma:** El error dice "The OAuth client was not found".

**Solución:**
1. Ve a Google Cloud Console → Credenciales
2. Busca el Client ID: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve`
3. Si NO existe:
   - Crea uno nuevo de tipo "Aplicación web"
   - O usa un Client ID existente
   - Actualiza el script con el nuevo Client ID

---

### 4. **Tipo de Aplicación Incorrecto**

**Síntoma:** El Client ID existe pero sigue dando error.

**Solución:**
1. En Google Cloud Console, verifica que el Client ID sea de tipo **"Aplicación web"**
2. Si es "Aplicación de escritorio", crea uno nuevo de tipo "Aplicación web"

---

### 5. **Origen no Permitido en el Backend**

**Síntoma:** El error ocurre al intentar obtener el Client ID del backend.

**Solución:**
- El backend ahora permite automáticamente orígenes de ngrok y Vercel
- Si usas otro dominio, agrégalo a `ALLOWED_ORIGINS` en `server.py`

---

## 🔧 Pasos de Diagnóstico

### Paso 1: Verificar Credenciales en el Backend

1. Ejecuta `8-iniciar-todo-ngrok.bat`
2. Abre la ventana "Servidor Flask"
3. Busca en los logs:
   ```
   Client ID usado: 398160017868...
   Client Secret configurado: SÍ
   ```
4. Si no aparecen, las credenciales no se están pasando correctamente

### Paso 2: Verificar Client ID en el Frontend

1. Abre la consola del navegador (F12)
2. Busca el mensaje:
   ```
   📍 Client ID usado: ...
   ```
3. Verifica que coincida con el Client ID configurado en el script

### Paso 3: Verificar URL de Redirección

1. En la consola del navegador, busca:
   ```
   📍 URL de retorno: ...
   ```
2. Esta URL debe estar en Google Cloud Console → Credenciales → "URI de redirección autorizados"

### Paso 4: Verificar en Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Proyecto: **silken-tape-478614-b6**
3. Busca el Client ID configurado en tu script
4. Verifica:
   - ✅ Tipo: "Aplicación web"
   - ✅ URI de redirección incluye tu URL de ngrok
   - ✅ Orígenes JavaScript incluyen tu URL de ngrok

---

## ✅ Solución Rápida

1. **Obtén la URL de ngrok** (de la ventana de ngrok o http://localhost:4040)
2. **Agrega en Google Cloud Console:**
   - URI de redirección: `https://TU-URL-NGROK.ngrok-free.app/google-oauth-callback`
   - Origen JavaScript: `https://TU-URL-NGROK.ngrok-free.app`
3. **Guarda y espera 1-2 minutos**
4. **Reinicia el servidor Flask** (si es necesario)
5. **Prueba nuevamente**

---

## 📝 Notas Importantes

- Cada vez que reinicies ngrok y obtengas una URL nueva, debes agregarla a Google Cloud Console
- Los cambios en Google Cloud Console pueden tardar 1-2 minutos en propagarse
- Asegúrate de que el Client ID y Client Secret coincidan exactamente con los de Google Cloud Console

