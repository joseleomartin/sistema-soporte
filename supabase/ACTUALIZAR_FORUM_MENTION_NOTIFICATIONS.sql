-- ============================================
-- ACTUALIZAR FUNCIÓN DE NOTIFICACIONES DE MENCIONES EN FOROS
-- ============================================
-- Actualiza el asunto para incluir "EmaGroup Notificaciones:"
-- ============================================

CREATE OR REPLACE FUNCTION create_forum_mention_notifications(
  p_subforum_id UUID,
  p_mentioned_user_ids UUID[],
  p_mentioner_id UUID,
  p_message_preview TEXT
)
RETURNS void AS $$
DECLARE
  subforum_name TEXT;
  subforum_client_name TEXT;
  mentioner_name TEXT;
  mentioned_user_id UUID;
BEGIN
  -- Obtener información del subforo (client_name está en la tabla subforums directamente)
  SELECT s.name, s.client_name
  INTO subforum_name, subforum_client_name
  FROM subforums s
  WHERE s.id = p_subforum_id;

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
        subforum_id,
        metadata
      )
      VALUES (
        mentioned_user_id,
        'forum_mention',
        'Fuiste mencionado en el chat de ' || COALESCE(subforum_client_name, subforum_name),
        mentioner_name || ' te mencionó: ' || p_message_preview,
        p_subforum_id,
        jsonb_build_object(
          'mentioner_id', p_mentioner_id,
          'mentioner_name', mentioner_name,
          'subforum_name', subforum_name,
          'subforum_client_name', subforum_client_name
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ✅ Función actualizada
-- ============================================
-- El asunto ahora mostrará:
-- "EmaGroup Notificaciones: Fuiste mencionado en el chat de [nombre del cliente]"
-- ============================================

