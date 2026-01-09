# 🔍 Verificar Client Secret Exacto

## 📍 Problema

El error "OAuth client was not found" puede ocurrir si el **Client Secret no coincide exactamente** con el configurado en Google Cloud Console.

---

## ✅ Verificación Paso a Paso

### PASO 1: Ver el Client Secret en Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Proyecto: **silken-tape-478614-b6**
3. Busca el Client ID: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve`
4. **Haz clic en el Client ID** para ver sus detalles
5. En la sección **"Secretos del cliente"**, busca el secreto que termina en `0HfK` (creado el 5 de enero de 2026)
6. **Haz clic en el icono de descarga** o en "Mostrar" para ver el Client Secret completo

---

### PASO 2: Comparar con el Script

**En el script `8-iniciar-todo-ngrok.bat` (línea 64):**
```
set GOOGLE_CLIENT_SECRET=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
```

**El Client Secret debe coincidir EXACTAMENTE**, incluyendo:
- ✅ Todos los caracteres
- ✅ Mayúsculas y minúsculas
- ✅ Guiones y caracteres especiales
- ✅ Sin espacios al inicio o final

---

### PASO 3: Si NO Coinciden

1. **Copia el Client Secret correcto** de Google Cloud Console
2. **Edita el script `8-iniciar-todo-ngrok.bat`**
3. **Reemplaza la línea 64** con el Client Secret correcto:
   ```bat
   set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_CORRECTO_AQUI
   ```
4. **Guarda el archivo**
5. **Reinicia el servidor Flask** (cierra y vuelve a ejecutar `8-iniciar-todo-ngrok.bat`)

---

### PASO 4: Verificar que el Client ID Existe

Si el Client Secret coincide pero sigues teniendo el error:

1. **Verifica que el Client ID exista** en Google Cloud Console
2. **Verifica que sea de tipo "Aplicación web"** (no "Aplicación de escritorio")
3. **Verifica que las URIs de redirección incluyan:**
   - `http://localhost:5173/google-oauth-callback`
   - `http://127.0.0.1:5173/google-oauth-callback`
   - `https://sistema-soporte-mauve.vercel.app/google-oauth-callback`
   - `https://app.somosemagroup.com/google-oauth-callback`

---

## ⚠️ Nota Importante

Si tienes **más de un Client Secret** habilitado:
- Google puede estar usando uno diferente al que tienes en el script
- **Deshabilita o elimina** los Client Secrets antiguos que no uses
- Asegúrate de usar solo el Client Secret correcto

---

## 🔍 Verificación en los Logs

Después de reiniciar el servidor Flask, busca en los logs:

```
Client ID usado: 398160017868...
Client Secret configurado: SÍ
Client Secret (primeros 10 caracteres): GOCSPX-tQL...
```

Si ves estos mensajes, las credenciales se están pasando correctamente al backend.

---

## 💡 Si el Problema Persiste

Si después de verificar todo sigues teniendo el error:

1. **Verifica que el Client ID esté en el proyecto correcto** (`silken-tape-478614-b6`)
2. **Verifica que no haya espacios o caracteres ocultos** en el Client Secret del script
3. **Prueba regenerar el Client Secret** en Google Cloud Console y actualizar el script










