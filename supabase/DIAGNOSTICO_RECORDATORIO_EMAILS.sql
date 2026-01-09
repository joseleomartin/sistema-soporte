-- ============================================
-- DIAGNÓSTICO: Emails de Recordatorio de Horas
-- ============================================
-- Verifica por qué no se envían emails para recordatorios
-- ============================================

-- 1. Verificar notificaciones de recordatorio creadas
SELECT 
  id,
  user_id,
  type,
  title,
  message,
  created_at,
  metadata->>'is_hours_reminder' as is_hours_reminder,
  metadata
FROM notifications
WHERE metadata->>'is_hours_reminder' = 'true'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Comparar con notificaciones que SÍ envían emails
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

-- 3. Verificar si hay diferencias en el formato
SELECT 
  'Recordatorio' as tipo,
  type,
  COUNT(*) as cantidad,
  MIN(created_at) as primera,
  MAX(created_at) as ultima
FROM notifications
WHERE metadata->>'is_hours_reminder' = 'true'
GROUP BY type
UNION ALL
SELECT 
  'Otras' as tipo,
  type,
  COUNT(*) as cantidad,
  MIN(created_at) as primera,
  MAX(created_at) as ultima
FROM notifications
WHERE type != 'direct_message'
  AND (metadata->>'is_hours_reminder' IS NULL OR metadata->>'is_hours_reminder' != 'true')
GROUP BY type;

-- ============================================
-- PASOS PARA DIAGNOSTICAR:
-- ============================================
-- 1. Ejecuta: SELECT send_hours_reminder_emails();
-- 2. Ve a Database > Webhooks > "Send notification emails" > Logs
-- 3. Busca entradas recientes después de ejecutar la función
-- 4. Si NO hay logs del webhook para estas notificaciones:
--    - El webhook puede tener un filtro que las excluye
--    - Verifica el filtro del webhook (debe ser: type != 'direct_message')
-- 5. Si SÍ hay logs del webhook pero no llegan emails:
--    - Ve a Edge Functions > resend-email > Logs
--    - Busca errores en los logs
-- ============================================



















