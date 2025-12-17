-- ============================================
-- CORREGIR POLÍTICAS RLS PARA STORAGE
-- ============================================
-- Este script corrige los errores 400 al crear signed URLs

-- 1. Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;

-- 2. Política SELECT (ver/descargar archivos)
-- Permite a los usuarios ver archivos donde son remitente O destinatario
CREATE POLICY "Users can view their conversation attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (
      -- El usuario subió el archivo (primera parte del path es su ID)
      (string_to_array(name, '/'))[1] = auth.uid()::text
      OR
      -- El usuario es parte de la conversación (segunda parte del path es su ID)
      (string_to_array(name, '/'))[2] = auth.uid()::text
      OR
      -- Verificación adicional en la base de datos
      EXISTS (
        SELECT 1 
        FROM direct_message_attachments dma
        JOIN direct_messages dm ON dm.id = dma.message_id
        WHERE dma.file_path = name
        AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
      )
    )
  );

-- 3. Política INSERT (subir archivos)
-- Solo permite subir archivos en la carpeta del propio usuario
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 4. Política UPDATE (actualizar archivos)
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

-- 5. Política DELETE (eliminar archivos)
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 6. Verificar que el bucket existe y está configurado correctamente
DO $$
BEGIN
  -- Actualizar configuración del bucket si existe
  UPDATE storage.buckets 
  SET 
    public = false,
    file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = NULL -- Permitir todos los tipos
  WHERE id = 'direct-message-attachments';
  
  -- Si no existe, crearlo
  IF NOT FOUND THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('direct-message-attachments', 'direct-message-attachments', false, 10485760, NULL);
  END IF;
END $$;

-- Mostrar las políticas actuales
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%attachment%'
ORDER BY policyname;















