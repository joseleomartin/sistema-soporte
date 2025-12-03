-- ============================================
-- DIAGNÓSTICO: Sistema de Recordatorio de Horas
-- ============================================
-- Este script verifica el estado del sistema de recordatorios
-- ============================================

-- 1. Verificar que pg_cron esté habilitado
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✅ pg_cron está habilitado'
    ELSE '❌ pg_cron NO está habilitado (requiere plan Pro)'
  END as estado_pg_cron;

-- 2. Verificar que la función existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_hours_reminder_emails')
    THEN '✅ Función send_hours_reminder_emails() existe'
    ELSE '❌ Función send_hours_reminder_emails() NO existe'
  END as estado_funcion;

-- 3. Verificar cron job programado
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active,
  CASE 
    WHEN active THEN '✅ Activo'
    ELSE '❌ Inactivo'
  END as estado
FROM cron.job
WHERE jobname = 'daily-hours-reminder';

-- 4. Verificar ejecuciones recientes del cron job
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time,
  CASE 
    WHEN status = 'succeeded' THEN '✅ Éxito'
    WHEN status = 'failed' THEN '❌ Falló'
    WHEN status = 'running' THEN '🔄 En ejecución'
    ELSE status
  END as estado_ejecucion
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-hours-reminder')
ORDER BY start_time DESC
LIMIT 10;

-- 5. Verificar configuración de app_settings
SELECT 
  key,
  CASE 
    WHEN key = 'supabase_anon_key' THEN LEFT(value, 20) || '...' 
    ELSE value 
  END as value_preview,
  CASE 
    WHEN value IS NULL OR value = '' THEN '❌ No configurado'
    ELSE '✅ Configurado'
  END as estado
FROM app_settings
WHERE key IN ('supabase_url', 'supabase_anon_key', 'frontend_url')
ORDER BY key;

-- 6. Verificar usuarios que recibirían el email
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as usuarios_con_email,
  COUNT(CASE WHEN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN 1 END) as emails_validos
FROM profiles;

-- 7. Listar algunos usuarios que recibirían el email
SELECT 
  id,
  full_name,
  email,
  role
FROM profiles
WHERE email IS NOT NULL 
  AND email != ''
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
ORDER BY full_name
LIMIT 10;

-- 8. Verificar Edge Function resend-email
-- (Nota: Esto requiere verificación manual en Supabase Dashboard)

-- 9. Verificar zona horaria del servidor
SELECT 
  current_setting('timezone') as timezone_servidor,
  NOW() as hora_actual_servidor,
  NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' as hora_argentina;

-- 10. Calcular próxima ejecución esperada
SELECT 
  'Próxima ejecución esperada: ' || 
  (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '20 hours')::text as proxima_ejecucion_utc,
  'Hora Argentina equivalente: ' || 
  ((CURRENT_DATE + INTERVAL '1 day' + INTERVAL '20 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires')::text as proxima_ejecucion_argentina;

