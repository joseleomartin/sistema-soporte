-- ============================================
-- AGREGAR TIPO 'social_post' A NOTIFICACIONES
-- ============================================
-- Permite notificar cuando alguien hace una publicación en social
-- ============================================

-- 1. Actualizar el CHECK constraint de notifications para incluir 'social_post'
-- ============================================
-- Primero, actualizar tipos antiguos que puedan existir en la base de datos
UPDATE notifications 
SET type = 'ticket_comment' 
WHERE type = 'new_comment';

-- Eliminar el constraint existente
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Crear el nuevo constraint con todos los tipos válidos
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
  'ticket_created',  -- Agregado en migración anterior (20251205000002)
  'social_post'  -- Nuevo tipo
));

-- 2. Agregar columna social_post_id si no existe (para referenciar el post)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'social_post_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN social_post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_social_post_id ON notifications(social_post_id);
  END IF;
END $$;

-- 3. Función para crear notificaciones cuando se publica en social
-- ============================================
CREATE OR REPLACE FUNCTION notify_social_post()
RETURNS TRIGGER AS $$
DECLARE
  post_author_name TEXT;
  all_users RECORD;
BEGIN
  -- Obtener nombre del autor del post
  SELECT full_name INTO post_author_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Crear notificación para todos los usuarios (excepto el autor)
  FOR all_users IN
    SELECT id
    FROM profiles
    WHERE id != NEW.user_id
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      social_post_id,
      metadata,
      read
    ) VALUES (
      all_users.id,
      'social_post',
      'Nueva publicación en Social',
      post_author_name || ' ha publicado en Social',
      NEW.id,
      jsonb_build_object(
        'post_author_id', NEW.user_id,
        'post_author_name', post_author_name,
        'post_content_preview', LEFT(COALESCE(NEW.content, ''), 100)
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger para crear notificaciones cuando se publica en social
-- ============================================
DROP TRIGGER IF EXISTS trigger_notify_social_post ON social_posts;
CREATE TRIGGER trigger_notify_social_post
  AFTER INSERT ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_social_post();

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Tipo 'social_post' agregado a notifications
-- ✅ Columna social_post_id agregada
-- ✅ Función notify_social_post creada
-- ✅ Trigger automático creado
-- ============================================

