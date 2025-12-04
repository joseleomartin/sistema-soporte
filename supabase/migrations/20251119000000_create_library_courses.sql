-- Crear tabla para cursos de la biblioteca
CREATE TABLE IF NOT EXISTS library_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE library_courses ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer los cursos
CREATE POLICY "Todos pueden ver cursos"
  ON library_courses
  FOR SELECT
  USING (true);

-- Política: Solo admins pueden crear cursos
CREATE POLICY "Solo admins pueden crear cursos"
  ON library_courses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden actualizar cursos
CREATE POLICY "Solo admins pueden actualizar cursos"
  ON library_courses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden eliminar cursos
CREATE POLICY "Solo admins pueden eliminar cursos"
  ON library_courses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_library_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at
CREATE TRIGGER update_library_courses_updated_at
  BEFORE UPDATE ON library_courses
  FOR EACH ROW
  EXECUTE FUNCTION update_library_courses_updated_at();

-- Crear índice para búsquedas por título
CREATE INDEX IF NOT EXISTS idx_library_courses_title ON library_courses(title);

-- Comentarios en la tabla
COMMENT ON TABLE library_courses IS 'Tabla para almacenar cursos y recursos educativos de la biblioteca';
COMMENT ON COLUMN library_courses.title IS 'Título del curso';
COMMENT ON COLUMN library_courses.description IS 'Descripción del curso';
COMMENT ON COLUMN library_courses.youtube_url IS 'URL del video de YouTube (opcional si hay archivo)';
COMMENT ON COLUMN library_courses.file_path IS 'Ruta del archivo en storage (opcional si hay YouTube)';
COMMENT ON COLUMN library_courses.file_name IS 'Nombre original del archivo';
COMMENT ON COLUMN library_courses.file_type IS 'Tipo MIME del archivo';
COMMENT ON COLUMN library_courses.file_size IS 'Tamaño del archivo en bytes';
COMMENT ON COLUMN library_courses.created_by IS 'ID del usuario que creó el curso';

