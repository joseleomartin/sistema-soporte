# 🔍 Verificar Variables de Entorno en Vercel

## 📍 Pasos Rápidos

### PASO 1: Ir a Vercel Dashboard

1. Ve a: https://vercel.com/dashboard
2. Inicia sesión si es necesario
3. Selecciona tu proyecto

### PASO 2: Verificar Variables de Entorno

1. Ve a **Settings** → **Environment Variables**
2. Busca estas variables:

#### Variable: `VITE_GOOGLE_CLIENT_ID`
- **Si existe**: Copia el valor completo
- **Si NO existe**: Está bien, significa que está usando el backend

#### Variable: `VITE_BACKEND_URL`
- **Si existe**: Copia el valor completo (debe ser la URL de ngrok)
- **Si NO existe**: El frontend no puede obtener el Client ID del backend

---

## ✅ Configuración Correcta

### Opción A: Usar Backend (Recomendado)

**Variables que DEBEN estar:**
- ✅ `VITE_BACKEND_URL` = `https://TU-URL-NGROK.ngrok-free.app`

**Variables que NO deben estar (o deben estar vacías):**
- ❌ `VITE_GOOGLE_CLIENT_ID` (no debe estar, o debe ser el mismo que el backend)

### Opción B: Usar Variable Directa

**Variables que DEBEN estar:**
- ✅ `VITE_GOOGLE_CLIENT_ID` = `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`

**Variables que NO deben estar:**
- ❌ `VITE_BACKEND_URL` (no debe estar, o debe estar vacía)

---

## 🔧 Si Encuentras un Client ID Diferente

Si `VITE_GOOGLE_CLIENT_ID` tiene un valor diferente a:
```
398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com
```

**Ese es el problema**. Ese Client ID no existe o no es válido.

**Solución:**
1. Edita `VITE_GOOGLE_CLIENT_ID` en Vercel
2. Cambia el valor a: `398160017868-h2ue67f8o1g6hahkofcqf43i2ra9abve.apps.googleusercontent.com`
3. Guarda
4. **Redesplega** la aplicación (esto es importante)

---

## 📝 Nota Importante

Después de cambiar las variables de entorno en Vercel, **DEBES redesplegar** para que los cambios surtan efecto. Los cambios no se aplican automáticamente a la aplicación ya desplegada.

