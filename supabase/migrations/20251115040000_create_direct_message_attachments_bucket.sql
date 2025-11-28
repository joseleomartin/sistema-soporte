-- ============================================
-- Crear Bucket de Storage para Archivos Adjuntos
-- ============================================

-- Crear el bucket si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('direct-message-attachments', 'direct-message-attachments', false, 10485760, NULL)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- Políticas de Storage
-- ============================================

-- Política: Los usuarios pueden ver archivos de sus mensajes
-- Simplificada: si el archivo está en su carpeta o en una conversación donde participa
CREATE POLICY "Users can view attachments in their messages"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (
      -- El usuario es el propietario de la carpeta (remitente)
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- El usuario es el destinatario (verificar en la base de datos)
      EXISTS (
        SELECT 1 FROM direct_message_attachments dma
        JOIN direct_messages dm ON dm.id = dma.message_id
        WHERE dma.file_path = name
        AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
      )
    )
  );

-- Política: Los usuarios pueden subir archivos en sus mensajes
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Política: Los usuarios pueden eliminar sus propios archivos
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

