-- ============================================
-- NOTIFICACIONES PARA NOVEDADES PROFESIONALES
-- ============================================
-- Objetivo:
--  - Enviar una notificación a todos los usuarios cuando se crea un registro
--    en professional_news.
--  - Integrar el nuevo tipo 'professional_news' al CHECK de notifications.
-- ============================================

-- 1) Actualizar el CHECK constraint de notifications para incluir 'professional_news'
--    (y tipos recientes como 'time_entry_reminder' si no estaban)
-- ============================================

-- Eliminar el constraint existente si existe
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Crear el nuevo constraint con todos los tipos válidos conocidos
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
  'ticket_created',
  'social_post',
  'time_entry_reminder',
  'professional_news'
));

-- 2) Función para crear notificaciones cuando se publica en professional_news
-- ============================================

CREATE OR REPLACE FUNCTION notify_professional_news()
RETURNS TRIGGER AS $$
DECLARE
  creator_name TEXT;
  target_user RECORD;
BEGIN
  -- Obtener nombre del creador (si existe)
  IF NEW.created_by IS NOT NULL THEN
    SELECT full_name INTO creator_name
    FROM profiles
    WHERE id = NEW.created_by;
  END IF;

  -- Enviar notificación a todos los usuarios (opcionalmente excluyendo al creador)
  FOR target_user IN
    SELECT id
    FROM profiles
  LOOP
    -- Si hay creador, evitar notificarle a sí mismo
    IF NEW.created_by IS NOT NULL AND target_user.id = NEW.created_by THEN
      CONTINUE;
    END IF;

    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata,
      read
    )
    VALUES (
      target_user.id,
      'professional_news',
      'Nueva novedad profesional',
      COALESCE(creator_name, 'Un administrador') || ' publicó: ' || COALESCE(NEW.title, 'Nueva novedad profesional'),
      jsonb_build_object(
        'news_id', NEW.id,
        'url', NEW.url,
        'title', NEW.title
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Trigger para ejecutar la función después de insertar en professional_news
-- ============================================

DROP TRIGGER IF EXISTS trigger_notify_professional_news ON professional_news;
CREATE TRIGGER trigger_notify_professional_news
  AFTER INSERT ON professional_news
  FOR EACH ROW
  EXECUTE FUNCTION notify_professional_news();

-- ============================================
-- FIN DEL SCRIPT
-- ============================================


