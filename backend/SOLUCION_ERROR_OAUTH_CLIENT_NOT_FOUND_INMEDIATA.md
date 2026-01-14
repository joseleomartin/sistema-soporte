# 🔧 Solución Inmediata: Error "The OAuth client was not found"

## 📍 Error que estás viendo

```
The OAuth client was not found.
Error 401: invalid_client
```

Este error significa que **Google no puede encontrar el Client ID** que estás usando.

---

## ✅ Solución Rápida (5 minutos)

### PASO 1: Verificar el Client ID que se está usando

1. Abre la consola del navegador (F12)
2. Busca el mensaje: `📍 Client ID usado: ...`
3. **Copia ese Client ID completo**

O verifica en localStorage:
```javascript
localStorage.getItem('last_used_google_client_id')
```

---

### PASO 2: Verificar en Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. **Selecciona el proyecto: `EMAGROUP`** (no otro proyecto)
3. Busca el Client ID que copiaste en el PASO 1

**¿Lo encuentras?**
- ✅ **SÍ**: Ve al PASO 3
- ❌ **NO**: Ve al PASO 4

---

### PASO 3: Verificar Configuración del Client ID (Si Existe)

Haz clic en el Client ID y verifica:

#### A. Tipo de Aplicación
- ✅ Debe ser: **"Aplicación web"** (NO "Aplicación de escritorio")
- Si es "Aplicación de escritorio", ese es el problema. Necesitas crear uno nuevo de tipo "Aplicación web"

#### B. Estado
- ✅ Debe estar **habilitado** (no deshabilitado)

#### C. URI de redirección autorizados
Debe incluir **EXACTAMENTE** esta URL:
```
https://app.somosemagroup.com/google-oauth-callback
```

**⚠️ IMPORTANTE:**
- La URL debe coincidir **EXACTAMENTE** (incluyendo `https://`, sin espacios, etc.)
- Si no está, **agrégala** y haz clic en "GUARDAR"
- Espera 1-2 minutos después de guardar

#### D. Orígenes JavaScript autorizados
Debe incluir:
```
https://app.somosemagroup.com
```

**⚠️ IMPORTANTE:**
- El origen debe coincidir **EXACTAMENTE** (sin `/google-oauth-callback`, solo el dominio)
- Si no está, **agrégala** y haz clic en "GUARDAR"

---

### PASO 4: Si el Client ID NO Existe

El Client ID fue eliminado o nunca existió. Necesitas crear uno nuevo:

1. En Google Cloud Console → Credenciales
2. Haz clic en **"+ CREAR CREDENCIALES"** → **"ID de cliente de OAuth 2.0"**
3. Configura:
   - **Tipo de aplicación**: **"Aplicación web"** (NO "Aplicación de escritorio")
   - **Nombre**: "Sistema Soporte - Drive" (o el que prefieras)
   - **URI de redirección autorizados**: Agrega:
     ```
     https://app.somosemagroup.com/google-oauth-callback
     ```
   - **Orígenes JavaScript autorizados**: Agrega:
     ```
     https://app.somosemagroup.com
     ```
4. Haz clic en **"CREAR"**
5. **Copia el nuevo Client ID y Client Secret**
6. **Actualiza el backend**:
   - Edita `backend/8-iniciar-todo-ngrok.bat` localmente
   - Reemplaza `TU_CLIENT_ID_AQUI` con el nuevo Client ID
   - Reemplaza `TU_CLIENT_SECRET_AQUI` con el nuevo Client Secret
   - Reinicia el backend

---

## 🔍 Verificación Final

Después de hacer los cambios:

1. **Espera 1-2 minutos** (Google necesita tiempo para propagar los cambios)
2. **Limpia el caché del navegador** o usa modo incógnito
3. **Intenta autenticar nuevamente**

---

## ⚠️ Errores Comunes

### Error: "redirect_uri_mismatch"
- **Causa**: La URL de redirección no está configurada en Google Cloud Console
- **Solución**: Agrega `https://app.somosemagroup.com/google-oauth-callback` en "URI de redirección autorizados"

### Error: "invalid_client" (después de crear nuevo Client ID)
- **Causa**: El backend todavía está usando el Client ID antiguo
- **Solución**: Actualiza el script `8-iniciar-todo-ngrok.bat` y reinicia el backend

### Error: "access_denied"
- **Causa**: El usuario canceló la autorización
- **Solución**: Intenta nuevamente y acepta los permisos

---

## 📝 Checklist Rápido

- [ ] El proyecto en Google Cloud Console es **EMAGROUP**
- [ ] El Client ID existe en Google Cloud Console
- [ ] El Client ID es de tipo **"Aplicación web"** (no "Aplicación de escritorio")
- [ ] El Client ID está **habilitado**
- [ ] La URI `https://app.somosemagroup.com/google-oauth-callback` está en "URI de redirección autorizados"
- [ ] El origen `https://app.somosemagroup.com` está en "Orígenes JavaScript autorizados"
- [ ] El backend tiene el Client ID correcto configurado
- [ ] Esperaste 1-2 minutos después de guardar los cambios

---

## 💡 Si el Problema Persiste

1. Verifica que el Client ID en el backend coincida exactamente con el de Google Cloud Console
2. Verifica que no haya espacios o caracteres ocultos en el Client ID
3. Prueba crear un nuevo Client ID desde cero
4. Contacta al administrador del sistema
