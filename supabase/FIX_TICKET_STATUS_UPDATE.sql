-- ============================================
-- CORREGIR: Error en notify_ticket_status_change()
-- ============================================
-- El error "record 'new' has no field 'updated_by'" ocurre porque
-- la tabla tickets no tiene la columna updated_by.
-- Esta función corrige el problema usando auth.uid() para obtener
-- el usuario que hizo la actualización.
-- ============================================

CREATE OR REPLACE FUNCTION notify_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
  ticket_title text;
  status_text text;
  updater_id uuid;
BEGIN
  -- Solo notificar si el estado cambió
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Obtener el título del ticket
    SELECT title INTO ticket_title FROM tickets WHERE id = NEW.id;
    
    -- Obtener el ID del usuario que hizo la actualización
    -- Usar auth.uid() para obtener el usuario actual
    updater_id := auth.uid();
    
    -- Traducir el estado
    status_text := CASE NEW.status
      WHEN 'open' THEN 'abierto'
      WHEN 'in_progress' THEN 'en progreso'
      WHEN 'resolved' THEN 'resuelto'
      WHEN 'closed' THEN 'cerrado'
      ELSE NEW.status
    END;
    
    -- Notificar al creador del ticket
    INSERT INTO notifications (user_id, type, title, message, ticket_id, metadata)
    VALUES (
      NEW.created_by,
      'ticket_status',
      'Estado del ticket actualizado',
      'El ticket "' || ticket_title || '" ha cambiado a ' || status_text,
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'updated_by', updater_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar que el trigger existe
DROP TRIGGER IF EXISTS trigger_notify_ticket_status_change ON tickets;
CREATE TRIGGER trigger_notify_ticket_status_change
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_status_change();

-- ============================================
-- NOTA: Si prefieres no incluir updated_by en el metadata,
-- puedes usar esta versión simplificada:
-- ============================================
-- jsonb_build_object(
--   'old_status', OLD.status,
--   'new_status', NEW.status
-- )














