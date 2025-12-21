-- ============================================
-- SOLUCIÓN: Email para Recordatorio de Horas
-- ============================================
-- El trigger usa pg_net que no funciona.
-- Esta solución deshabilita el trigger problemático
-- y confía en el Database Webhook para enviar emails
-- ============================================

-- Opción 1: Deshabilitar el trigger que usa pg_net
-- (Si tienes Database Webhook configurado, esto es lo recomendado)
ALTER TABLE notifications DISABLE TRIGGER trigger_send_notification_email;

-- Verificar que el trigger está deshabilitado
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ Habilitado'
    WHEN tgenabled = 'D' THEN '❌ Deshabilitado (correcto si usas webhook)'
    ELSE '⚠️ Estado desconocido'
  END as estado
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';

-- ============================================
-- IMPORTANTE: Verificar Database Webhook
-- ============================================
-- 1. Ve a Supabase Dashboard > Database > Webhooks
-- 2. Verifica que haya un webhook para la tabla "notifications"
-- 3. Verifica que esté ACTIVO
-- 4. Verifica que el evento sea "INSERT"
-- 5. Verifica que el filtro sea: type != 'direct_message'
-- 6. Verifica que la URL sea: /functions/v1/resend-email
-- 7. Verifica los logs del webhook para ver si está procesando
-- ============================================

-- Si NO tienes Database Webhook configurado, ejecuta esto para reactivar el trigger:
-- ALTER TABLE notifications ENABLE TRIGGER trigger_send_notification_email;













