-- ============================================
-- Sistema de Mensajería Directa
-- ============================================
-- Tabla para comunicación directa entre usuarios y administradores/soporte
-- ============================================

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_sender_receiver CHECK (sender_id != receiver_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages(sender_id, receiver_id);

-- Habilitar RLS
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver mensajes donde son remitente o destinatario
CREATE POLICY "Users can view own messages"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

-- Política: Los usuarios pueden crear mensajes
-- Usuarios normales solo pueden enviar a admin/support
-- Admin/support pueden enviar a cualquiera
CREATE POLICY "Users can send messages"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      -- Si el remitente es admin o support, puede enviar a cualquiera
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
      )
      OR
      -- Si el remitente es usuario normal, solo puede enviar a admin/support
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'user'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = receiver_id
          AND profiles.role IN ('admin', 'support')
        )
      )
    )
  );

-- Política: Los usuarios pueden actualizar el estado de lectura de sus mensajes recibidos
CREATE POLICY "Users can update read status"
  ON direct_messages FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- Función para marcar mensajes como leídos
CREATE OR REPLACE FUNCTION mark_messages_as_read(conversation_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE direct_messages
  SET is_read = true
  WHERE receiver_id = auth.uid()
    AND sender_id = conversation_user_id
    AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener conversaciones
CREATE OR REPLACE FUNCTION get_conversations()
RETURNS TABLE (
  other_user_id uuid,
  other_user_name text,
  other_user_email text,
  other_user_role text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint,
  avatar_url text
) AS $$
BEGIN
  RETURN QUERY
  WITH conversation_partners AS (
    SELECT DISTINCT
      CASE 
        WHEN sender_id = auth.uid() THEN receiver_id
        ELSE sender_id
      END as partner_id
    FROM direct_messages
    WHERE sender_id = auth.uid() OR receiver_id = auth.uid()
  ),
  last_messages AS (
    SELECT DISTINCT ON (cp.partner_id)
      cp.partner_id,
      dm.message,
      dm.created_at,
      dm.sender_id = auth.uid() as is_sent_by_me
    FROM conversation_partners cp
    JOIN direct_messages dm ON (
      (dm.sender_id = cp.partner_id AND dm.receiver_id = auth.uid()) OR
      (dm.sender_id = auth.uid() AND dm.receiver_id = cp.partner_id)
    )
    ORDER BY cp.partner_id, dm.created_at DESC
  ),
  unread_counts AS (
    SELECT
      sender_id as partner_id,
      COUNT(*) as unread
    FROM direct_messages
    WHERE receiver_id = auth.uid() AND is_read = false
    GROUP BY sender_id
  )
  SELECT
    p.id as other_user_id,
    p.full_name as other_user_name,
    p.email as other_user_email,
    p.role as other_user_role,
    lm.message as last_message,
    lm.created_at as last_message_at,
    COALESCE(uc.unread, 0)::bigint as unread_count,
    p.avatar_url as avatar_url
  FROM conversation_partners cp
  JOIN profiles p ON p.id = cp.partner_id
  LEFT JOIN last_messages lm ON lm.partner_id = cp.partner_id
  LEFT JOIN unread_counts uc ON uc.partner_id = cp.partner_id
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

