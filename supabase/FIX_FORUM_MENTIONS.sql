-- ============================================
-- CORREGIR FUNCIÓN DE NOTIFICACIONES DE MENCIONES EN FOROS
-- ============================================
-- Corrige el JOIN con clients y quita "EmaGroup Notificaciones:" del título
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

  -- Si no se encuentra el subforo, salir
  IF subforum_name IS NULL THEN
    RAISE NOTICE '⚠️ Subforo % no encontrado', p_subforum_id;
    RETURN;
  END IF;

  -- Obtener nombre del usuario que mencionó
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = p_mentioner_id;

  -- Si no se encuentra el usuario que mencionó, salir
  IF mentioner_name IS NULL THEN
    RAISE NOTICE '⚠️ Usuario mencionador % no encontrado', p_mentioner_id;
    RETURN;
  END IF;

  -- Crear notificación para cada usuario mencionado
  FOREACH mentioned_user_id IN ARRAY p_mentioned_user_ids
  LOOP
    -- No notificar al usuario que mencionó
    IF mentioned_user_id != p_mentioner_id THEN
      -- Verificar que el usuario mencionado existe
      IF EXISTS (SELECT 1 FROM profiles WHERE id = mentioned_user_id) THEN
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
        
        RAISE NOTICE '✅ Notificación creada para usuario % en subforo %', mentioned_user_id, p_subforum_id;
      ELSE
        RAISE NOTICE '⚠️ Usuario mencionado % no existe', mentioned_user_id;
      END IF;
    ELSE
      RAISE NOTICE 'ℹ️ Saltando auto-notificación para usuario %', mentioned_user_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ✅ Función corregida
-- ============================================
-- - JOIN correcto con tabla clients
-- - Título sin "EmaGroup Notificaciones:" (solo en email)
-- - Validaciones agregadas
-- - Logging para debugging
-- ============================================

