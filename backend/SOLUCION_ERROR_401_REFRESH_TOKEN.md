# 🔧 Solución: Error 401 al Refrescar Token de Google OAuth

## 📍 Problema

Al intentar refrescar el token de acceso de Google OAuth, recibes un error 401 con el mensaje:
```
Error 401: invalid_client
El Client Secret debe coincidir EXACTAMENTE (incluyendo mayúsculas/minúsculas)
```

## 🔍 Causa

El Client Secret configurado en el script `8-iniciar-todo-ngrok.bat` **NO coincide exactamente** con el Client Secret que está en Google Cloud Console para el Client ID `355638125084-lecv3ob03pj367159gpd41r5qm773439`.

---

## ✅ Solución Paso a Paso

### PASO 1: Verificar el Client Secret en Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. **Selecciona el proyecto: `EMAGROUP`**
3. Busca y haz clic en el Client ID: `355638125084-lecv3ob03pj367159gpd41r5qm773439`
4. En la sección **"Secretos del cliente"**, busca el Client Secret que termina en `3Bz`
5. **Haz clic en "Mostrar"** o en el icono de descarga para ver el Client Secret completo
6. **Copia el Client Secret completo** (empieza con `GOCSPX-`)

---

### PASO 2: Actualizar el Script del Backend

1. **Abre el archivo** `backend/8-iniciar-todo-ngrok.bat` en un editor de texto
2. **Busca la línea 67** que dice:
   ```bat
   set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
   ```
3. **Reemplaza** `TU_CLIENT_SECRET_AQUI` con el Client Secret real:
   ```bat
   set GOOGLE_CLIENT_SECRET=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
   ```
4. **También verifica la línea 60** que debe tener el Client ID correcto (el que obtuviste de Google Cloud Console)
5. **Guarda el archivo**

---

### PASO 3: Reiniciar el Backend

1. **Cierra el servidor Flask actual** (presiona `Ctrl+C` en la ventana donde está corriendo)
2. **Ejecuta nuevamente** `8-iniciar-todo-ngrok.bat`
3. **Verifica en los logs** que aparezca:
   ```
   Client ID (primeros 30 caracteres): 355638125084-lecv3ob03pj367159...
   Client Secret configurado: SÍ
   Client Secret (primeros 10 caracteres): GOCSPX-HHl...
   Client Secret (últimos 5 caracteres): ...U3Bz
   ```

---

### PASO 4: Verificar que Funciona

1. Intenta refrescar el token nuevamente desde la aplicación
2. El error 401 debería desaparecer
3. Si persiste, verifica que:
   - ✅ El Client ID sea correcto: `355638125084-lecv3ob03pj367159gpd41r5qm773439`
   - ✅ El Client Secret sea exactamente: `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`
   - ✅ No haya espacios al inicio o final del Client Secret
   - ✅ El proyecto en Google Cloud Console sea `EMAGROUP`

---

## ⚠️ Verificaciones Importantes

### El Client Secret debe coincidir EXACTAMENTE:

- ✅ Todos los caracteres
- ✅ Mayúsculas y minúsculas (ej: `HHltHAYkMrbjw07wtGAxT1HFU3Bz`)
- ✅ Guiones y caracteres especiales
- ✅ Sin espacios al inicio o final

### Si hay múltiples Client Secrets:

Si en Google Cloud Console ves varios Client Secrets habilitados:
1. **Identifica cuál es el correcto** (el que termina en `3Bz`)
2. **Deshabilita o elimina** los Client Secrets antiguos que no uses
3. Esto evitará confusión y mejorará la seguridad

---

## 🔒 Seguridad

- **NUNCA** subas el Client Secret real a Git
- El script en el repositorio tiene placeholders (`TU_CLIENT_SECRET_AQUI`) por seguridad
- Solo actualiza el script **localmente** en tu máquina
- Si pierdes el Client Secret, puedes crear uno nuevo en Google Cloud Console

---

## 📝 Resumen Rápido

1. ✅ Ve a Google Cloud Console → Proyecto `EMAGROUP` → Tu Client ID
2. ✅ Copia el Client Secret (empieza con `GOCSPX-`)
3. ✅ Edita `backend/8-iniciar-todo-ngrok.bat` línea 67
4. ✅ Reemplaza `TU_CLIENT_SECRET_AQUI` con el Client Secret real que copiaste
5. ✅ Reinicia el backend
6. ✅ Verifica que funcione
