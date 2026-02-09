-- ============================================
-- Crear bucket para imágenes de Novedades Profesionales
-- ============================================

-- 1. Crear el bucket (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'professional-news-images',
  'professional-news-images',
  true, -- Público para que se puedan ver las imágenes
  5242880, -- 5MB en bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar RLS en storage.objects (si no está ya habilitado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 3. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Anyone can view professional news images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload professional news images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update professional news images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete professional news images" ON storage.objects;

-- 4. Política: Todos los usuarios autenticados pueden ver imágenes
CREATE POLICY "Anyone can view professional news images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'professional-news-images');

-- 5. Política: Solo administradores pueden subir imágenes
CREATE POLICY "Admins can upload professional news images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'professional-news-images' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 6. Política: Solo administradores pueden actualizar imágenes
CREATE POLICY "Admins can update professional news images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'professional-news-images' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'professional-news-images' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 7. Política: Solo administradores pueden eliminar imágenes
CREATE POLICY "Admins can delete professional news images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'professional-news-images' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
