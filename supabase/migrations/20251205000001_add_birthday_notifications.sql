-- ==================================================================
-- MIGRACIÓN: Notificaciones de Cumpleaños
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Crea notificaciones para todos los usuarios cuando alguien cumple años
-- ==================================================================

-- 1. Actualizar el CHECK constraint de notifications para incluir 'birthday'
-- ==================================================================
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'calendar_event', 
  'ticket_comment', 
  'ticket_status',
  'task_assigned',
  'task_mention',
  'forum_mention',
  'direct_message',
  'birthday'  -- Nuevo tipo
));

-- 2. Función para crear notificaciones de cumpleaños
-- ==================================================================
CREATE OR REPLACE FUNCTION create_birthday_notifications()
RETURNS void AS $$
DECLARE
  birthday_user RECORD;
  all_users RECORD;
  today_month INT;
  today_day INT;
BEGIN
  -- Obtener mes y día actual
  today_month := EXTRACT(MONTH FROM CURRENT_DATE);
  today_day := EXTRACT(DAY FROM CURRENT_DATE);
  
  -- Buscar usuarios que cumplen años hoy
  FOR birthday_user IN
    SELECT 
      id,
      full_name,
      birthday
    FROM profiles
    WHERE birthday IS NOT NULL
      AND EXTRACT(MONTH FROM birthday) = today_month
      AND EXTRACT(DAY FROM birthday) = today_day
  LOOP
    -- Crear notificación para todos los usuarios (excepto el que cumple años)
    FOR all_users IN
      SELECT id
      FROM profiles
      WHERE id != birthday_user.id
    LOOP
      -- Verificar que no exista ya una notificación de cumpleaños para este usuario hoy
      IF NOT EXISTS (
        SELECT 1
        FROM notifications
        WHERE user_id = all_users.id
          AND type = 'birthday'
          AND metadata->>'birthday_user_id' = birthday_user.id::text
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          metadata,
          read
        ) VALUES (
          all_users.id,
          'birthday',
          '¡Es el cumpleaños de ' || birthday_user.full_name || '! 🎉',
          'Hoy es el cumpleaños de ' || birthday_user.full_name || '. ¡Déjale un mensaje en la sección Social!',
          jsonb_build_object(
            'birthday_user_id', birthday_user.id,
            'birthday_user_name', birthday_user.full_name,
            'birthday_date', birthday_user.birthday
          ),
          false
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Comentario de la función
-- ==================================================================
COMMENT ON FUNCTION create_birthday_notifications() IS 
'Crea notificaciones de cumpleaños para todos los usuarios cuando alguien cumple años. Debe ejecutarse diariamente.';

-- 4. Función para ejecutar automáticamente (usando pg_cron si está disponible)
-- ==================================================================
-- Nota: Para ejecutar automáticamente, necesitas tener pg_cron instalado
-- Ejecuta esto en la consola SQL de Supabase:
-- SELECT cron.schedule('daily-birthday-notifications', '0 8 * * *', 'SELECT create_birthday_notifications();');
--
-- Esto ejecutará la función todos los días a las 8:00 AM UTC

-- 5. Ejecutar manualmente para probar (opcional)
-- ==================================================================
-- SELECT create_birthday_notifications();














