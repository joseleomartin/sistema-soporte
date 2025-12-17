-- ==================================================================
-- MIGRACIÓN: Notificaciones de Nuevos Tickets para Área Soporte
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Notifica a todos los usuarios del área Soporte cuando se crea un nuevo ticket
-- ==================================================================

-- 1. Actualizar el CHECK constraint de notifications para incluir 'ticket_created'
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
  'birthday',
  'ticket_created'  -- Nuevo tipo
));

-- 2. Función para notificar a usuarios del área Soporte cuando se crea un ticket
-- ==================================================================
CREATE OR REPLACE FUNCTION notify_support_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
  ticket_creator_name text;
  support_department_id uuid;
  support_user RECORD;
BEGIN
  -- Obtener el nombre del creador del ticket
  SELECT full_name INTO ticket_creator_name
  FROM profiles
  WHERE id = NEW.created_by;
  
  -- Obtener el ID del departamento "Soporte"
  SELECT id INTO support_department_id
  FROM departments
  WHERE name = 'Soporte'
  LIMIT 1;
  
  -- Si no existe el departamento Soporte, salir sin error
  IF support_department_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Crear notificación para cada usuario del área Soporte
  FOR support_user IN
    SELECT DISTINCT ud.user_id
    FROM user_departments ud
    WHERE ud.department_id = support_department_id
      AND ud.user_id != NEW.created_by  -- No notificar al creador del ticket
  LOOP
    -- Verificar que el usuario existe y está activo
    IF EXISTS (SELECT 1 FROM profiles WHERE id = support_user.user_id) THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        ticket_id,
        metadata,
        read
      ) VALUES (
        support_user.user_id,
        'ticket_created',
        'Nuevo ticket de soporte',
        COALESCE(ticket_creator_name, 'Un usuario') || ' ha creado el ticket "' || NEW.title || '"',
        NEW.id,
        jsonb_build_object(
          'ticket_id', NEW.id,
          'ticket_title', NEW.title,
          'ticket_category', NEW.category,
          'ticket_priority', NEW.priority,
          'creator_id', NEW.created_by,
          'creator_name', ticket_creator_name
        ),
        false
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear trigger para ejecutar la función cuando se crea un ticket
-- ==================================================================
DROP TRIGGER IF EXISTS trigger_notify_support_on_new_ticket ON tickets;
CREATE TRIGGER trigger_notify_support_on_new_ticket
  AFTER INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_support_on_new_ticket();

-- 4. Comentarios para documentación
-- ==================================================================
COMMENT ON FUNCTION notify_support_on_new_ticket() IS 
'Notifica a todos los usuarios del área Soporte cuando se crea un nuevo ticket. No notifica al creador del ticket.';

COMMENT ON TRIGGER trigger_notify_support_on_new_ticket ON tickets IS 
'Trigger que ejecuta notify_support_on_new_ticket() después de insertar un ticket.';

-- 5. Verificación (opcional - descomentar para probar)
-- ==================================================================
-- Verificar que el departamento Soporte existe:
-- SELECT id, name FROM departments WHERE name = 'Soporte';
--
-- Verificar usuarios del área Soporte:
-- SELECT p.id, p.full_name, p.email
-- FROM profiles p
-- JOIN user_departments ud ON ud.user_id = p.id
-- JOIN departments d ON d.id = ud.department_id
-- WHERE d.name = 'Soporte';









