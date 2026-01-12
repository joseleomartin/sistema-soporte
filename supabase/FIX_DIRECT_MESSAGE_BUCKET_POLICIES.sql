-- ============================================
-- FIX: Corregir Políticas RLS del Bucket direct-message-attachments
-- ============================================
-- Ejecuta este script si recibes el error "Bucket not found"
-- aunque el bucket exista en el Dashboard
-- ============================================

-- 1. Verificar que el bucket existe
SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  created_at
FROM storage.buckets 
WHERE id = 'direct-message-attachments';

-- Si no aparece nada, el bucket no existe. Créalo manualmente desde el Dashboard.

-- 2. Verificar que RLS está habilitado en storage.objects
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
  ELSE
    RAISE NOTICE 'RLS ya está habilitado en storage.objects';
  END IF;
END $$;

-- 3. Eliminar políticas existentes (si hay conflictos)
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- 4. Crear políticas mejoradas con mejor manejo de errores
-- Política: Los usuarios pueden ver archivos de sus mensajes
CREATE POLICY "Users can view attachments in their messages"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND (
      -- El usuario es el propietario de la carpeta (remitente)
      -- Path formato: user_id/conversation_id/filename
      auth.uid()::text = (string_to_array(name, '/'))[1]
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
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Política: Los usuarios pueden eliminar sus propios archivos
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- 5. Verificar que las políticas se crearon correctamente
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
  AND policyname LIKE '%attachments%'
ORDER BY policyname;

-- 6. Verificar permisos del bucket
SELECT 
  id,
  name,
  public,
  file_size_limit,
  CASE 
    WHEN public THEN 'Público - Accesible sin autenticación'
    ELSE 'Privado - Requiere autenticación y políticas RLS'
  END as access_type
FROM storage.buckets
WHERE id = 'direct-message-attachments';

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. El bucket debe existir antes de ejecutar este script
-- 2. Si el bucket no existe, créalo manualmente desde el Dashboard:
--    - Name: direct-message-attachments
--    - Public: NO (desactivado)
--    - File size limit: 10 MB (10485760 bytes)
-- 3. Después de ejecutar este script, prueba descargar un archivo nuevamente
-- 4. Si sigue fallando, verifica en la consola del navegador los logs detallados
-- ============================================























