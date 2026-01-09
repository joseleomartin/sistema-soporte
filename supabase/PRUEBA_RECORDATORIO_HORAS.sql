-- ============================================
-- PRUEBA MANUAL: Recordatorio de Carga de Horas
-- ============================================
-- Este script permite probar manualmente el envío de recordatorios
-- sin esperar a que se ejecute el cron job
-- ============================================

-- Verificar que la función existe
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'send_hours_reminder_emails';

-- Verificar configuración de app_settings
SELECT key, 
       CASE 
         WHEN key = 'supabase_anon_key' THEN LEFT(value, 20) || '...' 
         ELSE value 
       END as value_preview,
       description
FROM app_settings
WHERE key IN ('supabase_url', 'supabase_anon_key', 'frontend_url')
ORDER BY key;

-- Verificar usuarios que recibirán el email
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as usuarios_con_email,
  COUNT(CASE WHEN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN 1 END) as emails_validos
FROM profiles;

-- Listar usuarios que recibirán el email
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

-- EJECUTAR ESTA LÍNEA PARA ENVIAR LOS EMAILS DE PRUEBA:
-- SELECT send_hours_reminder_emails();

-- Verificar cron jobs programados
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
WHERE jobname = 'daily-hours-reminder';



















