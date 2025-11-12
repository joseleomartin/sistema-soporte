-- ============================================
-- CORRECCIÓN v2: notify_ticket_comment()
-- ============================================
-- Corrige la referencia a NEW.user_id (columnas reales) para evitar errores 42703

CREATE OR REPLACE FUNCTION notify_ticket_comment()
RETURNS TRIGGER AS $$
DECLARE
  ticket_creator uuid;
  ticket_assigned_to uuid;
  ticket_title text;
  commenter_name text;
BEGIN
  -- Obtener datos básicos del ticket
  SELECT created_by, assigned_to, title
  INTO ticket_creator, ticket_assigned_to, ticket_title
  FROM tickets
  WHERE id = NEW.ticket_id;

  -- Obtener nombre del comentarista usando user_id
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Notificar al creador del ticket (si no es quien comentó)
  IF ticket_creator IS NOT NULL AND ticket_creator <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, ticket_id, metadata)
    VALUES (
      ticket_creator,
      'ticket_comment',
      'Nuevo comentario en tu ticket',
      commenter_name || ' ha respondido en "' || ticket_title || '"',
      NEW.ticket_id,
      jsonb_build_object(
        'commenter_id', NEW.user_id,
        'commenter_name', commenter_name,
        'comment_id', NEW.id
      )
    );
  END IF;

  -- Notificar al asignado (si existe y no es el creador ni el comentarista)
  IF ticket_assigned_to IS NOT NULL 
     AND ticket_assigned_to <> NEW.user_id
     AND ticket_assigned_to <> ticket_creator THEN
    INSERT INTO notifications (user_id, type, title, message, ticket_id, metadata)
    VALUES (
      ticket_assigned_to,
      'ticket_comment',
      'Nuevo comentario en ticket asignado',
      commenter_name || ' ha respondido en "' || ticket_title || '"',
      NEW.ticket_id,
      jsonb_build_object(
        'commenter_id', NEW.user_id,
        'commenter_name', commenter_name,
        'comment_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

