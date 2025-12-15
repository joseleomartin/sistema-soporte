-- ==================================================================
-- SCRIPT DE PRUEBA: Notificaciones de Cumpleaños
-- ==================================================================
-- Este script te permite probar las notificaciones de cumpleaños
-- ==================================================================

-- 1. Ver usuarios que cumplen años HOY
-- ==================================================================
SELECT 
  id,
  full_name,
  birthday,
  EXTRACT(MONTH FROM birthday) as mes,
  EXTRACT(DAY FROM birthday) as dia,
  EXTRACT(MONTH FROM CURRENT_DATE) as mes_hoy,
  EXTRACT(DAY FROM CURRENT_DATE) as dia_hoy
FROM profiles
WHERE birthday IS NOT NULL
  AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE);

-- 2. Ejecutar la función para crear notificaciones
-- ==================================================================
SELECT create_birthday_notifications();

-- 3. Verificar que se crearon las notificaciones
-- ==================================================================
SELECT 
  n.id,
  n.type,
  n.title,
  n.message,
  n.read,
  n.created_at,
  p.full_name as usuario_notificado,
  n.metadata->>'birthday_user_name' as cumpleanero,
  n.metadata->>'birthday_user_id' as cumpleanero_id
FROM notifications n
JOIN profiles p ON p.id = n.user_id
WHERE n.type = 'birthday'
  AND DATE(n.created_at) = CURRENT_DATE
ORDER BY n.created_at DESC
LIMIT 50;

-- 4. Limpiar notificaciones de prueba (opcional)
-- ==================================================================
-- Descomenta la siguiente línea si quieres eliminar las notificaciones de prueba:
-- DELETE FROM notifications WHERE type = 'birthday' AND DATE(created_at) = CURRENT_DATE;








