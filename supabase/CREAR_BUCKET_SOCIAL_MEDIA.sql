-- Crear bucket para archivos de la sección social
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  true,
  52428800, -- 50MB en bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para storage.objects en el bucket social-media

-- SELECT: Todos los usuarios autenticados pueden ver archivos
CREATE POLICY "Anyone can view social media files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'social-media' AND
  auth.role() = 'authenticated'
);

-- INSERT: Todos pueden subir archivos
CREATE POLICY "Anyone can upload social media files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'social-media' AND
  auth.role() = 'authenticated'
);

-- UPDATE: Solo el usuario que subió el archivo puede actualizarlo
CREATE POLICY "Users can update own social media files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'social-media' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'social-media' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Solo el usuario que subió el archivo o admin puede eliminarlo
CREATE POLICY "Users can delete own social media files or admins can delete any"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'social-media' AND
  auth.role() = 'authenticated' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
);

-- Verificar que el bucket se creó correctamente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'social-media') THEN
    RAISE NOTICE 'Bucket social-media creado exitosamente';
  ELSE
    RAISE EXCEPTION 'Error al crear el bucket social-media';
  END IF;
END $$;















