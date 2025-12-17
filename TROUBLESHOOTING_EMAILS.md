# 🔧 Troubleshooting: Emails No Llegan

## 📋 Checklist de Verificación

### 1. ✅ Ejecutar Script de Diagnóstico

Ejecuta este script en el SQL Editor de Supabase:
```sql
-- Ejecuta: supabase/DIAGNOSTICO_EMAILS.sql
```

Esto verificará:
- ✅ Tabla `app_settings` existe y tiene valores
- ✅ Extensión `pg_net` está habilitada
- ✅ Trigger está activo
- ✅ Función existe
- ✅ Usuarios tienen email configurado

### 2. ✅ Verificar Configuración en Supabase Dashboard

#### A. Edge Function `resend-email` - Secrets

Ve a: **Edge Functions** > **resend-email** > **Settings** > **Secrets**

Debe tener:
```
RESEND_API_KEY = re_EruAtU7H_EAYyUVA1cwjPQWy2wHKNx5LY
FROM_EMAIL = notificaciones@app.somosemagroup.com
```

**⚠️ IMPORTANTE:** `FROM_EMAIL` debe usar el dominio verificado en Resend (`app.somosemagroup.com`)

#### B. Verificar que la Edge Function está desplegada

Ve a: **Edge Functions** > **resend-email**

Debe mostrar:
- ✅ Estado: "Deployed"
- ✅ Última actualización: reciente
- ✅ Deployments: al menos 1

### 3. ✅ Verificar Configuración en Base de Datos

Ejecuta en SQL Editor:

```sql
-- Verificar app_settings
SELECT key, value 
FROM app_settings 
WHERE key IN ('supabase_url', 'supabase_anon_key');

-- Verificar pg_net
SELECT extname FROM pg_extension WHERE extname = 'pg_net';

-- Verificar trigger
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';
```

### 4. ✅ Revisar Logs

#### A. Logs de la Edge Function

1. Ve a: **Edge Functions** > **resend-email** > **Logs**
2. Busca errores o mensajes cuando se crea una notificación
3. Los logs deberían mostrar:
   - ✅ Peticiones recibidas
   - ✅ Respuestas de Resend
   - ❌ Errores si los hay

#### B. Logs de Resend

1. Ve a [resend.com](https://resend.com) > **Emails** > **Logs**
2. Busca intentos de envío
3. Verifica:
   - ✅ Emails enviados
   - ❌ Errores de envío
   - 📧 Estado de entrega

#### C. Logs de PostgreSQL (Notices)

Cuando creas una notificación, deberías ver en los logs de Supabase:
```
📧 Intentando enviar email a: usuario@ejemplo.com
📧 URL Edge Function: https://...
✅ Petición de envío de email iniciada para usuario@ejemplo.com
```

### 5. ✅ Probar Manualmente

Ejecuta el script de prueba:

```sql
-- Ejecuta: supabase/PRUEBA_ENVIO_EMAIL_MANUAL.sql
```

Este script:
- Crea una notificación de prueba
- Muestra información de debugging
- Te dice qué revisar

## 🔍 Problemas Comunes y Soluciones

### Problema 1: No se ejecuta el trigger

**Síntomas:**
- No ves logs en la Edge Function
- No hay notificaciones en Resend

**Solución:**
```sql
-- Verificar que el trigger existe y está activo
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';

-- Si está deshabilitado, habilitarlo:
ALTER TABLE notifications ENABLE TRIGGER trigger_send_notification_email;
```

### Problema 2: pg_net no funciona

**Síntomas:**
- Ves errores en los logs: "No se pudo iniciar envío de email"
- Error: "extension pg_net does not exist"

**Solución:**
```sql
-- Habilitar pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Verificar que está habilitado
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

### Problema 3: Edge Function no recibe peticiones

**Síntomas:**
- No hay logs en la Edge Function
- El trigger se ejecuta pero no hay respuesta

**Solución:**
1. Verifica que la URL en `app_settings` es correcta:
```sql
SELECT value FROM app_settings WHERE key = 'supabase_url';
-- Debe ser: https://yevbgutnuoivcuqnmrzi.supabase.co
```

2. Verifica que el anon_key está configurado:
```sql
SELECT value FROM app_settings WHERE key = 'supabase_anon_key';
-- No debe estar vacío
```

3. Prueba llamar a la Edge Function manualmente desde el SQL Editor:
```sql
-- Esto debería funcionar (reemplaza con valores reales)
SELECT net.http_post(
  url := 'https://yevbgutnuoivcuqnmrzi.supabase.co/functions/v1/resend-email',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer TU_ANON_KEY'
  ),
  body := '{"to":"tu-email@ejemplo.com","subject":"Prueba","html":"<p>Prueba</p>"}'
);
```

### Problema 4: Resend rechaza el email

**Síntomas:**
- Logs en Edge Function muestran error de Resend
- Resend logs muestran error

**Solución:**
1. Verifica que `FROM_EMAIL` usa el dominio verificado:
   - Debe ser: `notificaciones@app.somosemagroup.com`
   - NO puede ser: `notificaciones@emagroup.com` (si ese dominio no está verificado)

2. Verifica que el dominio está verificado en Resend:
   - Ve a Resend > Domains
   - Debe mostrar: `app.somosemagroup.com` como "Verified"

3. Verifica que los DNS están correctos:
   - DKIM: Verified ✅
   - SPF: Verified ✅
   - MX: Verified ✅

### Problema 5: Email llega a spam

**Síntomas:**
- El email se envía pero llega a spam

**Solución:**
1. Verifica DNS en Resend:
   - Todos los registros deben estar "Verified"
   
2. Espera 24-48 horas para que los DNS se propaguen completamente

3. Verifica que el contenido del email no tiene palabras spam

## 🧪 Prueba Paso a Paso

### Paso 1: Verificar Configuración Básica

```sql
-- Ejecuta esto
SELECT 
  'app_settings' as tabla,
  COUNT(*) as registros
FROM app_settings
WHERE key IN ('supabase_url', 'supabase_anon_key')
UNION ALL
SELECT 
  'pg_net' as tabla,
  COUNT(*) as registros
FROM pg_extension 
WHERE extname = 'pg_net'
UNION ALL
SELECT 
  'trigger' as tabla,
  COUNT(*) as registros
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';
```

**Resultado esperado:** 3 filas, cada una con `registros = 1`

### Paso 2: Crear Notificación de Prueba

```sql
-- Reemplaza USER_ID con un ID real
INSERT INTO notifications (user_id, type, title, message)
VALUES (
  'USER_ID_AQUI',
  'ticket_comment',
  'Prueba de Email',
  'Este es un email de prueba'
);
```

### Paso 3: Revisar Logs

1. **Supabase Dashboard** > **Edge Functions** > **resend-email** > **Logs**
   - Debe mostrar una petición POST
   - Debe mostrar respuesta de Resend

2. **Resend Dashboard** > **Emails** > **Logs**
   - Debe mostrar un email enviado
   - Debe mostrar el estado (delivered, bounced, etc.)

### Paso 4: Verificar Email

- Revisa la bandeja de entrada
- Revisa la carpeta de spam
- Verifica que el email llegó al destinatario correcto

## 📞 Si Nada Funciona

1. **Ejecuta el diagnóstico completo:**
   ```sql
   -- Ejecuta: supabase/DIAGNOSTICO_EMAILS.sql
   ```

2. **Revisa todos los logs:**
   - Edge Function logs
   - Resend logs
   - PostgreSQL notices (si están habilitados)

3. **Prueba llamar a la Edge Function directamente:**
   - Usa Postman o curl
   - URL: `https://yevbgutnuoivcuqnmrzi.supabase.co/functions/v1/resend-email`
   - Headers: `Authorization: Bearer TU_ANON_KEY`
   - Body: `{"to":"tu-email@ejemplo.com","subject":"Prueba","html":"<p>Prueba</p>"}`

4. **Verifica que Resend está funcionando:**
   - Prueba enviar un email manualmente desde Resend Dashboard
   - Si funciona, el problema está en la integración
   - Si no funciona, el problema está en Resend o DNS










