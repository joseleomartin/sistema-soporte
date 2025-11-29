-- ============================================
-- CORREGIR POLÍTICAS RLS PARA direct-message-attachments
-- ============================================
-- Este script asegura que las políticas estén correctamente configuradas
-- ============================================

-- 1. Verificar que RLS está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS habilitado en storage.objects';
  END IF;
END $$;

-- 2. Eliminar TODAS las políticas relacionadas con direct-message-attachments
-- (para evitar conflictos)
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects; -- Esta podría estar causando problemas

-- 3. Crear políticas CORRECTAS para direct-message-attachments
-- IMPORTANTE: Estas políticas son específicas para el bucket direct-message-attachments

-- Política 1: SELECT - Ver archivos
CREATE POLICY "Users can view attachments in their messages"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (
      -- Opción 1: El usuario es el propietario (primer segmento del path es su user_id)
      auth.uid()::text = (string_to_array(name, '/'))[1]
      OR
      -- Opción 2: El usuario participa en la conversación (verificar en BD)
      EXISTS (
        SELECT 1 
        FROM direct_message_attachments dma
        JOIN direct_messages dm ON dm.id = dma.message_id
        WHERE dma.file_path = name
        AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
      )
    )
  );

-- Política 2: INSERT - Subir archivos
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND (
      -- El usuario debe ser el propietario (primer segmento del path)
      auth.uid()::text = (string_to_array(name, '/'))[1]
    )
  );

-- Política 3: DELETE - Eliminar archivos propios
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- 4. Verificar que las políticas se crearon correctamente
SELECT 
  'Políticas creadas:' as estado,
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%direct-message-attachments%' THEN '✅ Correcta'
    ELSE '❌ Revisar'
  END as verifica_bucket
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%attachments%'
ORDER BY cmd, policyname;

-- 5. NOTA IMPORTANTE:
-- Si la política "Public can view attachments" es necesaria para OTRO bucket
-- (como ticket-attachments), créala nuevamente con la condición correcta:
-- 
-- CREATE POLICY "Public can view attachments"
--   ON storage.objects FOR SELECT
--   TO public
--   USING (bucket_id = 'ticket-attachments');  -- ← Especifica el bucket correcto
--
-- Pero NO la necesitamos para direct-message-attachments porque es un bucket PRIVADO

