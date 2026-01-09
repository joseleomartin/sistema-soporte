-- ============================================
-- VERIFICACIÓN PROFUNDA DEL TRIGGER DE EMAILS
-- ============================================
-- Este script verifica si el trigger se está ejecutando
-- ============================================

-- 1. Verificar que el trigger existe y está activo
-- ============================================
SELECT '1. Estado del trigger:' as verificacion;
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as tabla,
  CASE tgenabled 
    WHEN 'O' THEN '✅ Habilitado'
    WHEN 'D' THEN '❌ Deshabilitado'
    ELSE '❓ Desconocido'
  END as estado,
  tgtype::text as tipo
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';

-- 2. Verificar que la función existe
-- ============================================
SELECT '2. Función send_notification_email:' as verificacion;
SELECT 
  proname as nombre_funcion,
  CASE 
    WHEN prosrc IS NOT NULL THEN '✅ Existe'
    ELSE '❌ No existe'
  END as estado
FROM pg_proc 
WHERE proname = 'send_notification_email';

-- 3. Verificar configuración de app_settings
-- ============================================
SELECT '3. Configuración app_settings:' as verificacion;
SELECT 
  key,
  CASE 
    WHEN value IS NOT NULL AND value != '' THEN '✅ Configurado'
    ELSE '❌ NO CONFIGURADO'
  END as estado,
  LENGTH(value) as longitud_valor,
  LEFT(value, 30) || '...' as preview
FROM app_settings
WHERE key IN ('supabase_url', 'supabase_anon_key')
ORDER BY key;

-- 4. Verificar pg_net
-- ============================================
SELECT '4. Extensión pg_net:' as verificacion;
SELECT 
  extname as extension,
  extversion as version,
  CASE 
    WHEN extname = 'pg_net' THEN '✅ Habilitada'
    ELSE '❌ NO HABILITADA'
  END as estado
FROM pg_extension 
WHERE extname = 'pg_net';

-- 5. Probar crear una notificación y ver si se ejecuta el trigger
-- ============================================
DO $$
DECLARE
  test_user_id UUID;
  test_user_email TEXT;
  notification_id UUID;
  edge_function_url TEXT;
  supabase_url_val TEXT;
BEGIN
  -- Obtener configuración
  SELECT value INTO supabase_url_val FROM app_settings WHERE key = 'supabase_url' LIMIT 1;
  IF supabase_url_val IS NULL THEN
    supabase_url_val := 'https://yevbgutnuoivcuqnmrzi.supabase.co';
  END IF;
  edge_function_url := supabase_url_val || '/functions/v1/resend-email';
  
  -- Obtener usuario de prueba
  SELECT id, email INTO test_user_id, test_user_email
  FROM profiles
  WHERE email IS NOT NULL AND email != ''
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION '❌ No se encontró ningún usuario con email';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🧪 PRUEBA DE TRIGGER';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '👤 Usuario: %', test_user_email;
  RAISE NOTICE '🔗 URL Edge Function: %', edge_function_url;
  RAISE NOTICE '📧 Creando notificación...';
  
  -- Crear notificación (esto debería activar el trigger)
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    test_user_id,
    'ticket_comment',
    'Prueba Trigger - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
    'Esta notificación debería activar el trigger y llamar a la Edge Function'
  )
  RETURNING id INTO notification_id;
  
  RAISE NOTICE '✅ Notificación creada: %', notification_id;
  RAISE NOTICE '';
  RAISE NOTICE '📋 VERIFICACIONES:';
  RAISE NOTICE '   1. Ve a Edge Functions > resend-email > Logs';
  RAISE NOTICE '   2. Debe aparecer una petición POST en los últimos segundos';
  RAISE NOTICE '   3. Si NO aparece, el trigger no está llamando a la función';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Si no hay logs, verifica:';
  RAISE NOTICE '   - Que pg_net esté habilitado';
  RAISE NOTICE '   - Que la URL sea correcta';
  RAISE NOTICE '   - Que el anon_key esté configurado';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
END $$;

-- 6. Verificar notificaciones recientes
-- ============================================
SELECT '6. Notificaciones recientes (últimas 3):' as verificacion;
SELECT 
  n.id,
  n.type,
  n.title,
  n.created_at,
  p.email as destinatario
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type != 'direct_message'
ORDER BY n.created_at DESC
LIMIT 3;

-- 7. Verificar si hay errores en la función (requiere habilitar logging)
-- ============================================
-- Nota: Los RAISE NOTICE solo se ven si el logging está habilitado
SELECT '7. Información adicional:' as verificacion;
SELECT 
  'Para ver los RAISE NOTICE del trigger, habilita el logging en Supabase' as nota,
  'O revisa los logs de la base de datos si están disponibles' as nota2;



















