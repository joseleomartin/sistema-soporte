-- ============================================
-- PRUEBA DEL WEBHOOK DE EMAILS
-- ============================================
-- Este script crea una notificación de prueba
-- que debería activar el webhook y enviar un email
-- ============================================

-- 1. Verificar que hay usuarios con email
-- ============================================
SELECT 'Usuarios disponibles para prueba:' as info;
SELECT id, email, full_name 
FROM profiles 
WHERE email IS NOT NULL AND email != ''
LIMIT 3;

-- 2. Crear notificación de prueba
-- ============================================
DO $$
DECLARE
  test_user_id UUID;
  test_user_email TEXT;
  test_user_name TEXT;
  notification_id UUID;
BEGIN
  -- Obtener un usuario con email
  SELECT id, email, full_name INTO test_user_id, test_user_email, test_user_name
  FROM profiles
  WHERE email IS NOT NULL AND email != ''
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION '❌ No se encontró ningún usuario con email configurado';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🧪 CREANDO NOTIFICACIÓN DE PRUEBA';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '👤 Usuario: % (%)', test_user_name, test_user_email;
  RAISE NOTICE '📧 Email destino: %', test_user_email;
  RAISE NOTICE '';
  
  -- Crear notificación (esto activará el webhook)
  INSERT INTO notifications (user_id, type, title, message)
  VALUES (
    test_user_id,
    'ticket_comment',
    'Prueba de Email Webhook - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
    'Esta es una notificación de prueba para verificar que el webhook funciona correctamente. Si recibes este email, el sistema está funcionando.'
  )
  RETURNING id INTO notification_id;
  
  RAISE NOTICE '✅ Notificación creada con ID: %', notification_id;
  RAISE NOTICE '';
  RAISE NOTICE '📋 PRÓXIMOS PASOS PARA VERIFICAR:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  REVISAR LOGS DEL WEBHOOK:';
  RAISE NOTICE '   - Ve a: Database > Webhooks > [Tu webhook] > Logs';
  RAISE NOTICE '   - Debe aparecer una petición reciente';
  RAISE NOTICE '   - Estado debe ser "Success" o mostrar el resultado';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  REVISAR LOGS DE LA EDGE FUNCTION:';
  RAISE NOTICE '   - Ve a: Edge Functions > resend-email > Logs';
  RAISE NOTICE '   - Debe aparecer una petición POST';
  RAISE NOTICE '   - Debe mostrar "✅ Email enviado exitosamente" si funciona';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  REVISAR LOGS DE RESEND:';
  RAISE NOTICE '   - Ve a: resend.com > Emails > Logs';
  RAISE NOTICE '   - Debe aparecer un email enviado a: %', test_user_email;
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  REVISAR TU BANDEJA DE ENTRADA:';
  RAISE NOTICE '   - Revisa la bandeja de entrada de: %', test_user_email;
  RAISE NOTICE '   - También revisa la carpeta de spam';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
END $$;

-- 3. Verificar notificaciones recientes
-- ============================================
SELECT 'Notificaciones recientes (últimas 3):' as info;
SELECT 
  n.id,
  n.type,
  n.title,
  n.created_at,
  p.email as destinatario,
  p.full_name as nombre_usuario
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type != 'direct_message'
ORDER BY n.created_at DESC
LIMIT 3;

-- ============================================
-- TROUBLESHOOTING
-- ============================================
-- Si no ves logs en el webhook:
-- 1. Verifica que el webhook esté activo
-- 2. Verifica que el filtro no esté bloqueando (type != 'direct_message')
-- 3. Verifica que la tabla sea 'notifications' y el evento sea 'INSERT'
-- 
-- Si ves logs en el webhook pero no en la Edge Function:
-- 1. Verifica la URL del webhook
-- 2. Verifica el header Authorization
-- 3. Verifica el formato del Request Body
-- 
-- Si ves logs en ambos pero no llega el email:
-- 1. Verifica los logs de Resend
-- 2. Verifica que FROM_EMAIL use el dominio verificado
-- 3. Verifica que RESEND_API_KEY esté configurado
-- ============================================










