-- ============================================
-- CORRECCIÓN: notify_calendar_event()
-- ============================================
-- Ajusta la función para usar las columnas reales de calendar_events
-- (assigned_to, start_date, end_date, all_day) y evitar columnas inexistentes.

CREATE OR REPLACE FUNCTION notify_calendar_event()
RETURNS TRIGGER AS $$
DECLARE
  creator_name text;
BEGIN
  -- Si no hay usuario asignado, no crear notificación
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- Evitar notificar al creador si se lo asignó a sí mismo
  IF NEW.assigned_to = NEW.created_by THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre del creador
  SELECT full_name INTO creator_name
  FROM profiles
  WHERE id = NEW.created_by;

  -- Crear notificación para el usuario asignado
  INSERT INTO notifications (user_id, type, title, message, event_id, metadata)
  VALUES (
    NEW.assigned_to,
    'calendar_event',
    'Nuevo evento asignado',
    COALESCE(creator_name, 'Un administrador') || ' te ha asignado el evento "' || NEW.title || '"',
    NEW.id,
    jsonb_build_object(
      'start_date', NEW.start_date,
      'end_date', NEW.end_date,
      'all_day', NEW.all_day,
      'color', NEW.color,
      'event_type', NEW.event_type,
      'creator_id', NEW.created_by,
      'creator_name', creator_name
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

