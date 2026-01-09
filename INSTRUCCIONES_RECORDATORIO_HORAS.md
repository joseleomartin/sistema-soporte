# 📧 Recordatorio Diario de Carga de Horas

## 📋 Descripción

Este sistema envía automáticamente un email recordatorio a **todos los usuarios** todos los días a las **17:00 horas** para que carguen sus horas trabajadas del día.

## 🚀 Instalación

### Paso 1: Aplicar la Migración

Ejecuta la migración SQL en el **SQL Editor** de Supabase:

```sql
-- Ejecutar: supabase/migrations/20251118000005_daily_hours_reminder.sql
```

Esta migración:
- ✅ Crea la función `send_hours_reminder_emails()`
- ✅ Configura el cron job para ejecutarse diariamente a las 17:00
- ✅ Usa la Edge Function `resend-email` existente para enviar los emails

### Paso 2: Verificar Configuración

Asegúrate de que tienes configurado en `app_settings`:
- ✅ `supabase_url` - URL de tu proyecto Supabase
- ✅ `supabase_anon_key` - Anon key de Supabase
- ✅ `frontend_url` (opcional) - URL de tu frontend (por defecto: `https://app.somosemagroup.com`)

Si no están configurados, ejecuta:

```sql
-- Ver: supabase/AGREGAR_ANON_KEY.sql
-- Ver: supabase/CONFIGURAR_EMAIL_NOTIFICACIONES.sql
```

### Paso 3: Verificar Edge Function

Asegúrate de que la Edge Function `resend-email` esté desplegada y tenga configuradas las variables de entorno:
- ✅ `RESEND_API_KEY` - API key de Resend
- ✅ `FROM_EMAIL` - Email remitente (opcional, por defecto: `notificaciones@app.somosemagroup.com`)
- ✅ `FRONTEND_URL` - URL del frontend (opcional)

## 🧪 Probar Manualmente

Para probar el envío de emails sin esperar a las 17:00:

```sql
-- Ejecutar: supabase/PRUEBA_RECORDATORIO_HORAS.sql
-- Luego ejecutar:
SELECT send_hours_reminder_emails();
```

Esto enviará el email de recordatorio a todos los usuarios con email válido.

## ⚙️ Configuración del Cron Job

### Ver Cron Jobs Programados

```sql
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active
FROM cron.job
WHERE jobname = 'daily-hours-reminder';
```

### Deshabilitar el Cron Job

Si necesitas deshabilitar temporalmente el recordatorio:

```sql
SELECT cron.unschedule('daily-hours-reminder');
```

### Habilitar el Cron Job

Para volver a habilitarlo:

```sql
SELECT cron.schedule(
  'daily-hours-reminder',
  '0 17 * * *',  -- Todos los días a las 17:00
  $$SELECT send_hours_reminder_emails();$$
);
```

### Cambiar la Hora del Recordatorio

Para cambiar la hora (por ejemplo, a las 18:00):

```sql
-- Primero deshabilitar el actual
SELECT cron.unschedule('daily-hours-reminder');

-- Crear uno nuevo con la nueva hora
SELECT cron.schedule(
  'daily-hours-reminder',
  '0 18 * * *',  -- Todos los días a las 18:00
  $$SELECT send_hours_reminder_emails();$$
);
```

**Formato cron:** `'minuto hora día_mes mes día_semana'`
- `'0 17 * * *'` = minuto 0, hora 17 (5 PM), todos los días
- `'0 18 * * *'` = minuto 0, hora 18 (6 PM), todos los días
- `'30 16 * * *'` = minuto 30, hora 16 (4:30 PM), todos los días

## 📧 Contenido del Email

El email incluye:
- **Asunto:** "EmaGroup Notificaciones: Recordatorio de Carga de Horas"
- **Mensaje:** Recordatorio amigable para cargar las horas del día
- **Botón:** "Ir a Cargar Horas" que redirige a `#time-tracking`

## 👥 Usuarios que Reciben el Email

El sistema envía el email a **todos los usuarios** que:
- ✅ Tienen un email configurado en su perfil
- ✅ El email tiene un formato válido
- ✅ El email no está vacío

## 🔍 Verificar Usuarios

Para ver qué usuarios recibirán el email:

```sql
SELECT 
  id,
  full_name,
  email,
  role
FROM profiles
WHERE email IS NOT NULL 
  AND email != ''
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
ORDER BY full_name;
```

## 🐛 Solución de Problemas

### Los emails no se envían

1. **Verificar que pg_cron esté habilitado:**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Verificar la configuración de app_settings:**
   ```sql
   SELECT key, value FROM app_settings 
   WHERE key IN ('supabase_url', 'supabase_anon_key', 'frontend_url');
   ```

3. **Verificar que la Edge Function esté desplegada:**
   - Ve a Supabase Dashboard > Edge Functions
   - Verifica que `resend-email` esté desplegada
   - Verifica las variables de entorno

4. **Probar manualmente:**
   ```sql
   SELECT send_hours_reminder_emails();
   ```
   Revisa los logs en Supabase Dashboard > Edge Functions > resend-email > Logs

### El cron job no se ejecuta

1. **Verificar que el cron job esté activo:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'daily-hours-reminder';
   ```

2. **Verificar los logs de cron:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-hours-reminder')
   ORDER BY start_time DESC
   LIMIT 10;
   ```

3. **Nota:** `pg_cron` requiere el plan **Pro** de Supabase. Si estás en el plan gratuito, necesitarás usar una alternativa externa (como un servicio de cron en la nube que llame a una API).

## 📝 Notas Importantes

- ⚠️ **pg_cron requiere plan Pro:** Si estás en el plan gratuito de Supabase, `pg_cron` no estará disponible. En ese caso, necesitarás usar un servicio externo de cron (como Vercel Cron, GitHub Actions, o un servicio dedicado) que llame a una API endpoint que ejecute la función.

- ⏰ **Zona horaria:** El cron job usa la zona horaria del servidor de Supabase (generalmente UTC). Ajusta la hora en consecuencia (por ejemplo, si quieres 17:00 hora local de Argentina, que es UTC-3, deberías configurar `'0 20 * * *'` para las 17:00 hora local).

- 📧 **Límites de Resend:** Verifica los límites de tu plan de Resend para asegurarte de que puedes enviar emails a todos tus usuarios.



















