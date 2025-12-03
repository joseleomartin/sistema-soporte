-- ============================================
-- VERIFICAR pg_net Y FUNCIÓN DE RECORDATORIO
-- ============================================
-- Este script verifica si pg_net está habilitado y funcionando
-- ============================================

-- 1. Verificar si pg_net está habilitado
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ pg_net está habilitado'
    ELSE '❌ pg_net NO está habilitado - Ejecuta: CREATE EXTENSION IF NOT EXISTS pg_net;'
  END as estado_pg_net;

-- 2. Verificar configuración de app_settings
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

-- 3. Verificar que la función existe
SELECT 
  proname as nombre_funcion,
  CASE 
    WHEN proname = 'send_hours_reminder_emails' THEN '✅ Función existe'
    ELSE '❌ Función no encontrada'
  END as estado
FROM pg_proc
WHERE proname = 'send_hours_reminder_emails';

-- 4. Verificar usuarios que recibirían el email
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as usuarios_con_email,
  COUNT(CASE WHEN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN 1 END) as emails_validos
FROM profiles;

-- 5. Listar algunos usuarios que recibirían el email
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
LIMIT 5;

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- La función send_hours_reminder_emails() usa pg_net para llamar
-- directamente a la Edge Function resend-email.
-- 
-- Para verificar si funcionó:
-- 1. Ejecuta: SELECT send_hours_reminder_emails();
-- 2. Ve a Supabase Dashboard > Edge Functions > resend-email > Logs
-- 3. Busca entradas recientes con "📥 Payload recibido"
-- 4. Revisa tu bandeja de entrada
-- ============================================

