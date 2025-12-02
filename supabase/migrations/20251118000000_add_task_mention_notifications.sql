-- ============================================
-- NOTIFICACIONES PARA @MENTIONS EN CHAT DE TAREAS
-- ============================================
-- Permite etiquetar usuarios con @ en el chat de tareas y notificarles
-- ============================================

-- 1. Agregar tipo 'task_mention' al CHECK constraint de notifications
-- ============================================

-- Primero, eliminar el constraint existente
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recrear el constraint con el nuevo tipo
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('calendar_event', 'ticket_comment', 'ticket_status', 'task_assigned', 'forum_mention', 'task_mention'));

-- 2. Agregar columna task_id si no existe (para referenciar la tarea)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'task_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
  END IF;
END $$;

-- 3. Función RPC para crear notificaciones de menciones en tareas
-- ============================================

CREATE OR REPLACE FUNCTION create_task_mention_notifications(
  p_task_id UUID,
  p_mentioned_user_ids UUID[],
  p_mentioner_id UUID,
  p_message_preview TEXT
)
RETURNS void AS $$
DECLARE
  task_title TEXT;
  mentioner_name TEXT;
  mentioned_user_id UUID;
BEGIN
  -- Obtener título de la tarea
  SELECT title INTO task_title
  FROM tasks
  WHERE id = p_task_id;

  -- Obtener nombre del usuario que mencionó
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = p_mentioner_id;

  -- Crear notificación para cada usuario mencionado
  FOREACH mentioned_user_id IN ARRAY p_mentioned_user_ids
  LOOP
    -- No notificar al usuario que mencionó
    IF mentioned_user_id != p_mentioner_id THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        task_id,
        metadata
      )
      VALUES (
        mentioned_user_id,
        'task_mention',
        'Fuiste mencionado en el chat de ' || COALESCE(task_title, 'la tarea'),
        mentioner_name || ' te mencionó: ' || p_message_preview,
        p_task_id,
        jsonb_build_object(
          'mentioner_id', p_mentioner_id,
          'mentioner_name', mentioner_name,
          'task_title', task_title
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Tipo 'task_mention' agregado a notifications
-- ✅ Columna task_id agregada
-- ✅ Función create_task_mention_notifications creada
-- ✅ Índice en task_id creado
-- 
-- Uso desde el frontend:
-- SELECT create_task_mention_notifications(
--   'task-id'::uuid,
--   ARRAY['user-id-1'::uuid, 'user-id-2'::uuid],
--   'mentioner-id'::uuid,
--   'Preview del mensaje...'
-- );
-- ============================================

