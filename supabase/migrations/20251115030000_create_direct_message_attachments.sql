-- ============================================
-- Sistema de Archivos Adjuntos para Mensajes Directos
-- ============================================

-- Tabla para almacenar metadata de archivos adjuntos
CREATE TABLE IF NOT EXISTS direct_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_direct_message_attachments_message_id ON direct_message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_direct_message_attachments_uploaded_by ON direct_message_attachments(uploaded_by);

-- Habilitar RLS
ALTER TABLE direct_message_attachments ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver archivos de mensajes donde participan
CREATE POLICY "Users can view attachments in their messages"
  ON direct_message_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM direct_messages
      WHERE direct_messages.id = direct_message_attachments.message_id
      AND (direct_messages.sender_id = auth.uid() OR direct_messages.receiver_id = auth.uid())
    )
  );

-- Política: Los usuarios pueden crear archivos adjuntos en sus mensajes
CREATE POLICY "Users can create attachments in their messages"
  ON direct_message_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM direct_messages
      WHERE direct_messages.id = direct_message_attachments.message_id
      AND direct_messages.sender_id = auth.uid()
    )
  );

-- Política: Los usuarios pueden eliminar sus propios archivos adjuntos
CREATE POLICY "Users can delete their own attachments"
  ON direct_message_attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Crear bucket de storage si no existe (esto debe hacerse manualmente en Supabase Dashboard)
-- Bucket name: direct-message-attachments
-- Public: false (archivos privados)














