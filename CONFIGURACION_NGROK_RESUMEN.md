# 🚀 Configuración con ngrok - Resumen Rápido

## ✅ Estado Actual

Las nuevas credenciales de Google OAuth ya están configuradas en tu proyecto:

- ✅ **Client ID**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com`
- ✅ **Client Secret**: `TU_CLIENT_SECRET_AQUI`
- ✅ **Script ngrok actualizado**: `backend/8-iniciar-todo-ngrok.bat`

---

## 📋 Checklist de Configuración

### 1. ✅ Backend (Ya Configurado)
- [x] Credenciales actualizadas en `backend/8-iniciar-todo-ngrok.bat`
- [ ] Ejecutar el script para iniciar el backend

### 2. ⚠️ Google Cloud Console (Pendiente)
Necesitas agregar las URLs en Google Cloud Console:

1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Ve a **APIs y servicios** → **Credenciales**
4. Haz clic en tu Client ID: `355638125084-lecv3ob03pj367159gpd41r5qm773439`
5. En "URI de redirección autorizados", agrega:

```
https://tu-proyecto.vercel.app/google-oauth-callback
https://*.vercel.app/google-oauth-callback
http://localhost:5173/google-oauth-callback
http://127.0.0.1:5173/google-oauth-callback
https://*.ngrok-free.app/google-oauth-callback
```

**Nota**: El patrón `*.ngrok-free.app` cubrirá todas las URLs de ngrok.

6. Haz clic en **GUARDAR**

### 3. ⚠️ Vercel (Pendiente)

1. Ve a: https://vercel.com/dashboard
2. Tu proyecto → **Settings** → **Environment Variables**
3. Configura o actualiza:

   **Variable 1:**
   - **Name**: `VITE_GOOGLE_CLIENT_ID`
   - **Value**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com`
   - **Environments**: Production, Preview, Development

   **Variable 2:**
   - **Name**: `VITE_BACKEND_URL`
   - **Value**: `https://tu-url-ngrok.ngrok-free.app` (obtén esta URL al ejecutar ngrok)
   - **Environments**: Production, Preview, Development

4. **Guarda** y **redesplega**

### 4. 🚀 Iniciar Backend con ngrok

1. Abre una terminal en la carpeta `backend/`
2. Ejecuta: `8-iniciar-todo-ngrok.bat`
3. Espera a que aparezcan DOS ventanas:
   - Una con el servidor Flask corriendo
   - Otra con ngrok mostrando la URL pública
4. Copia la URL de ngrok (ej: `https://abc123.ngrok-free.app`)
5. Si es la primera vez o si cambió, actualiza:
   - La URL en Google Cloud Console (si no usaste el patrón `*.ngrok-free.app`)
   - La variable `VITE_BACKEND_URL` en Vercel
   - Redesplega el frontend en Vercel

---

## 🔄 Workflow Diario

Cada vez que quieras usar Google Drive:

1. **Inicia el backend**: Ejecuta `backend/8-iniciar-todo-ngrok.bat`
2. **Verifica la URL de ngrok**: Copia la URL que muestra ngrok
3. **Si la URL cambió**: Actualiza `VITE_BACKEND_URL` en Vercel y redesplega
4. **Mantén ngrok activo**: No cierres las ventanas mientras uses la app

---

## ✅ Verificar que Funciona

1. ✅ Backend corriendo: Verifica que veas el servidor Flask activo
2. ✅ ngrok activo: Verifica que veas una URL pública en la ventana de ngrok
3. ✅ Backend responde: Abre `https://tu-url-ngrok.ngrok-free.app/health` en el navegador
4. ✅ Vercel configurado: Verifica las variables de entorno en Vercel
5. ✅ Prueba autenticación: Intenta conectar Google Drive desde tu app en Vercel

---

## ⚠️ Notas Importantes

1. **URL de ngrok cambia**: Cada vez que reinicies ngrok, la URL cambia (a menos que uses plan Pro con dominio fijo)
2. **Actualizar Vercel**: Si la URL de ngrok cambia, debes actualizar `VITE_BACKEND_URL` en Vercel y redesplegar
3. **Patrón wildcard**: Si usas `*.ngrok-free.app` en Google Cloud Console, no necesitas agregar cada URL nueva
4. **Mantener activo**: ngrok y el backend deben estar corriendo mientras uses la aplicación

---

## 🐛 Problemas Comunes

### Error: "redirect_uri_mismatch"
- **Solución**: Agrega la URL de ngrok a "URI de redirección autorizados" en Google Cloud Console

### Error: Backend no responde
- **Solución**: Verifica que `8-iniciar-todo-ngrok.bat` esté corriendo y que veas la ventana de ngrok activa

### Error: CORS
- **Solución**: El backend ya tiene CORS configurado. Verifica que la URL en `VITE_BACKEND_URL` sea correcta

---

## 📚 Documentación Relacionada

- `CONFIGURAR_GOOGLE_OAUTH_NGROK.md` - Guía completa de configuración con ngrok
- `CREDENCIALES_GOOGLE_ACTUALIZADAS.md` - Detalles de las nuevas credenciales

---

¡Listo! Sigue los pasos arriba para tener todo configurado con las nuevas credenciales. 🚀


