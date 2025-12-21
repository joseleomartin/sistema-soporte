-- Crear tabla para partes de cursos
CREATE TABLE IF NOT EXISTS course_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES library_courses(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_id, part_number) -- Un curso no puede tener dos partes con el mismo número
);

-- Habilitar RLS
ALTER TABLE course_parts ENABLE ROW LEVEL SECURITY;

-- Políticas para course_parts
-- SELECT: Todos pueden ver las partes
CREATE POLICY "Todos pueden ver partes de cursos"
  ON course_parts
  FOR SELECT
  USING (true);

-- INSERT: Solo admins pueden crear partes
CREATE POLICY "Solo admins pueden crear partes"
  ON course_parts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- UPDATE: Solo admins pueden actualizar partes
CREATE POLICY "Solo admins pueden actualizar partes"
  ON course_parts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- DELETE: Solo admins pueden eliminar partes
CREATE POLICY "Solo admins pueden eliminar partes"
  ON course_parts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_course_parts_course_id ON course_parts(course_id);
CREATE INDEX IF NOT EXISTS idx_course_parts_part_number ON course_parts(course_id, part_number);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_course_parts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER update_course_parts_updated_at
  BEFORE UPDATE ON course_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_course_parts_updated_at();

-- Comentarios
COMMENT ON TABLE course_parts IS 'Partes o lecciones individuales de un curso';
COMMENT ON COLUMN course_parts.part_number IS 'Número de la parte (1, 2, 3, etc.)';
COMMENT ON COLUMN course_parts.title IS 'Título de la parte';
COMMENT ON COLUMN course_parts.description IS 'Descripción de la parte';













