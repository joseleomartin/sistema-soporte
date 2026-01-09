-- ============================================
-- VERIFICAR Y CORREGIR POLÍTICAS RLS
-- ============================================
-- Este script verifica y corrige las políticas RLS

-- 1. Verificar que el bucket existe
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'direct-message-attachments';

-- 2. Ver todas las políticas actuales
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%attachment%'
ORDER BY policyname;

-- 3. Eliminar TODAS las políticas (por si hay conflictos)
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their conversation attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own attachments" ON storage.objects;

-- 4. RECREAR la política SELECT con lógica más permisiva
CREATE POLICY "Users can view their conversation attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (
      -- El usuario es el remitente (primera parte del path)
      (string_to_array(name, '/'))[1] = auth.uid()::text
      OR
      -- El usuario es el destinatario (segunda parte del path)
      (string_to_array(name, '/'))[2] = auth.uid()::text
      OR
      -- Verificación en base de datos (más confiable)
      EXISTS (
        SELECT 1 
        FROM direct_message_attachments dma
        JOIN direct_messages dm ON dm.id = dma.message_id
        WHERE dma.file_path = name
        AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
      )
    )
  );

-- 5. Política INSERT
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 6. Política UPDATE
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

-- 7. Política DELETE
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 8. Verificar que se crearon correctamente
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene USING'
    ELSE 'Sin USING'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Tiene WITH CHECK'
    ELSE 'Sin WITH CHECK'
  END as with_check_clause
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%attachment%'
ORDER BY policyname;

-- 9. Verificar un archivo de ejemplo (reemplaza con un path real de tu BD)
-- SELECT 
--   dma.file_path,
--   dm.sender_id,
--   dm.receiver_id,
--   (string_to_array(dma.file_path, '/'))[1] as path_part_1,
--   (string_to_array(dma.file_path, '/'))[2] as path_part_2
-- FROM direct_message_attachments dma
-- JOIN direct_messages dm ON dm.id = dma.message_id
-- LIMIT 5;
























