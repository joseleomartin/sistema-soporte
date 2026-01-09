-- ============================================
-- SOLUCIÓN DEFINITIVA PARA ERROR 400
-- ============================================
-- EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- Copia TODO y pégalo en una nueva query

-- PASO 1: Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their conversation attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own attachments" ON storage.objects;

-- PASO 2: Crear política SELECT (VER/DESCARGAR)
-- Esta es la MÁS IMPORTANTE para las signed URLs
CREATE POLICY "Users can view their conversation attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (
      -- Usuario subió el archivo (primera parte del path)
      (string_to_array(name, '/'))[1] = auth.uid()::text
      OR
      -- Usuario es destinatario (segunda parte del path)
      (string_to_array(name, '/'))[2] = auth.uid()::text
      OR
      -- Verificación en base de datos
      EXISTS (
        SELECT 1 
        FROM direct_message_attachments dma
        JOIN direct_messages dm ON dm.id = dma.message_id
        WHERE dma.file_path = name
        AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
      )
    )
  );

-- PASO 3: Crear política INSERT (SUBIR)
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- PASO 4: Crear política UPDATE
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

-- PASO 5: Crear política DELETE
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- PASO 6: Verificar bucket
DO $$
BEGIN
  UPDATE storage.buckets 
  SET public = false, file_size_limit = 10485760, allowed_mime_types = NULL
  WHERE id = 'direct-message-attachments';
  
  IF NOT FOUND THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('direct-message-attachments', 'direct-message-attachments', false, 10485760, NULL);
  END IF;
END $$;

-- PASO 7: VERIFICAR - Debes ver 4 políticas
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%attachment%'
ORDER BY policyname;
























