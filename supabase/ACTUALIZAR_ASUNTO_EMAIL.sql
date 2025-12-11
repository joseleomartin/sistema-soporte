-- ============================================
-- ACTUALIZAR ASUNTO DE EMAIL PARA MENCIONES EN TAREAS
-- ============================================
-- Cambia el asunto del email para incluir "EmaGroup Notificaciones"
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
        'EmaGroup Notificaciones: Fuiste mencionado en el chat de ' || COALESCE(task_title, 'la tarea'),
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
-- ✅ Función actualizada
-- ============================================
-- El asunto del email ahora mostrará:
-- "EmaGroup Notificaciones: Fuiste mencionado en el chat de [título de la tarea]"
-- ============================================








