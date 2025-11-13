-- ============================================
-- SISTEMA DE NOTIFICACIONES
-- ============================================
-- Notificaciones para eventos de calendario y respuestas en tickets

-- 1. Crear tabla de notificaciones
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('calendar_event', 'ticket_comment', 'ticket_status')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  
  -- Referencias opcionales según el tipo
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  event_id uuid REFERENCES calendar_events(id) ON DELETE CASCADE,
  
  -- Metadatos adicionales
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- 2. FUNCIÓN: Crear notificación para comentario en ticket
-- ============================================
CREATE OR REPLACE FUNCTION notify_ticket_comment()
RETURNS TRIGGER AS $$
DECLARE
  ticket_creator uuid;
  ticket_title text;
  commenter_name text;
BEGIN
  -- Obtener el creador del ticket y el título
  SELECT created_by, title INTO ticket_creator, ticket_title
  FROM tickets
  WHERE id = NEW.ticket_id;
  
  -- Obtener el nombre del comentador
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Crear notificación para el creador del ticket (si no es el mismo que comentó)
  IF ticket_creator != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, ticket_id, metadata)
    VALUES (
      ticket_creator,
      'ticket_comment',
      'Nuevo comentario en tu ticket',
      commenter_name || ' ha comentado en "' || ticket_title || '"',
      NEW.ticket_id,
      jsonb_build_object('commenter_id', NEW.user_id, 'commenter_name', commenter_name)
    );
  END IF;
  
  -- Si el ticket está asignado a alguien, notificar también
  IF EXISTS (
    SELECT 1 FROM tickets 
    WHERE id = NEW.ticket_id 
    AND assigned_to IS NOT NULL 
    AND assigned_to != NEW.user_id 
    AND assigned_to != ticket_creator
  ) THEN
    INSERT INTO notifications (user_id, type, title, message, ticket_id, metadata)
    SELECT 
      assigned_to,
      'ticket_comment',
      'Nuevo comentario en ticket asignado',
      commenter_name || ' ha comentado en "' || ticket_title || '"',
      NEW.ticket_id,
      jsonb_build_object('commenter_id', NEW.user_id, 'commenter_name', commenter_name)
    FROM tickets
    WHERE id = NEW.ticket_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para comentarios en tickets
DROP TRIGGER IF EXISTS trigger_notify_ticket_comment ON ticket_comments;
CREATE TRIGGER trigger_notify_ticket_comment
  AFTER INSERT ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_comment();

-- ============================================
-- 3. FUNCIÓN: Crear notificación para cambio de estado de ticket
-- ============================================
CREATE OR REPLACE FUNCTION notify_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
  ticket_title text;
  status_text text;
BEGIN
  -- Solo notificar si el estado cambió
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Obtener el título del ticket
    SELECT title INTO ticket_title FROM tickets WHERE id = NEW.id;
    
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
      'Estado de ticket actualizado',
      'Tu ticket "' || ticket_title || '" ahora está ' || status_text,
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para cambios de estado en tickets
DROP TRIGGER IF EXISTS trigger_notify_ticket_status_change ON tickets;
CREATE TRIGGER trigger_notify_ticket_status_change
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_status_change();

-- ============================================
-- 4. FUNCIÓN: Crear notificación para evento de calendario
-- ============================================
CREATE OR REPLACE FUNCTION notify_calendar_event()
RETURNS TRIGGER AS $$
DECLARE
  creator_name text;
BEGIN
  -- Solo notificar si es un evento asignado (no personal)
  IF NEW.user_id != NEW.created_by THEN
    -- Obtener el nombre del creador
    SELECT full_name INTO creator_name
    FROM profiles
    WHERE id = NEW.created_by;
    
    -- Crear notificación para el usuario asignado
    INSERT INTO notifications (user_id, type, title, message, event_id, metadata)
    VALUES (
      NEW.user_id,
      'calendar_event',
      'Nuevo evento asignado',
      creator_name || ' te ha asignado el evento "' || NEW.title || '"',
      NEW.id,
      jsonb_build_object(
        'event_date', NEW.date,
        'event_time', NEW.time,
        'creator_id', NEW.created_by,
        'creator_name', creator_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para nuevos eventos de calendario
DROP TRIGGER IF EXISTS trigger_notify_calendar_event ON calendar_events;
CREATE TRIGGER trigger_notify_calendar_event
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_calendar_event();

-- ============================================
-- 5. FUNCIÓN: Limpiar notificaciones antiguas (opcional)
-- ============================================
-- Esta función puede ejecutarse periódicamente para limpiar notificaciones leídas antiguas
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE read = true
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario: Para ejecutar la limpieza automáticamente, puedes usar pg_cron o llamarla manualmente
-- SELECT cleanup_old_notifications();





