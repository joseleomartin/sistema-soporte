-- ============================================
-- NOTIFICACIONES PARA @MENTIONS EN CHAT DE CLIENTES
-- ============================================
-- Permite etiquetar usuarios con @ en el chat del cliente y notificarles
-- ============================================

-- 1. Agregar tipo 'forum_mention' al CHECK constraint de notifications
-- ============================================

-- Primero, eliminar el constraint existente
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recrear el constraint con el nuevo tipo
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('calendar_event', 'ticket_comment', 'ticket_status', 'task_assigned', 'forum_mention'));

-- 2. Agregar columna subforum_id si no existe (para referenciar el subforo/cliente)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'subforum_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN subforum_id UUID REFERENCES subforums(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_subforum_id ON notifications(subforum_id);
  END IF;
END $$;

-- 3. Función para crear notificación de mención en foro
-- ============================================

CREATE OR REPLACE FUNCTION notify_forum_mention()
RETURNS TRIGGER AS $$
DECLARE
  subforum_name TEXT;
  subforum_client_name TEXT;
  mentioner_name TEXT;
  mentioned_user_id UUID;
  message_preview TEXT;
BEGIN
  -- Obtener información del subforo
  SELECT s.name, s.client_name
  INTO subforum_name, subforum_client_name
  FROM subforums s
  WHERE s.id = NEW.subforum_id;

  -- Obtener nombre del usuario que mencionó
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = NEW.created_by;

  -- Obtener preview del mensaje (primeros 100 caracteres)
  message_preview := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    message_preview := message_preview || '...';
  END IF;

  -- Extraer menciones del mensaje (formato: @Nombre Usuario o @userId)
  -- Las menciones se almacenan en metadata como array de user_ids
  -- Esta función se llamará desde el frontend con los user_ids ya extraídos
  
  -- Nota: La lógica de extracción de menciones se hace en el frontend
  -- Esta función solo crea las notificaciones para los user_ids proporcionados
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: No creamos un trigger automático porque las menciones se procesan en el frontend
-- El frontend llamará a una función RPC para crear las notificaciones

-- 4. Función RPC para crear notificaciones de menciones
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
  -- Obtener información del subforo
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

-- 5. Función para obtener usuarios con acceso a un subforo
-- ============================================

CREATE OR REPLACE FUNCTION get_subforum_accessible_users(p_subforum_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.avatar_url
  FROM profiles p
  WHERE (
    -- Admin y support siempre tienen acceso
    p.role IN ('admin', 'support')
    OR
    -- Usuario tiene permiso directo
    EXISTS (
      SELECT 1 FROM subforum_permissions sp
      WHERE sp.subforum_id = p_subforum_id
      AND sp.user_id = p.id
      AND sp.can_view = true
    )
    OR
    -- Usuario pertenece a un departamento con permiso al foro
    EXISTS (
      SELECT 1 FROM subforums s
      INNER JOIN user_departments ud ON ud.user_id = p.id
      INNER JOIN department_forum_permissions dfp 
        ON dfp.department_id = ud.department_id
      WHERE s.id = p_subforum_id
      AND dfp.forum_id = s.forum_id
      AND dfp.can_view = true
    )
  )
  ORDER BY p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Política RLS para permitir que usuarios autenticados llamen la función
-- ============================================

-- La función usa SECURITY DEFINER, por lo que se ejecuta con permisos del propietario
-- No se necesitan políticas adicionales

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Tipo 'forum_mention' agregado a notifications
-- ✅ Columna subforum_id agregada
-- ✅ Función create_forum_mention_notifications creada
-- ✅ Índice en subforum_id creado
-- 
-- Uso desde el frontend:
-- SELECT create_forum_mention_notifications(
--   'subforum-id'::uuid,
--   ARRAY['user-id-1'::uuid, 'user-id-2'::uuid],
--   'mentioner-id'::uuid,
--   'Preview del mensaje...'
-- );
-- ============================================

