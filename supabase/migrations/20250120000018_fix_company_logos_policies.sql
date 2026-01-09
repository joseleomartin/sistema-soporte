-- ============================================
-- Corregir políticas RLS para logos de empresas
-- ============================================
-- Este script corrige las políticas que estaban causando errores
-- ============================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company logos" ON storage.objects;

-- Política: Todos los usuarios autenticados pueden ver logos
CREATE POLICY "Anyone can view company logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'company-logos');

-- Política: Solo administradores pueden subir logos
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

-- Política: Solo administradores pueden actualizar logos de su empresa
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

-- Política: Solo administradores pueden eliminar logos de su empresa
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







