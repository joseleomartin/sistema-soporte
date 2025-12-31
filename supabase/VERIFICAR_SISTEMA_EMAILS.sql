-- ============================================
-- VERIFICAR SISTEMA DE EMAILS
-- ============================================
-- Este script verifica cómo se están enviando los emails
-- ============================================

-- 1. Verificar si el trigger está activo
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ Habilitado (usa pg_net)'
    WHEN tgenabled = 'D' THEN '❌ Deshabilitado'
    ELSE '⚠️ Estado desconocido'
  END as estado_trigger
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';

-- 2. Verificar notificaciones recientes de recordatorio
SELECT 
  id,
  user_id,
  type,
  title,
  message,
  created_at,
  metadata->>'is_hours_reminder' as is_hours_reminder
FROM notifications
WHERE metadata->>'is_hours_reminder' = 'true'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar notificaciones recientes de otros tipos (para comparar)
SELECT 
  id,
  user_id,
  type,
  title,
  created_at
FROM notifications
WHERE type != 'direct_message'
  AND metadata->>'is_hours_reminder' IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- 4. Verificar si pg_net está habilitado
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') 
    THEN '✅ pg_net está habilitado'
    ELSE '❌ pg_net NO está habilitado'
  END as estado_pg_net;

-- ============================================
-- IMPORTANTE:
-- ============================================
-- Si el trigger está habilitado pero pg_net no funciona,
-- el trigger fallará silenciosamente.
--
-- Si usas Database Webhooks, verifica en Supabase Dashboard:
-- 1. Database > Webhooks
-- 2. Busca un webhook para la tabla "notifications"
-- 3. Verifica que esté ACTIVO
-- 4. Verifica que el evento sea "INSERT"
-- 5. Verifica que el filtro sea: type != 'direct_message'
-- 6. Verifica los logs del webhook para ver si está procesando
-- ============================================














