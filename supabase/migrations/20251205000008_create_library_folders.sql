-- ============================================
-- CREAR SISTEMA DE CARPETAS PARA BIBLIOTECA Y CURSOS
-- ============================================
-- Permite organizar cursos y documentos en carpetas
-- ============================================

-- 1. Crear tabla para carpetas
-- ============================================
CREATE TABLE IF NOT EXISTS library_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('course', 'document')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agregar columna folder_id a library_courses
-- ============================================
ALTER TABLE library_courses
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES library_folders(id) ON DELETE SET NULL;

-- 3. Habilitar RLS en library_folders
-- ============================================
ALTER TABLE library_folders ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver carpetas
CREATE POLICY "Todos pueden ver carpetas"
  ON library_folders
  FOR SELECT
  USING (true);

-- Política: Solo admins pueden crear carpetas
CREATE POLICY "Solo admins pueden crear carpetas"
  ON library_folders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden actualizar carpetas
CREATE POLICY "Solo admins pueden actualizar carpetas"
  ON library_folders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden eliminar carpetas
CREATE POLICY "Solo admins pueden eliminar carpetas"
  ON library_folders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 4. Crear función para actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_library_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at
CREATE TRIGGER update_library_folders_updated_at
  BEFORE UPDATE ON library_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_library_folders_updated_at();

-- 5. Crear índices para mejorar rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_library_folders_type ON library_folders(type);
CREATE INDEX IF NOT EXISTS idx_library_folders_created_by ON library_folders(created_by);
CREATE INDEX IF NOT EXISTS idx_library_courses_folder_id ON library_courses(folder_id);

-- 6. Comentarios
-- ============================================
COMMENT ON TABLE library_folders IS 'Carpetas para organizar cursos y documentos de la biblioteca';
COMMENT ON COLUMN library_folders.name IS 'Nombre de la carpeta';
COMMENT ON COLUMN library_folders.description IS 'Descripción de la carpeta';
COMMENT ON COLUMN library_folders.type IS 'Tipo de carpeta: course (cursos) o document (documentos)';
COMMENT ON COLUMN library_folders.created_by IS 'ID del usuario que creó la carpeta';
COMMENT ON COLUMN library_courses.folder_id IS 'ID de la carpeta a la que pertenece el curso/documento';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Tabla library_folders creada
-- ✅ Columna folder_id agregada a library_courses
-- ✅ RLS habilitado con políticas apropiadas
-- ✅ Índices creados para mejorar rendimiento
-- ============================================
















