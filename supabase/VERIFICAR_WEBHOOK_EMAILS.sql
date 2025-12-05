-- ============================================
-- VERIFICAR CONFIGURACIÓN DE WEBHOOK PARA EMAILS
-- ============================================
-- Este script ayuda a verificar si el webhook está configurado
-- ============================================

-- 1. Verificar que el trigger existe
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ Habilitado'
    WHEN tgenabled = 'D' THEN '❌ Deshabilitado'
    ELSE '⚠️ Estado desconocido'
  END as estado
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
  metadata
FROM notifications
WHERE metadata->>'is_hours_reminder' = 'true'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar usuarios que deberían recibir emails
SELECT 
  p.id,
  p.full_name,
  p.email,
  COUNT(n.id) as notificaciones_recordatorio
FROM profiles p
LEFT JOIN notifications n ON n.user_id = p.id AND n.metadata->>'is_hours_reminder' = 'true'
WHERE p.email IS NOT NULL 
  AND p.email != ''
  AND p.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
GROUP BY p.id, p.full_name, p.email
ORDER BY p.full_name;

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- Si el webhook no está funcionando, verifica en Supabase Dashboard:
-- 1. Database > Webhooks
-- 2. Busca un webhook para la tabla "notifications"
-- 3. Verifica que esté configurado para evento "INSERT"
-- 4. Verifica que la URL apunte a: /functions/v1/resend-email
-- 5. Verifica que tenga el header Authorization con el anon_key
-- ============================================


