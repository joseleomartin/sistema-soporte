-- ============================================
-- PRUEBA MANUAL DE ENVÍO DE EMAIL
-- ============================================
-- Este script prueba el envío de email manualmente
-- ============================================

-- 1. Verificar configuración antes de probar
-- ============================================
SELECT 'Configuración actual:' as info;
SELECT 
  (SELECT value FROM app_settings WHERE key = 'supabase_url' LIMIT 1) as supabase_url,
  CASE 
    WHEN EXISTS(SELECT 1 FROM app_settings WHERE key = 'supabase_anon_key' AND value != '') 
    THEN 'Configurado'
    ELSE 'NO CONFIGURADO'
  END as anon_key_status,
  EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') as pg_net_enabled;

-- 2. Verificar configuración completa antes de probar
-- ============================================
SELECT 'Verificación completa antes de probar:' as info;
SELECT 
  (SELECT value FROM app_settings WHERE key = 'supabase_url' LIMIT 1) as supabase_url,
  CASE 
    WHEN EXISTS(SELECT 1 FROM app_settings WHERE key = 'supabase_anon_key' AND value != '' AND value != 'TU_ANON_KEY_AQUI') 
    THEN '✅ Configurado'
    ELSE '❌ NO CONFIGURADO - Ejecuta AGREGAR_ANON_KEY.sql primero'
  END as anon_key_status,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
    THEN '✅ Habilitado'
    ELSE '❌ NO HABILITADO - Ejecuta: CREATE EXTENSION IF NOT EXISTS pg_net;'
  END as pg_net_status;

-- 3. Crear una notificación de prueba
-- ============================================
DO $$
DECLARE
  test_user_id UUID;
  test_user_email TEXT;
  test_user_name TEXT;
  notification_id UUID;
  supabase_url_val TEXT;
  anon_key_val TEXT;
BEGIN
  -- Verificar configuración
  SELECT value INTO supabase_url_val FROM app_settings WHERE key = 'supabase_url' LIMIT 1;
  SELECT value INTO anon_key_val FROM app_settings WHERE key = 'supabase_anon_key' LIMIT 1;
  
  IF supabase_url_val IS NULL OR supabase_url_val = '' THEN
    RAISE EXCEPTION '❌ supabase_url no está configurado. Ejecuta CONFIGURAR_EMAIL_NOTIFICACIONES.sql';
  END IF;
  
  IF anon_key_val IS NULL OR anon_key_val = '' OR anon_key_val = 'TU_ANON_KEY_AQUI' THEN
    RAISE EXCEPTION '❌ supabase_anon_key no está configurado. Ejecuta AGREGAR_ANON_KEY.sql';
  END IF;
  
  -- Obtener un usuario con email
  SELECT id, email, full_name INTO test_user_id, test_user_email, test_user_name
  FROM profiles
  WHERE email IS NOT NULL AND email != ''
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION '❌ No se encontró ningún usuario con email configurado';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📧 CREANDO NOTIFICACIÓN DE PRUEBA';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '👤 Usuario: % (%)', test_user_name, test_user_email;
  RAISE NOTICE '🔗 URL Edge Function: %/functions/v1/resend-email', supabase_url_val;
  RAISE NOTICE '🔑 Anon Key: %... (primeros 20 caracteres)', LEFT(anon_key_val, 20);
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
  -- Crear notificación de prueba
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    test_user_id,
    'ticket_comment',
    'Prueba de Email - ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
    'Este es un email de prueba manual. Si recibes este email, el sistema está funcionando correctamente.'
  )
  RETURNING id INTO notification_id;
  
  RAISE NOTICE '✅ Notificación creada con ID: %', notification_id;
  RAISE NOTICE '📧 El trigger debería haber intentado enviar el email a: %', test_user_email;
  RAISE NOTICE '';
  RAISE NOTICE '📋 PRÓXIMOS PASOS:';
  RAISE NOTICE '   1. Ve a Supabase Dashboard > Edge Functions > resend-email > Logs';
  RAISE NOTICE '   2. Busca una petición POST reciente';
  RAISE NOTICE '   3. Si no hay peticiones, el trigger no está llamando a la función';
  RAISE NOTICE '   4. Si hay peticiones pero hay errores, revisa los detalles';
  RAISE NOTICE '   5. También revisa Resend Dashboard > Emails > Logs';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
END $$;

-- 3. Verificar notificaciones recientes
-- ============================================
SELECT 'Notificaciones recientes:' as info;
SELECT 
  n.id,
  n.type,
  n.title,
  n.created_at,
  p.email as user_email,
  p.full_name as user_name
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type != 'direct_message'
ORDER BY n.created_at DESC
LIMIT 3;

-- ============================================
-- VERIFICACIONES ADICIONALES
-- ============================================

-- Verificar que el trigger está activo
SELECT 'Estado del trigger:' as info;
SELECT 
  tgname as trigger_name,
  CASE tgenabled 
    WHEN 'O' THEN '✅ Habilitado'
    WHEN 'D' THEN '❌ Deshabilitado'
    ELSE '❓ Desconocido'
  END as status
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';

