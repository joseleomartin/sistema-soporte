-- ============================================
-- CORREGIR POLÍTICA INSERT PARA direct-message-attachments
-- ============================================
-- Este script corrige específicamente la política de INSERT que está marcada como "Revisar"
-- ============================================

-- Eliminar la política de INSERT existente
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;

-- Recrear la política de INSERT con la verificación correcta del bucket
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND (
      -- El usuario debe ser el propietario (primer segmento del path es su user_id)
      auth.uid()::text = (string_to_array(name, '/'))[1]
    )
  );

-- Verificar que la política se creó correctamente
SELECT 
  'Política INSERT corregida:' as estado,
  policyname,
  cmd,
  CASE 
    WHEN with_check::text LIKE '%direct-message-attachments%' THEN '✅ Correcta'
    ELSE '❌ Revisar'
  END as verifica_bucket,
  with_check::text as expresion_with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname = 'Users can upload attachments';

-- Verificar todas las políticas nuevamente
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' AND qual::text LIKE '%direct-message-attachments%' THEN '✅ Correcta'
    WHEN cmd = 'INSERT' AND with_check::text LIKE '%direct-message-attachments%' THEN '✅ Correcta'
    WHEN cmd = 'DELETE' AND qual::text LIKE '%direct-message-attachments%' THEN '✅ Correcta'
    ELSE '❌ Revisar'
  END as verifica_bucket
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%attachments%'
ORDER BY cmd;

