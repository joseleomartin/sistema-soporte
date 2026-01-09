# 🔑 Crear Nuevo Client Secret en Google Cloud Console

## 📍 Pasos para Crear un Nuevo Client Secret

### PASO 1: Ir a Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Selecciona el proyecto: **silken-tape-478614-b6**
3. Busca y haz clic en el Client ID: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve`

### PASO 2: Crear Nuevo Client Secret

1. En la sección **"Secretos del cliente"**, haz clic en **"+ Add secret"** (o "+ Agregar secreto")
2. Se generará un nuevo Client Secret
3. **⚠️ IMPORTANTE**: Google mostrará el Client Secret completo **SOLO UNA VEZ**
4. **COPIA INMEDIATAMENTE** el Client Secret completo (empieza con `GOCSPX-`)
5. Guárdalo en un lugar seguro

### PASO 3: Deshabilitar o Eliminar los Client Secrets Antiguos (Opcional)

**⚠️ ADVERTENCIA**: Solo haz esto DESPUÉS de actualizar el script y verificar que funciona.

1. Para el Client Secret que termina en `_Jl` (18 de noviembre de 2025):
   - Haz clic en **"Inhabilitar"** o en el icono de basura
   - Esto evitará confusión y mejorará la seguridad

2. Para el Client Secret que termina en `0HfK` (5 de enero de 2026):
   - Si no lo usas, también puedes deshabilitarlo o eliminarlo

### PASO 4: Actualizar el Script

1. Edita `backend/8-iniciar-todo-ngrok.bat`
2. Busca la línea:
   ```bat
   set GOOGLE_CLIENT_SECRET=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
   ```
3. Reemplaza con el nuevo Client Secret:
   ```bat
   set GOOGLE_CLIENT_SECRET=NUEVO_CLIENT_SECRET_AQUI
   ```
4. Guarda el archivo

### PASO 5: Reiniciar el Backend

1. Cierra el servidor Flask actual (Ctrl+C)
2. Ejecuta `8-iniciar-todo-ngrok.bat` nuevamente
3. Verifica que no haya errores

---

## ✅ Verificación

Después de crear el nuevo Client Secret y actualizar el script:

1. Reinicia el backend
2. Intenta autenticar con Google Drive
3. El error "The OAuth client was not found" debería desaparecer

---

## 🔒 Seguridad

- **NUNCA** compartas el Client Secret públicamente
- **NUNCA** lo subas a Git (ya está en `.gitignore`)
- Guárdalo en un lugar seguro
- Si pierdes el Client Secret, crea uno nuevo










