-- ============================================
-- CREAR BUCKET Y POLÍTICAS RLS PARA ARCHIVOS DE CURSOS
-- ============================================
-- Ejecuta este script en Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Crear el bucket (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('library-course-files', 'library-course-files', true, 104857600, NULL)
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
DROP POLICY IF EXISTS "Todos pueden ver archivos de cursos" ON storage.objects;
DROP POLICY IF EXISTS "Solo admins pueden subir archivos de cursos" ON storage.objects;
DROP POLICY IF EXISTS "Solo admins pueden actualizar archivos de cursos" ON storage.objects;
DROP POLICY IF EXISTS "Solo admins pueden eliminar archivos de cursos" ON storage.objects;

-- 4. Política: Todos pueden leer archivos
CREATE POLICY "Todos pueden ver archivos de cursos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'library-course-files');

-- 5. Política: Solo admins pueden subir archivos
CREATE POLICY "Solo admins pueden subir archivos de cursos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'library-course-files' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 6. Política: Solo admins pueden actualizar archivos
CREATE POLICY "Solo admins pueden actualizar archivos de cursos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'library-course-files' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 7. Política: Solo admins pueden eliminar archivos
CREATE POLICY "Solo admins pueden eliminar archivos de cursos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'library-course-files' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que el bucket existe
SELECT 'Bucket creado:' as mensaje, * FROM storage.buckets WHERE id = 'library-course-files';

-- Verificar las políticas
SELECT 'Políticas creadas:' as mensaje, schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%cursos%';

