-- ============================================
-- NOTIFICACIONES PARA MENSAJES DIRECTOS
-- ============================================
-- Agregar soporte para notificaciones cuando se recibe un mensaje directo

-- 1. Agregar tipo 'direct_message' al CHECK constraint de notifications
-- ============================================
DO $$
BEGIN
  -- Verificar si el constraint existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_type_check'
  ) THEN
    -- Eliminar constraint existente
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
  
  -- Crear nuevo constraint con 'direct_message'
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('calendar_event', 'ticket_comment', 'ticket_status', 'task_assigned', 'forum_mention', 'direct_message'));
END $$;

-- 2. Agregar columna direct_message_id (opcional, para referencia)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'direct_message_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN direct_message_id UUID REFERENCES direct_messages(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_direct_message_id ON notifications(direct_message_id);
  END IF;
END $$;

-- 3. FUNCIÓN: Crear notificación para mensaje directo
-- ============================================
-- NOTA: Esta función está comentada porque las notificaciones de mensajes directos
-- se muestran en la burbuja de chat (MessagesBell), no en la campanita de notificaciones.
-- Si en el futuro se quiere mostrar también en la campanita, descomentar esta función y el trigger.

-- CREATE OR REPLACE FUNCTION notify_direct_message()
-- RETURNS TRIGGER AS $$
-- DECLARE
--   sender_name text;
--   message_preview text;
-- BEGIN
--   -- Solo crear notificación si el mensaje es para otro usuario (no para uno mismo)
--   IF NEW.receiver_id != NEW.sender_id THEN
--     -- Obtener el nombre del remitente
--     SELECT full_name INTO sender_name
--     FROM profiles
--     WHERE id = NEW.sender_id;
--     
--     -- Crear preview del mensaje (primeros 50 caracteres)
--     message_preview := LEFT(NEW.message, 50);
--     IF LENGTH(NEW.message) > 50 THEN
--       message_preview := message_preview || '...';
--     END IF;
--     
--     -- Crear notificación para el receptor
--     INSERT INTO notifications (
--       user_id,
--       type,
--       title,
--       message,
--       direct_message_id,
--       metadata,
--       read
--     ) VALUES (
--       NEW.receiver_id,
--       'direct_message',
--       'Nuevo mensaje directo',
--       COALESCE(sender_name, 'Alguien') || ' te ha enviado un mensaje: ' || COALESCE(message_preview, '(sin texto)'),
--       NEW.id,
--       jsonb_build_object(
--         'sender_id', NEW.sender_id,
--         'sender_name', sender_name,
--         'message_id', NEW.id,
--         'has_attachments', EXISTS (
--           SELECT 1 FROM direct_message_attachments 
--           WHERE message_id = NEW.id
--         )
--       ),
--       false
--     );
--   END IF;
--   
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear trigger para detectar nuevos mensajes directos
-- ============================================
-- NOTA: Trigger comentado porque las notificaciones se muestran en la burbuja de chat
-- DROP TRIGGER IF EXISTS trigger_notify_direct_message ON direct_messages;
-- CREATE TRIGGER trigger_notify_direct_message
--   AFTER INSERT ON direct_messages
--   FOR EACH ROW
--   EXECUTE FUNCTION notify_direct_message();

-- 5. Eliminar notificaciones existentes de tipo 'direct_message'
-- ============================================
-- Eliminar todas las notificaciones de mensajes directos que ya existen
DELETE FROM notifications WHERE type = 'direct_message';

-- 6. Asegurar que el trigger NO esté activo
-- ============================================
-- Eliminar el trigger si existe (por si acaso se creó antes)
DROP TRIGGER IF EXISTS trigger_notify_direct_message ON direct_messages;

-- 7. Verificar que Realtime está habilitado para notifications
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;


