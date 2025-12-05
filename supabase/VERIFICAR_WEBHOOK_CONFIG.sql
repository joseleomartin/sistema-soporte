-- ============================================
-- VERIFICAR CONFIGURACIÓN DEL WEBHOOK
-- ============================================
-- Este script ayuda a diagnosticar por qué no se envían emails
-- ============================================

-- 1. Verificar notificaciones recientes de recordatorio
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

-- 2. Verificar notificaciones recientes de otros tipos (para comparar)
SELECT 
  id,
  user_id,
  type,
  title,
  created_at
FROM notifications
WHERE type != 'direct_message'
  AND (metadata->>'is_hours_reminder' IS NULL OR metadata->>'is_hours_reminder' != 'true')
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar usuarios que deberían recibir emails
SELECT 
  p.id,
  p.full_name,
  p.email,
  COUNT(n.id) as notificaciones_recordatorio
FROM profiles p
LEFT JOIN notifications n ON n.user_id = p.id 
  AND n.metadata->>'is_hours_reminder' = 'true'
WHERE p.email IS NOT NULL 
  AND p.email != ''
  AND p.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
GROUP BY p.id, p.full_name, p.email
ORDER BY p.full_name;

-- ============================================
-- PASOS PARA VERIFICAR EL WEBHOOK:
-- ============================================
-- 1. Ve a Supabase Dashboard > Database > Webhooks
-- 2. Busca un webhook para la tabla "notifications"
-- 3. Verifica que esté ACTIVO (toggle verde)
-- 4. Verifica que el evento sea "INSERT"
-- 5. Verifica el filtro (debe ser: type != 'direct_message')
-- 6. Verifica la URL: /functions/v1/resend-email
-- 7. Haz clic en el webhook y ve a la pestaña "Logs"
-- 8. Busca entradas recientes después de ejecutar send_hours_reminder_emails()
-- 9. Si hay logs, verifica si hay errores
-- 10. Si no hay logs, el webhook puede no estar procesando estas notificaciones
-- ============================================


