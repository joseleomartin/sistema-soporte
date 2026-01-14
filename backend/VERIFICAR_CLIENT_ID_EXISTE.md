# 🔍 Verificar que el Client ID Existe en Google Cloud Console

## 📍 Problema Actual

El error "The OAuth client was not found" (Error 401: invalid_client) indica que **Google no puede encontrar el Client ID** que estás usando.

**Client ID usado:** `TU_CLIENT_ID_AQUI.apps.googleusercontent.com`

---

## ✅ Verificación Paso a Paso

### PASO 1: Ir a Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. **Selecciona el proyecto:** `EMAGROUP`
   - Si no ves este proyecto, haz clic en el selector de proyectos (arriba a la izquierda) y selecciónalo

### PASO 2: Buscar el Client ID

1. En la lista de "Credenciales de OAuth 2.0", busca el Client ID:
   ```
   TU_CLIENT_ID_AQUI
   ```

2. **¿Lo encuentras?**
   - ✅ **SÍ**: Continúa con el PASO 3
   - ❌ **NO**: El Client ID fue eliminado o nunca existió → Ve al PASO 4

### PASO 3: Verificar el Client ID (Si Existe)

1. **Haz clic en el Client ID** para ver sus detalles
2. Verifica:
   - ✅ **Tipo**: Debe ser "Aplicación web" (no "Aplicación de escritorio")
   - ✅ **Estado**: Debe estar habilitado (no deshabilitado)
   - ✅ **Proyecto**: Debe estar en `silken-tape-478614-b6`

3. **Verifica los Client Secrets:**
   - En la sección "Secretos del cliente", busca el que termina en `__JI`
   - Si NO lo encuentras, busca el que termina en `_Jl` (18 de noviembre de 2025)
   - Si NO encuentras ninguno, el Client Secret no coincide

### PASO 4: Si el Client ID NO Existe

**Opción A: El Client ID fue eliminado**

1. Google puede eliminar Client IDs inactivos después de 6 meses
2. **Solución**: Crea un nuevo Client ID

**Opción B: El Client ID está en otro proyecto**

1. Verifica todos tus proyectos en Google Cloud Console
2. Busca el Client ID en cada proyecto
3. Si lo encuentras en otro proyecto, actualiza el script con ese Client ID y su Client Secret

**Opción C: Crear un Nuevo Client ID**

1. En Google Cloud Console → Credenciales
2. Haz clic en **"+ CREAR CREDENCIALES"** → **"ID de cliente de OAuth 2.0"**
3. Configura:
   - **Tipo de aplicación**: "Aplicación web"
   - **Nombre**: El que prefieras (ej: "Sistema Soporte")
   - **URI de redirección autorizados**: Agrega:
     - `https://app.somosemagroup.com/google-oauth-callback`
     - `http://localhost:5173/google-oauth-callback`
     - `http://127.0.0.1:5173/google-oauth-callback`
   - **Orígenes JavaScript autorizados**: Agrega:
     - `https://app.somosemagroup.com`
     - `http://localhost:5173`
     - `http://127.0.0.1:5173`
4. Haz clic en **"CREAR"**
5. **Copia el nuevo Client ID y Client Secret**
6. Actualiza el script `8-iniciar-todo-ngrok.bat` con las nuevas credenciales

---

## 🔧 Actualizar el Script con Nuevas Credenciales

Si creaste un nuevo Client ID o encontraste el correcto:

1. Edita `backend/8-iniciar-todo-ngrok.bat`
2. Busca las líneas:
   ```bat
   set GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
   set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
   ```
3. Reemplaza con las nuevas credenciales:
   ```bat
   set GOOGLE_CLIENT_ID=NUEVO_CLIENT_ID.apps.googleusercontent.com
   set GOOGLE_CLIENT_SECRET=NUEVO_CLIENT_SECRET
   ```
4. Guarda el archivo
5. **Reinicia el servidor Flask** (cierra y vuelve a ejecutar `8-iniciar-todo-ngrok.bat`)

---

## ⚠️ Verificar Client Secret Correcto

Si el Client ID existe pero el error persiste:

1. En Google Cloud Console, haz clic en el Client ID
2. En "Secretos del cliente", busca:
   - El que termina en `__JI` (doble guion bajo)
   - O el que termina en `_Jl` (creado el 18 de noviembre de 2025)
3. **Haz clic en el icono de descarga** o "Mostrar" para ver el Client Secret completo
4. **Compara EXACTAMENTE** con el del script:
   - Debe coincidir carácter por carácter
   - Incluyendo mayúsculas, minúsculas, guiones y caracteres especiales
5. Si NO coincide, actualiza el script con el Client Secret correcto

---

## 🎯 Resumen de Verificación

**Checklist:**
- [ ] El proyecto `EMAGROUP` está seleccionado en Google Cloud Console
- [ ] El Client ID `TU_CLIENT_ID_AQUI` existe
- [ ] El Client ID es de tipo "Aplicación web"
- [ ] El Client ID está habilitado (no deshabilitado)
- [ ] El Client Secret que termina en `__JI` o `_Jl` existe para ese Client ID
- [ ] El Client Secret en el script coincide EXACTAMENTE con el de Google Cloud Console

---

## 💡 Si Nada Funciona

Si después de verificar todo sigues teniendo el error:

1. **Crea un nuevo Client ID** desde cero
2. **Actualiza el script** con las nuevas credenciales
3. **Actualiza Vercel** con el nuevo `VITE_GOOGLE_CLIENT_ID`
4. **Reinicia todo** (backend y redesplega frontend)










