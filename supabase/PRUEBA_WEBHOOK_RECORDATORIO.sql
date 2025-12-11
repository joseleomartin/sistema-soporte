-- ============================================
-- PRUEBA: Verificar si el webhook procesa recordatorios
-- ============================================
-- Este script crea una notificación de prueba para verificar
-- si el webhook la procesa correctamente
-- ============================================

-- 1. Crear una notificación de prueba de recordatorio
-- (Reemplaza el user_id con tu ID de usuario para recibir el email)
INSERT INTO notifications (
  user_id,
  type,
  title,
  message,
  metadata
)
VALUES (
  (SELECT id FROM profiles WHERE email IS NOT NULL LIMIT 1), -- Usar el primer usuario con email
  'calendar_event',
  'Recordatorio de Carga de Horas',
  'Este es un recordatorio diario para que cargues las horas trabajadas del día de hoy. No olvides registrar tu tiempo en la plataforma EmaGroup.',
  jsonb_build_object(
    'is_hours_reminder', true,
    'reminder_type', 'daily_hours'
  )
)
RETURNING id, user_id, type, title, created_at;

-- 2. Verificar que se creó
SELECT 
  id,
  user_id,
  type,
  title,
  created_at,
  metadata->>'is_hours_reminder' as is_hours_reminder
FROM notifications
WHERE id = (SELECT id FROM notifications 
            WHERE metadata->>'is_hours_reminder' = 'true' 
            ORDER BY created_at DESC LIMIT 1);

-- ============================================
-- DESPUÉS DE EJECUTAR ESTE SCRIPT:
-- ============================================
-- 1. Ve a Database > Webhooks > "Send notification emails" > Logs
-- 2. Busca una entrada reciente (debería aparecer inmediatamente)
-- 3. Si NO aparece, el webhook no está procesando estas notificaciones
-- 4. Si SÍ aparece, ve a Edge Functions > resend-email > Logs
-- 5. Busca errores en los logs de la Edge Function
-- ============================================








