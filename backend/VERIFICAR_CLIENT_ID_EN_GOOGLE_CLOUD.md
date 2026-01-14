# 🔍 Verificar Client ID en Google Cloud Console

## 📍 Problema: "The OAuth client was not found" (aunque las URIs estén configuradas)

Si las URIs de redirección ya están agregadas pero sigues recibiendo el error, el problema puede ser:

1. **El Client ID que estás usando NO existe en Google Cloud Console**
2. **El Client ID está en otro proyecto** (no en EMAGROUP)
3. **El Client ID está deshabilitado**
4. **El Client ID es de tipo incorrecto** (debe ser "Aplicación web")

---

## ✅ Verificación Paso a Paso

### PASO 1: Ver qué Client ID se está usando

**Opción A: En la consola del navegador (F12)**
1. Abre la consola (F12)
2. Busca: `📍 Client ID usado: ...`
3. **Copia ese Client ID completo**

**Opción B: En localStorage**
1. Abre la consola (F12)
2. Ejecuta: `localStorage.getItem('last_used_google_client_id')`
3. **Copia el Client ID que aparece**

**Opción C: En el backend**
1. Revisa los logs del backend
2. Busca: `Client ID usado: ...`
3. **Copia ese Client ID**

---

### PASO 2: Verificar en Google Cloud Console

1. Ve a: https://console.cloud.google.com/apis/credentials
2. **⚠️ IMPORTANTE: Selecciona el proyecto `EMAGROUP`** (no otro proyecto)
3. En la lista de "Credenciales de OAuth 2.0", busca el Client ID que copiaste

**¿Lo encuentras?**
- ✅ **SÍ**: Ve al PASO 3
- ❌ **NO**: Ve al PASO 4

---

### PASO 3: Verificar Configuración del Client ID (Si Existe)

Haz clic en el Client ID y verifica:

#### A. Tipo de Aplicación
- ✅ Debe ser: **"Aplicación web"**
- ❌ Si es "Aplicación de escritorio", ese es el problema. Necesitas crear uno nuevo de tipo "Aplicación web"

#### B. Estado
- ✅ Debe estar **habilitado** (no deshabilitado)
- Si está deshabilitado, haz clic en "Habilitar"

#### C. Proyecto
- ✅ Debe estar en el proyecto **EMAGROUP**
- Si está en otro proyecto, ese es el problema

---

### PASO 4: Si el Client ID NO Existe

El Client ID que estás usando no existe en Google Cloud Console. Tienes dos opciones:

#### Opción A: Usar un Client ID Existente

1. En Google Cloud Console, busca otros Client IDs en el proyecto EMAGROUP
2. Si encuentras uno de tipo "Aplicación web" y habilitado:
   - Copia ese Client ID
   - Actualiza el backend: `backend/8-iniciar-todo-ngrok.bat`
   - Reemplaza `TU_CLIENT_ID_AQUI` con el Client ID existente
   - Reinicia el backend

#### Opción B: Crear un Nuevo Client ID

1. En Google Cloud Console → Credenciales
2. Haz clic en **"+ CREAR CREDENCIALES"** → **"ID de cliente de OAuth 2.0"**
3. Configura:
   - **Tipo de aplicación**: **"Aplicación web"** (NO "Aplicación de escritorio")
   - **Nombre**: "Sistema Soporte - Drive"
   - **URI de redirección autorizados**: (ya las tienes configuradas)
   - **Orígenes JavaScript autorizados**: (ya los tienes configurados)
4. Haz clic en **"CREAR"**
5. **Copia el nuevo Client ID y Client Secret**
6. **Actualiza el backend**:
   - Edita `backend/8-iniciar-todo-ngrok.bat` localmente
   - Reemplaza `TU_CLIENT_ID_AQUI` con el nuevo Client ID
   - Reemplaza `TU_CLIENT_SECRET_AQUI` con el nuevo Client Secret
   - Reinicia el backend

---

## 🔍 Verificación del Client ID Esperado

El código está configurado para usar este Client ID:
```
355638125084-lecv3ob03pj367159gpd41r5qm773439.apps.googleusercontent.com
```

**Verifica que este Client ID exista en Google Cloud Console en el proyecto EMAGROUP.**

Si este Client ID no existe, necesitas:
1. Crearlo en Google Cloud Console, O
2. Actualizar el código para usar un Client ID que sí exista

---

## ⚠️ Errores Comunes

### "El Client ID no existe"
- **Causa**: El Client ID en el backend no coincide con ningún Client ID en Google Cloud Console
- **Solución**: Verifica que el Client ID en `8-iniciar-todo-ngrok.bat` exista en Google Cloud Console

### "El Client ID está en otro proyecto"
- **Causa**: El Client ID existe pero en un proyecto diferente (no EMAGROUP)
- **Solución**: Selecciona el proyecto correcto (EMAGROUP) o mueve el Client ID al proyecto correcto

### "El Client ID es de tipo incorrecto"
- **Causa**: El Client ID es "Aplicación de escritorio" en lugar de "Aplicación web"
- **Solución**: Crea un nuevo Client ID de tipo "Aplicación web"

---

## 📝 Checklist Final

- [ ] El proyecto seleccionado en Google Cloud Console es **EMAGROUP**
- [ ] El Client ID que estás usando **existe** en Google Cloud Console
- [ ] El Client ID es de tipo **"Aplicación web"** (no "Aplicación de escritorio")
- [ ] El Client ID está **habilitado**
- [ ] Las URIs de redirección están configuradas (ya las tienes)
- [ ] Los orígenes JavaScript están configurados (ya los tienes)
- [ ] El backend tiene el Client ID correcto configurado en `8-iniciar-todo-ngrok.bat`
- [ ] Reiniciaste el backend después de actualizar el Client ID

---

## 💡 Próximos Pasos

1. **Verifica qué Client ID se está usando** (consola del navegador o logs del backend)
2. **Verifica que ese Client ID exista en Google Cloud Console** (proyecto EMAGROUP)
3. **Si no existe, créalo o usa uno existente**
4. **Actualiza el backend con el Client ID correcto**
5. **Reinicia el backend**
6. **Espera 1-2 minutos** y prueba nuevamente
