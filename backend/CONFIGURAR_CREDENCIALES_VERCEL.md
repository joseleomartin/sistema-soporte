# 🔑 Configurar Credenciales de Google OAuth en Vercel

## 📍 Credenciales Actuales

- **Client ID**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com` (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`)
- **Client Secret**: `TU_CLIENT_SECRET_AQUI` (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`)
- **Proyecto Google Cloud**: `EMAGROUP`

---

## ✅ Configuración en Vercel

### Opción 1: Usar Backend (Recomendado - Más Seguro)

Si usas el backend con ngrok o un dominio fijo:

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Configura estas variables:

   **Variable: `VITE_BACKEND_URL`**
   - **Valor**: `https://TU-URL-NGROK.ngrok-free.app` (o tu URL del backend)
   - **Entornos**: Production, Preview, Development
   - **Descripción**: URL del backend que proporciona el Client ID

   **Variable: `VITE_GOOGLE_CLIENT_ID`** (Opcional - Solo si no usas backend)
   - **NO configures esta variable** si usas backend
   - O déjala vacía para que el frontend obtenga el Client ID del backend

5. **NO configures `VITE_GOOGLE_CLIENT_SECRET`** en Vercel (se maneja en el backend)

6. **Redesplega** la aplicación después de agregar las variables

---

### Opción 2: Sin Backend (Menos Seguro - No Recomendado)

Si NO usas backend y quieres configurar el Client ID directamente en Vercel:

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Configura estas variables:

   **Variable: `VITE_GOOGLE_CLIENT_ID`**
   - **Valor**: `TU_CLIENT_ID_AQUI.apps.googleusercontent.com` (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`)
   - **Entornos**: Production, Preview, Development
   - **Descripción**: Client ID de Google OAuth

   **Variable: `VITE_GOOGLE_CLIENT_SECRET`** (⚠️ NO RECOMENDADO - Solo si es absolutamente necesario)
   - **Valor**: `TU_CLIENT_SECRET_AQUI` (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`)
   - **Entornos**: Production, Preview, Development
   - **⚠️ ADVERTENCIA**: Exponer el Client Secret en el frontend es un riesgo de seguridad
   - **Recomendación**: Usa el backend en su lugar

5. **Redesplega** la aplicación después de agregar las variables

---

## 🔧 Configuración del Backend

### Script `8-iniciar-todo-ngrok.bat`

Edita el archivo `backend/8-iniciar-todo-ngrok.bat` localmente (no se sube a Git):

**Línea 60:**
```bat
set GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
```

**Línea 67:**
```bat
set GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI
```

**⚠️ IMPORTANTE**: Reemplaza `TU_CLIENT_ID_AQUI` y `TU_CLIENT_SECRET_AQUI` con las credenciales reales que obtuviste de Google Cloud Console (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`).

---

## ✅ Verificación

### Verificar en el Frontend (Consola del Navegador)

1. Abre tu aplicación en el navegador
2. Presiona **F12** para abrir las herramientas de desarrollador
3. Ve a la pestaña **Console**
4. Busca estos mensajes:

   **Si usas backend:**
   ```
   ✅ Client ID obtenido del backend: TU_CLIENT_ID_AQUI...
   ```

   **Si NO usas backend:**
   ```
   ✅ Client ID obtenido de variable de entorno: TU_CLIENT_ID_AQUI...
   ```

5. Si ves el Client ID correcto, la configuración está bien

### Verificar en Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. **Selecciona el proyecto: `EMAGROUP`**
3. Busca el Client ID que configuraste
4. Verifica que:
   - ✅ El Client ID exista
   - ✅ Sea de tipo "Aplicación web"
   - ✅ Esté habilitado
   - ✅ El Client Secret que configuraste esté en la lista de secretos

---

## 🔒 Seguridad

### ⚠️ IMPORTANTE

- **NUNCA** subas el Client Secret a Git
- **NUNCA** expongas el Client Secret en el código del frontend
- **Usa el backend** para manejar el Client Secret de forma segura
- El script `8-iniciar-todo-ngrok.bat` tiene placeholders (`TU_CLIENT_SECRET_AQUI`) en el repositorio
- Solo actualiza el script **localmente** en tu máquina

---

## 📝 Resumen de Variables

### En Vercel (Frontend)

| Variable | Valor | Cuándo Usar |
|----------|-------|-------------|
| `VITE_BACKEND_URL` | `https://TU-URL-NGROK.ngrok-free.app` | ✅ Siempre (si usas backend) |
| `VITE_GOOGLE_CLIENT_ID` | `TU_CLIENT_ID_AQUI.apps.googleusercontent.com` | Solo si NO usas backend (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`) |
| `VITE_GOOGLE_CLIENT_SECRET` | `TU_CLIENT_SECRET_AQUI` | ⚠️ NO RECOMENDADO (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`) |

### En el Backend (Script Local)

| Variable | Valor |
|----------|-------|
| `GOOGLE_CLIENT_ID` | `TU_CLIENT_ID_AQUI.apps.googleusercontent.com` (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`) |
| `GOOGLE_CLIENT_SECRET` | `TU_CLIENT_SECRET_AQUI` (ver `CONFIGURAR_CREDENCIALES_EMAGROUP.md`) |

---

## 🎯 Configuración Recomendada

**Para máxima seguridad:**

1. ✅ Configura `VITE_BACKEND_URL` en Vercel
2. ✅ NO configures `VITE_GOOGLE_CLIENT_ID` en Vercel (el frontend lo obtendrá del backend)
3. ✅ NO configures `VITE_GOOGLE_CLIENT_SECRET` en Vercel (se maneja en el backend)
4. ✅ Configura `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el script del backend (localmente)

Esto asegura que el Client Secret nunca se exponga en el código del frontend.
