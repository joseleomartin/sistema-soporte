# 🔍 Troubleshooting: Email de Confirmación No Llega

## 📋 Checklist de Verificación

### 1. Verificar Configuración en Supabase

#### A. URLs de Redirección
1. Ve a **Authentication** → **URL Configuration** en Supabase
2. En "Redirect URLs", asegúrate de tener:
   ```
   http://localhost:5173/confirm-email
   http://127.0.0.1:5173/confirm-email
   https://tu-dominio.com/confirm-email (si tienes producción)
   ```

#### B. Template de Email
1. Ve a **Authentication** → **Email Templates** → **Confirm sign up**
2. Verifica que el template tenga:
   - Subject: "Confirm Your Signup" (o similar)
   - Body: Debe incluir `{{ .ConfirmationURL }}` o similar
3. Guarda los cambios si hiciste modificaciones

#### C. Configuración SMTP (Opcional pero Recomendado)
1. Ve a **Authentication** → **SMTP Settings**
2. Si ves la advertencia sobre el servicio incorporado:
   - Para **desarrollo**: Puedes usar el servicio incorporado (tiene límites)
   - Para **producción**: Configura SMTP personalizado (SendGrid, Mailgun, etc.)

### 2. Verificar Logs de Supabase

1. Ve a **Authentication** → **Logs** en Supabase
2. Busca eventos relacionados con el email que intentaste registrar
3. Verifica si hay errores en el envío del email

### 3. Verificar en el Código

El código ahora:
- ✅ Intenta reenviar el email automáticamente después del registro
- ✅ Muestra un botón para reenviar el email si intentas iniciar sesión sin confirmar
- ✅ Configura correctamente la URL de redirección

### 4. Soluciones Alternativas

#### Opción A: Reenviar Email Manualmente

Si intentas iniciar sesión y ves el error "Email not confirmed":
1. Aparecerá un botón "Reenviar Email de Confirmación"
2. Haz clic en el botón
3. Revisa tu correo (incluida la carpeta de spam)

#### Opción B: Verificar Estado del Usuario

Puedes verificar si el usuario fue creado correctamente:
1. Ve a **Authentication** → **Users** en Supabase
2. Busca el email que intentaste registrar
3. Verifica:
   - Si el usuario existe
   - Si "Email Confirmed" está en "false"
   - Si hay algún error en los metadatos

#### Opción C: Confirmar Email Manualmente (Solo para Desarrollo)

Si estás en desarrollo y necesitas confirmar el email manualmente:

1. Ve a **Authentication** → **Users** en Supabase
2. Encuentra el usuario
3. Haz clic en los tres puntos (⋯) → **Confirm email**

**⚠️ NOTA**: Esto solo funciona en desarrollo. En producción, el usuario debe confirmar desde el email.

### 5. Problemas Comunes

#### Problema: El email no llega a ninguna parte

**Posibles causas:**
- El servicio de email incorporado de Supabase tiene límites de tasa
- El email está siendo bloqueado por el proveedor de email
- La configuración SMTP no está correcta

**Solución:**
1. Configura SMTP personalizado (SendGrid, Mailgun, etc.)
2. Verifica los logs de Supabase para ver si hay errores
3. Prueba con un email diferente (Gmail, Outlook, etc.)

#### Problema: El email llega a spam

**Solución:**
1. Revisa la carpeta de spam/correo no deseado
2. Marca el email como "No es spam"
3. Si usas SMTP personalizado, verifica los registros DNS (SPF, DKIM, DMARC)

#### Problema: El enlace de confirmación no funciona

**Solución:**
1. Verifica que las URLs de redirección estén correctamente configuradas
2. Verifica que la ruta `/confirm-email` exista en tu aplicación
3. Revisa la consola del navegador para ver si hay errores

### 6. Configurar SMTP Personalizado (Recomendado para Producción)

#### Usando SendGrid (Gratis hasta 100 emails/día)

1. Crea una cuenta en [SendGrid](https://sendgrid.com)
2. Obtén tu API Key
3. En Supabase: **Authentication** → **SMTP Settings**
4. Configura:
   - **Host**: `smtp.sendgrid.net`
   - **Port**: `587`
   - **Username**: `apikey`
   - **Password**: Tu API Key de SendGrid
   - **Sender email**: Un email verificado en SendGrid

#### Usando Mailgun (Gratis hasta 5,000 emails/mes)

1. Crea una cuenta en [Mailgun](https://mailgun.com)
2. Verifica tu dominio
3. Obtén tus credenciales SMTP
4. Configura en Supabase con las credenciales de Mailgun

### 7. Prueba Rápida

1. Intenta registrar una nueva empresa
2. Si no llega el email, intenta iniciar sesión
3. Si ves "Email not confirmed", haz clic en "Reenviar Email de Confirmación"
4. Revisa tu correo (y spam)
5. Si aún no llega, verifica los logs de Supabase

---

## 📞 Si Nada Funciona

1. Verifica los logs de Supabase (Authentication → Logs)
2. Verifica que el usuario se haya creado correctamente
3. Prueba con un email diferente
4. Considera configurar SMTP personalizado para mejor confiabilidad

