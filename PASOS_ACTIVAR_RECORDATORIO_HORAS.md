# 📧 Pasos para Activar el Recordatorio Diario de Carga de Horas

## ⏰ Horario Configurado
- **Hora local (Argentina):** 17:00 (5:00 PM)
- **Hora UTC:** 20:00 (8:00 PM)
- **Frecuencia:** Todos los días

## 📋 Pasos a Seguir

### Paso 1: Ejecutar la Migración SQL

1. Ve a tu **Supabase Dashboard**
2. Abre el **SQL Editor**
3. Copia y pega el contenido completo del archivo:
   ```
   supabase/migrations/20251118000005_daily_hours_reminder.sql
   ```
4. Haz clic en **Run** o presiona `Ctrl+Enter`

✅ Esto creará la función y configurará el cron job automáticamente.

### Paso 2: Verificar Configuración (Importante)

Asegúrate de que tienes configurado en la tabla `app_settings`:

```sql
-- Verificar configuración actual
SELECT key, 
       CASE 
         WHEN key = 'supabase_anon_key' THEN LEFT(value, 20) || '...' 
         ELSE value 
       END as value_preview
FROM app_settings
WHERE key IN ('supabase_url', 'supabase_anon_key', 'frontend_url');
```

Si falta alguno, ejecuta:

**Para `supabase_anon_key`:**
```sql
-- Ejecutar: supabase/AGREGAR_ANON_KEY.sql
-- O ejecutar esto directamente:
INSERT INTO app_settings (key, value, description)
VALUES (
  'supabase_anon_key',
  'TU_ANON_KEY_AQUI',
  'Anon key de Supabase para autenticación con Edge Functions'
)
ON CONFLICT (key) DO UPDATE 
SET 
  value = EXCLUDED.value,
  updated_at = NOW();
```

**Para `supabase_url` y `frontend_url` (si no existen):**
```sql
INSERT INTO app_settings (key, value, description)
VALUES 
  ('supabase_url', 'https://yevbgutnuoivcuqnmrzi.supabase.co', 'URL base de Supabase para Edge Functions'),
  ('frontend_url', 'https://app.somosemagroup.com', 'URL del frontend de la aplicación')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### Paso 3: Verificar Edge Function `resend-email`

1. Ve a **Supabase Dashboard** > **Edge Functions**
2. Verifica que `resend-email` esté desplegada
3. Verifica las **Variables de Entorno**:
   - ✅ `RESEND_API_KEY` - Debe estar configurada
   - ✅ `FROM_EMAIL` - Opcional (por defecto: `notificaciones@app.somosemagroup.com`)
   - ✅ `FRONTEND_URL` - Opcional (por defecto: `https://app.somosemagroup.com`)

### Paso 4: Probar Manualmente (Opcional pero Recomendado)

Antes de esperar a las 17:00, prueba que todo funcione:

```sql
-- Ejecutar para enviar emails de prueba a todos los usuarios
SELECT send_hours_reminder_emails();
```

Luego revisa:
- Los **logs de la Edge Function** en Supabase Dashboard
- Tu **bandeja de entrada** (si eres usuario del sistema)

### Paso 5: Verificar el Cron Job

Para verificar que el cron job está programado correctamente:

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

Deberías ver:
- `schedule`: `0 20 * * *` (20:00 UTC = 17:00 hora Argentina)
- `active`: `true`
- `jobname`: `daily-hours-reminder`

## ✅ Verificación Final

Para ver qué usuarios recibirán el email:

```sql
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as usuarios_con_email
FROM profiles;
```

## 🐛 Si Algo No Funciona

### Error: "pg_cron extension not found"
- **Solución:** Necesitas el **plan Pro** de Supabase. `pg_cron` no está disponible en el plan gratuito.
- **Alternativa:** Usa un servicio externo de cron (Vercel Cron, GitHub Actions, etc.)

### Los emails no llegan
1. Verifica los logs de la Edge Function `resend-email`
2. Verifica que `RESEND_API_KEY` esté configurada correctamente
3. Verifica que los usuarios tengan emails válidos en sus perfiles

### El cron job no se ejecuta
1. Verifica que `pg_cron` esté habilitado: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
2. Verifica los logs del cron: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-hours-reminder') ORDER BY start_time DESC LIMIT 10;`

## 📧 Vista Previa del Email

El email que recibirán los usuarios se ve así:

```
┌─────────────────────────────────────────┐
│         EmaGroup (Header azul)          │
├─────────────────────────────────────────┤
│  EmaGroup Notificaciones:               │
│  Recordatorio de Carga de Horas        │
│                                         │
│  Este es un recordatorio diario para    │
│  que cargues las horas trabajadas del   │
│  día de hoy. No olvides registrar tu   │
│  tiempo en la plataforma EmaGroup.     │
│                                         │
│         [Ir a Cargar Horas]            │
│     (Botón azul con gradiente)         │
│                                         │
│  Haz clic en el botón para ir          │
│  directamente a la sección de carga     │
│  de horas.                              │
├─────────────────────────────────────────┤
│  Este es un email automático,          │
│  por favor no respondas.               │
└─────────────────────────────────────────┘
```

El botón "Ir a Cargar Horas" redirige a: `https://app.somosemagroup.com`

