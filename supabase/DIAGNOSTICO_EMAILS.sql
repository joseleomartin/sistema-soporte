-- ============================================
-- SCRIPT DE DIAGNÓSTICO PARA EMAILS DE NOTIFICACIONES
-- ============================================
-- Ejecuta este script para verificar la configuración
-- ============================================

-- 1. Verificar que la tabla app_settings existe y tiene valores
-- ============================================
SELECT '1. Tabla app_settings' as check_item;
SELECT key, value, description, updated_at 
FROM app_settings 
WHERE key IN ('supabase_url', 'supabase_anon_key')
ORDER BY key;

-- 2. Verificar que pg_net está habilitado
-- ============================================
SELECT '2. Extensión pg_net' as check_item;
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'pg_net';

-- 3. Verificar que el trigger existe y está activo
-- ============================================
SELECT '3. Trigger de notificaciones' as check_item;
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE tgenabled 
    WHEN 'O' THEN 'Enabled'
    WHEN 'D' THEN 'Disabled'
    ELSE 'Unknown'
  END as status
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';

-- 4. Verificar que la función existe
-- ============================================
SELECT '4. Función send_notification_email' as check_item;
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'send_notification_email';

-- 5. Verificar usuarios con email
-- ============================================
SELECT '5. Usuarios con email configurado' as check_item;
SELECT id, email, full_name 
FROM profiles 
WHERE email IS NOT NULL AND email != ''
LIMIT 5;

-- 6. Verificar notificaciones recientes
-- ============================================
SELECT '6. Notificaciones recientes (últimas 5)' as check_item;
SELECT 
  n.id,
  n.type,
  n.title,
  n.message,
  n.created_at,
  p.email as user_email,
  p.full_name as user_name
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type != 'direct_message'
ORDER BY n.created_at DESC
LIMIT 5;

-- 7. Probar crear una notificación de prueba
-- ============================================
-- Descomenta las siguientes líneas para crear una notificación de prueba
-- Reemplaza 'USER_ID_AQUI' con un ID real de usuario
/*
SELECT '7. Crear notificación de prueba' as check_item;
INSERT INTO notifications (user_id, type, title, message)
SELECT 
  id,
  'ticket_comment',
  'Prueba de Email - ' || NOW()::text,
  'Este es un email de prueba para verificar que el sistema funciona correctamente.'
FROM profiles
WHERE email IS NOT NULL AND email != ''
LIMIT 1
RETURNING id, user_id, type, title, created_at;
*/

-- ============================================
-- VERIFICACIONES ADICIONALES
-- ============================================

-- Verificar si hay errores en los logs (requiere acceso a logs)
-- SELECT * FROM pg_stat_statements WHERE query LIKE '%send_notification_email%';

-- Verificar la URL que se está usando
SELECT 'URL configurada:' as info, 
  COALESCE(
    (SELECT value FROM app_settings WHERE key = 'supabase_url'),
    'https://yevbgutnuoivcuqnmrzi.supabase.co (por defecto)'
  ) as supabase_url;

-- Verificar si hay anon_key configurado
SELECT 'Anon key configurado:' as info,
  CASE 
    WHEN EXISTS(SELECT 1 FROM app_settings WHERE key = 'supabase_anon_key' AND value != '') 
    THEN 'Sí'
    ELSE 'No'
  END as anon_key_status;















