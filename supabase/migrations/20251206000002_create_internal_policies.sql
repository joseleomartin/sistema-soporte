-- ============================================
-- CREAR SISTEMA DE POLÍTICAS INTERNAS
-- ============================================
-- Tabla para almacenar políticas internas (documentos y videos)
-- Solo administradores pueden crear/editar, todos pueden ver
-- ============================================

-- 1. Crear tabla para políticas internas
-- ============================================
CREATE TABLE IF NOT EXISTS internal_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('document', 'video')),
  
  -- Para videos de YouTube
  youtube_url TEXT,
  
  -- Para documentos/archivos
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  
  -- Metadatos
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: debe tener o youtube_url o file_path
  CONSTRAINT check_media_content CHECK (
    (type = 'video' AND youtube_url IS NOT NULL) OR
    (type = 'document' AND file_path IS NOT NULL)
  )
);

-- 2. Habilitar RLS
-- ============================================
ALTER TABLE internal_policies ENABLE ROW LEVEL SECURITY;

-- Política: Todos los usuarios autenticados pueden ver políticas
CREATE POLICY "Todos pueden ver políticas internas"
  ON internal_policies
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Solo admins pueden crear políticas
CREATE POLICY "Solo admins pueden crear políticas"
  ON internal_policies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden actualizar políticas
CREATE POLICY "Solo admins pueden actualizar políticas"
  ON internal_policies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden eliminar políticas
CREATE POLICY "Solo admins pueden eliminar políticas"
  ON internal_policies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 3. Crear función para actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_internal_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at
CREATE TRIGGER update_internal_policies_updated_at
  BEFORE UPDATE ON internal_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_internal_policies_updated_at();

-- 4. Crear índices para mejorar rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_internal_policies_type ON internal_policies(type);
CREATE INDEX IF NOT EXISTS idx_internal_policies_created_at ON internal_policies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_policies_created_by ON internal_policies(created_by);

-- 5. Comentarios
-- ============================================
COMMENT ON TABLE internal_policies IS 'Tabla para almacenar políticas internas de la empresa (documentos y videos)';
COMMENT ON COLUMN internal_policies.title IS 'Título de la política';
COMMENT ON COLUMN internal_policies.description IS 'Descripción de la política';
COMMENT ON COLUMN internal_policies.type IS 'Tipo: document (documento) o video (video de YouTube)';
COMMENT ON COLUMN internal_policies.youtube_url IS 'URL del video de YouTube (solo para type=video)';
COMMENT ON COLUMN internal_policies.file_path IS 'Ruta del archivo en storage (solo para type=document)';
COMMENT ON COLUMN internal_policies.file_name IS 'Nombre original del archivo';
COMMENT ON COLUMN internal_policies.file_type IS 'Tipo MIME del archivo';
COMMENT ON COLUMN internal_policies.file_size IS 'Tamaño del archivo en bytes';

-- 6. Crear bucket de storage para archivos de políticas
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('internal-policies', 'internal-policies', true, 104857600, NULL)
ON CONFLICT (id) DO NOTHING;

-- 7. Políticas RLS para el bucket de storage
-- ============================================
-- Política: Todos los usuarios autenticados pueden ver archivos
DROP POLICY IF EXISTS "Todos pueden ver archivos de políticas" ON storage.objects;
CREATE POLICY "Todos pueden ver archivos de políticas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'internal-policies');

-- Política: Solo admins pueden subir archivos
DROP POLICY IF EXISTS "Solo admins pueden subir archivos de políticas" ON storage.objects;
CREATE POLICY "Solo admins pueden subir archivos de políticas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'internal-policies' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Política: Solo admins pueden eliminar archivos
DROP POLICY IF EXISTS "Solo admins pueden eliminar archivos de políticas" ON storage.objects;
CREATE POLICY "Solo admins pueden eliminar archivos de políticas"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'internal-policies' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

