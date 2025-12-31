# 📧 Configuración de Emails para Notificaciones

Este documento explica cómo configurar el sistema de envío de emails cuando un usuario recibe una notificación.

## 📋 Requisitos Previos

1. **Supabase Project** configurado
2. **Edge Functions** habilitadas en tu proyecto Supabase
3. (Opcional) **Resend API Key** para envío de emails profesional

## 🚀 Pasos de Configuración

### 1. Desplegar la Edge Function

La Edge Function `send-notification-email` debe estar desplegada en Supabase:

```bash
# Desde la raíz del proyecto
supabase functions deploy send-notification-email
```

O usando el CLI de Supabase:

```bash
cd supabase/functions/send-notification-email
supabase functions deploy send-notification-email
```

### 2. Configurar Variables de Entorno

En el **Supabase Dashboard**:
1. Ve a **Edge Functions** > **send-notification-email**
2. Configura las siguientes variables de entorno:

#### Opción A: Usando Resend (Recomendado)

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@tudominio.com
```

**Para obtener una API Key de Resend:**
1. Ve a [resend.com](https://resend.com)
2. Crea una cuenta gratuita
3. Obtén tu API Key desde el dashboard
4. Verifica tu dominio o usa el dominio de prueba

#### Opción B: Sin Resend (Solo notificaciones en base de datos)

Si no configuras `RESEND_API_KEY`, el sistema seguirá funcionando pero no enviará emails. Las notificaciones se crearán normalmente en la base de datos.

### 3. Configurar Variables de Base de Datos

En el **Supabase Dashboard**:
1. Ve a **Database** > **Settings** > **Custom Config**
2. Agrega las siguientes configuraciones:

```sql
-- Ejecutar en SQL Editor de Supabase
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://TU_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'TU_ANON_KEY';
```

**Para encontrar estos valores:**
- `supabase_url`: Ve a **Settings** > **API** > **Project URL**
- `supabase_anon_key`: Ve a **Settings** > **API** > **anon/public key**

### 4. Habilitar pg_net Extension (Opcional pero Recomendado)

La extensión `pg_net` permite que PostgreSQL haga llamadas HTTP a la Edge Function:

```sql
-- Ejecutar en SQL Editor de Supabase
CREATE EXTENSION IF NOT EXISTS pg_net;
```

Si `pg_net` no está disponible, el sistema registrará un aviso pero no fallará.

### 5. Ejecutar la Migración

Ejecuta la migración SQL en el SQL Editor de Supabase:

```sql
-- El archivo está en: supabase/migrations/20251118000003_add_email_notifications.sql
```

O ejecuta todas las migraciones pendientes:

```bash
supabase db push
```

## ✅ Verificación

Para verificar que todo funciona:

1. **Crea una notificación de prueba** (por ejemplo, comenta en un ticket)
2. **Revisa los logs** en Supabase Dashboard > **Edge Functions** > **send-notification-email** > **Logs**
3. **Verifica el email** del usuario que recibió la notificación

## 🔧 Solución de Problemas

### El email no se envía

1. **Verifica los logs de la Edge Function:**
   - Supabase Dashboard > Edge Functions > send-notification-email > Logs

2. **Verifica que pg_net esté habilitado:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

3. **Verifica las variables de entorno:**
   - Edge Functions > send-notification-email > Settings > Secrets

4. **Verifica que la Edge Function esté desplegada:**
   - Edge Functions > Deployments

### Error: "pg_net no está disponible"

Si ves este error, tienes dos opciones:

1. **Habilitar pg_net** (recomendado):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```

2. **Usar Supabase Database Webhooks** como alternativa:
   - Ve a Database > Webhooks
   - Crea un webhook que se active en INSERT de notifications
   - Configura la URL de tu Edge Function

### El email llega a spam

1. **Verifica tu dominio en Resend**
2. **Configura SPF y DKIM** en tu dominio
3. **Usa un email de remitente profesional** (no noreply@)

## 📝 Notas Importantes

- **Las notificaciones se crean siempre**, incluso si el email falla
- **El sistema no falla si no puede enviar el email** (solo registra un aviso)
- **Los mensajes directos NO envían emails** (solo notificaciones en la app)
- **El email se envía de forma asíncrona** (no bloquea la creación de la notificación)

## 🎨 Personalización del Email

Puedes personalizar el template del email editando:
- `supabase/functions/send-notification-email/index.ts`

El template HTML está en la función `serve()` dentro del campo `html`.














