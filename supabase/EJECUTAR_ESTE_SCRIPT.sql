-- ============================================
-- SCRIPT PARA CORREGIR ERROR 400 EN STORAGE
-- ============================================
-- COPIAR TODO ESTE CONTENIDO Y EJECUTAR EN SUPABASE SQL EDITOR

-- 1. Eliminar políticas antiguas
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their conversation attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own attachments" ON storage.objects;

-- 2. POLÍTICA SELECT - Ver/Descargar archivos
-- Permite acceso si el usuario es remitente O destinatario
CREATE POLICY "Users can view their conversation attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (
      -- Primera parte del path = ID del usuario
      (string_to_array(name, '/'))[1] = auth.uid()::text
      OR
      -- Segunda parte del path = ID del usuario
      (string_to_array(name, '/'))[2] = auth.uid()::text
      OR
      -- Verificación en la base de datos
      EXISTS (
        SELECT 1 
        FROM direct_message_attachments dma
        JOIN direct_messages dm ON dm.id = dma.message_id
        WHERE dma.file_path = name
        AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
      )
    )
  );

-- 3. POLÍTICA INSERT - Subir archivos
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 4. POLÍTICA UPDATE - Actualizar archivos
CREATE POLICY "Users can update their own attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 5. POLÍTICA DELETE - Eliminar archivos
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 6. Verificar y crear bucket si no existe
DO $$
BEGIN
  UPDATE storage.buckets 
  SET 
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = NULL
  WHERE id = 'direct-message-attachments';
  
  IF NOT FOUND THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('direct-message-attachments', 'direct-message-attachments', false, 10485760, NULL);
  END IF;
END $$;

-- 7. Verificar que las políticas se crearon correctamente
SELECT 
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%attachment%'
ORDER BY policyname;


















