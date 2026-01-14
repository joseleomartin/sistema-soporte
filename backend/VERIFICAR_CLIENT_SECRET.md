# 🔍 Verificar Client Secret en Google Cloud Console

## 📍 Problema

El error "OAuth client was not found" (401: invalid_client) puede ocurrir si:
1. El Client ID no existe en Google Cloud Console
2. El Client Secret no coincide con el Client ID

---

## ✅ Verificación Paso a Paso

### PASO 1: Ir a Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Proyecto: **EMAGROUP**
3. Busca el Client ID configurado en tu script
4. **Haz clic en el Client ID** para ver sus detalles

---

### PASO 2: Verificar Client Secret

En la página de detalles del Client ID:

1. **Busca la sección "Client secret"**
2. **Haz clic en "Mostrar"** o "Reveal" para ver el Client Secret
3. **Compara con el que está en el script:**
   - Debe coincidir EXACTAMENTE con el configurado en `8-iniciar-todo-ngrok.bat`
   - Verifica la línea `set GOOGLE_CLIENT_SECRET=...`

---

### PASO 3: Si el Client Secret NO Coincide

**Opción A: Actualizar el Script con el Client Secret Correcto**

1. Copia el Client Secret de Google Cloud Console
2. Edita `8-iniciar-todo-ngrok.bat`
3. Busca la línea:
   ```bat
   set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
   ```
4. Reemplaza con el Client Secret correcto de Google Cloud Console
5. Guarda el archivo
6. Reinicia el servidor Flask

**Opción B: Regenerar Client Secret en Google Cloud Console**

1. En Google Cloud Console, haz clic en "Regenerar" o "Reset" en el Client Secret
2. Copia el nuevo Client Secret
3. Actualiza el script como en la Opción A

---

### PASO 4: Si el Client ID NO Existe

Si no encuentras el Client ID configurado en tu script:

1. **Crea uno nuevo:**
   - Haz clic en "Crear credenciales" → "ID de cliente de OAuth 2.0"
   - Tipo: **"Aplicación web"**
   - Nombre: El que prefieras
   - URI de redirección autorizados: Agrega las URLs que necesites
   - Orígenes JavaScript autorizados: Agrega los orígenes que necesites

2. **Copia el nuevo Client ID y Client Secret**

3. **Actualiza el script `8-iniciar-todo-ngrok.bat`:**
   ```bat
   set GOOGLE_CLIENT_ID=NUEVO_CLIENT_ID.apps.googleusercontent.com
   set GOOGLE_CLIENT_SECRET=NUEVO_CLIENT_SECRET
   ```

4. **Reinicia el servidor Flask**

---

## 🔧 Verificación Rápida

### En el Script (8-iniciar-todo-ngrok.bat):
- Verifica las líneas `set GOOGLE_CLIENT_ID=...` y `set GOOGLE_CLIENT_SECRET=...`

### En Google Cloud Console:
- Debe existir el Client ID configurado en tu script
- El Client Secret debe coincidir EXACTAMENTE con el del script

---

## ⚠️ Importante

- El Client Secret es SENSIBLE, no lo compartas públicamente
- Si regeneras el Client Secret, debes actualizar el script
- Después de cambiar el script, **reinicia el servidor Flask** para que los cambios surtan efecto

