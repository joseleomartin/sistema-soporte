# 🔍 Verificar Client Secret en el Backend

## 📍 Problema: "The OAuth client was not found" (aunque el Client ID existe)

Si el Client ID existe en Google Cloud Console pero sigues recibiendo el error, el problema puede ser:

1. **El Client Secret en el backend NO coincide** con ninguno de los Client Secrets habilitados en Google Cloud Console
2. **El backend no está usando el Client ID correcto**

---

## ✅ Verificación Paso a Paso

### PASO 1: Ver los Client Secrets en Google Cloud Console

En la configuración del Client ID `355638125084-lecv3ob03pj367159gpd41r5qm773439`, ve a la sección **"Secretos del cliente"**.

Verás dos Client Secrets habilitados:
- Secret 1: Termina en `****NbJJ` (creado el 28 nov 2025)
- Secret 2: Termina en `****U3Bz` (creado el 14 ene 2026)

**⚠️ IMPORTANTE**: Necesitas usar **uno de estos dos Client Secrets** en el backend.

---

### PASO 2: Verificar el Client Secret en el Backend

1. Abre el archivo `backend/8-iniciar-todo-ngrok.bat` (localmente)
2. Busca la línea 67 que dice:
   ```bat
   set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
   ```
3. **Verifica qué Client Secret está configurado**

---

### PASO 3: Comparar con Google Cloud Console

**Si el Client Secret en el backend termina en `NbJJ`:**
- Debe coincidir EXACTAMENTE con el Secret 1 de Google Cloud Console
- Verifica que sea: `GOCSPX-...NbJJ` (completo)

**Si el Client Secret en el backend termina en `U3Bz`:**
- Debe coincidir EXACTAMENTE con el Secret 2 de Google Cloud Console
- Verifica que sea: `GOCSPX-...U3Bz` (completo)

**⚠️ IMPORTANTE**: 
- El Client Secret debe coincidir **EXACTAMENTE** (carácter por carácter)
- Incluyendo mayúsculas, minúsculas, guiones y caracteres especiales
- Sin espacios al inicio o final

---

### PASO 4: Si el Client Secret NO Coincide

**Opción A: Usar el Secret más reciente (recomendado)**

1. En Google Cloud Console, haz clic en el Secret que termina en `U3Bz` (el más reciente)
2. Si puedes verlo completo, cópialo
3. Si no puedes verlo (Google ya no muestra los secrets completos), necesitas crear uno nuevo

**Opción B: Crear un Nuevo Client Secret**

1. En Google Cloud Console, en la sección "Secretos del cliente"
2. Haz clic en **"+ Agregar secreto"** o **"+ Add secret"**
3. Se generará un nuevo Client Secret
4. **⚠️ IMPORTANTE**: Google mostrará el Client Secret completo **SOLO UNA VEZ**
5. **COPIA INMEDIATAMENTE** el Client Secret completo (empieza con `GOCSPX-`)
6. Actualiza el backend:
   ```bat
   set GOOGLE_CLIENT_SECRET=GOCSPX-NUEVO_SECRET_AQUI
   ```
7. Reinicia el backend

---

### PASO 5: Verificar el Client ID en el Backend

1. Abre el archivo `backend/8-iniciar-todo-ngrok.bat` (localmente)
2. Busca la línea 60 que dice:
   ```bat
   set GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
   ```
3. **Verifica que sea exactamente**:
   ```bat
   set GOOGLE_CLIENT_ID=355638125084-lecv3ob03pj367159gpd41r5qm773439.apps.googleusercontent.com
   ```

---

### PASO 6: Reiniciar el Backend

Después de actualizar las credenciales:

1. **Cierra el servidor Flask actual** (Ctrl+C)
2. **Ejecuta nuevamente** `8-iniciar-todo-ngrok.bat`
3. **Verifica en los logs** que aparezca:
   ```
   Client ID usado: 355638125084-lecv3ob03pj367159...
   Client Secret configurado: SÍ
   ```

---

## ⚠️ Advertencia sobre Múltiples Client Secrets

Google Cloud Console muestra una advertencia:
> "Tener más de un secreto aumenta los riesgos de seguridad. Inhabilita y borra el secreto anterior una vez que hayas verificado que tu app usa el secreto nuevo."

**Recomendación:**
1. Verifica que el backend esté usando el Client Secret correcto
2. Una vez confirmado, deshabilita o elimina el Client Secret antiguo que no uses

---

## 📝 Checklist Final

- [ ] El Client ID en el backend es: `355638125084-lecv3ob03pj367159gpd41r5qm773439.apps.googleusercontent.com`
- [ ] El Client Secret en el backend coincide EXACTAMENTE con uno de los dos habilitados en Google Cloud Console
- [ ] El Client Secret termina en `NbJJ` o `U3Bz` (según cuál uses)
- [ ] No hay espacios al inicio o final del Client Secret
- [ ] Reiniciaste el backend después de actualizar las credenciales
- [ ] Esperaste 1-2 minutos después de reiniciar

---

## 💡 Si el Problema Persiste

1. Crea un nuevo Client Secret en Google Cloud Console
2. Actualiza el backend con el nuevo Client Secret
3. Deshabilita el Client Secret antiguo que no uses
4. Reinicia el backend
5. Espera 1-2 minutos y prueba nuevamente
