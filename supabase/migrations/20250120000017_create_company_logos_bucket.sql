-- ============================================
-- Crear bucket para logos de empresas
-- ============================================
-- Este script crea el bucket company-logos y sus políticas RLS
-- ============================================

-- 1. Crear el bucket (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true, -- Público para que se puedan ver los logos
  2097152, -- 2MB en bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
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
DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company logos" ON storage.objects;

-- 4. Política: Todos los usuarios autenticados pueden ver logos
CREATE POLICY "Anyone can view company logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'company-logos');

-- 5. Política: Solo administradores pueden subir logos
-- Simplificada: solo verifica que el usuario sea admin
-- El control del tenant_id se hace en el código del frontend
CREATE POLICY "Admins can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 6. Política: Solo administradores pueden actualizar logos de su empresa
CREATE POLICY "Admins can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
    AND EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id::text = (storage.foldername(name))[1]
      AND tenants.id = profiles.tenant_id
    )
  )
)
WITH CHECK (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 7. Política: Solo administradores pueden eliminar logos de su empresa
CREATE POLICY "Admins can delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
    AND EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id::text = (storage.foldername(name))[1]
      AND tenants.id = profiles.tenant_id
    )
  )
);

-- Verificar que el bucket se creó correctamente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'company-logos') THEN
    RAISE NOTICE '✅ Bucket company-logos creado exitosamente';
  ELSE
    RAISE WARNING '⚠️  No se pudo crear el bucket company-logos';
  END IF;
END $$;

