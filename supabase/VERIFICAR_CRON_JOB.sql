-- ============================================
-- VERIFICAR ESTADO DEL CRON JOB
-- ============================================
-- Ejecuta esto para ver el estado completo del cron job
-- ============================================

-- 1. Verificar si pg_cron está habilitado
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
    THEN '✅ pg_cron está habilitado'
    ELSE '❌ pg_cron NO está habilitado (requiere plan Pro)'
  END as estado_pg_cron;

-- 2. Verificar cron job programado
SELECT 
  jobid,
  schedule,
  command,
  jobname,
  active,
  nodename,
  database,
  username,
  CASE 
    WHEN active THEN '✅ Activo'
    ELSE '❌ Inactivo'
  END as estado
FROM cron.job
WHERE jobname = 'daily-hours-reminder';

-- 3. Verificar ejecuciones recientes (últimas 10)
SELECT 
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time,
  CASE 
    WHEN status = 'succeeded' THEN '✅ Éxito'
    WHEN status = 'failed' THEN '❌ Falló'
    WHEN status = 'running' THEN '🔄 En ejecución'
    ELSE status
  END as estado_ejecucion,
  CASE 
    WHEN end_time IS NOT NULL THEN end_time - start_time
    ELSE NULL
  END as duracion
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-hours-reminder')
ORDER BY start_time DESC
LIMIT 10;

-- 4. Verificar hora actual y próxima ejecución
SELECT 
  NOW() as hora_actual_utc,
  NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' as hora_actual_argentina,
  (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '20 hours')::timestamptz as proxima_ejecucion_utc,
  ((CURRENT_DATE + INTERVAL '1 day' + INTERVAL '20 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires')::timestamptz as proxima_ejecucion_argentina;

-- 5. Verificar si la función existe y puede ejecutarse
SELECT 
  proname as nombre_funcion,
  CASE 
    WHEN proname = 'send_hours_reminder_emails' THEN '✅ Función existe'
    ELSE '❌ Función no encontrada'
  END as estado
FROM pg_proc
WHERE proname = 'send_hours_reminder_emails';









