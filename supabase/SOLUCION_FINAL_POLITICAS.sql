-- ============================================
-- SOLUCIÓN FINAL - POLÍTICAS RLS SIMPLIFICADAS
-- ============================================
-- Este script crea políticas más permisivas y simples

-- 1. Eliminar TODAS las políticas existentes
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their conversation attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own attachments" ON storage.objects;

-- 2. POLÍTICA SELECT - La más importante para signed URLs
-- Versión simplificada que solo verifica el path
CREATE POLICY "Users can view their conversation attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (
      -- Usuario es remitente (primera parte del path)
      (string_to_array(name, '/'))[1] = auth.uid()::text
      OR
      -- Usuario es destinatario (segunda parte del path)
      (string_to_array(name, '/'))[2] = auth.uid()::text
    )
  );

-- 3. POLÍTICA INSERT
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 4. POLÍTICA UPDATE
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

-- 5. POLÍTICA DELETE
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (string_to_array(name, '/'))[1] = auth.uid()::text
  );

-- 6. Verificar bucket
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

-- 7. Verificar políticas creadas
SELECT 
  policyname,
  cmd,
  CASE WHEN qual IS NOT NULL THEN '✅ Tiene USING' ELSE '❌ Sin USING' END as using_status
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%attachment%'
ORDER BY policyname;

-- 8. TEST: Verificar que la política funciona
-- (Descomenta y ejecuta con un user_id real para probar)
-- SELECT 
--   name,
--   (string_to_array(name, '/'))[1] as part1,
--   (string_to_array(name, '/'))[2] as part2,
--   auth.uid() as current_user
-- FROM storage.objects
-- WHERE bucket_id = 'direct-message-attachments'
-- LIMIT 5;



















