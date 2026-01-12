-- ============================================
-- VERIFICAR POLÍTICAS RLS DEL BUCKET
-- ============================================
-- Ejecuta este script para verificar si las políticas están creadas
-- ============================================

-- 1. Verificar que las políticas existen
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

-- Si no aparecen políticas, ejecuta el resto del script FIX_DIRECT_MESSAGE_BUCKET_POLICIES.sql
-- o ejecuta las siguientes políticas manualmente:

-- ============================================
-- CREAR POLÍTICAS SI NO EXISTEN
-- ============================================

-- Eliminar políticas existentes (si hay conflictos)
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

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

-- Verificar nuevamente después de crear
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ Ver archivos'
    WHEN cmd = 'INSERT' THEN '✅ Subir archivos'
    WHEN cmd = 'DELETE' THEN '✅ Eliminar archivos'
    ELSE cmd
  END as descripcion
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%attachments%'
ORDER BY cmd;























