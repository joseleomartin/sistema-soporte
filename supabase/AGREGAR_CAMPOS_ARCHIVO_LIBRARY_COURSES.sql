-- Script para agregar campos de archivo a library_courses si la tabla ya existe
-- Ejecutar este script si la tabla ya fue creada sin los campos de archivo

-- Agregar columnas de archivo si no existen
ALTER TABLE library_courses 
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Hacer youtube_url opcional (si no lo es ya)
ALTER TABLE library_courses 
  ALTER COLUMN youtube_url DROP NOT NULL;

-- Eliminar constraint si existe (ya no es necesario)
ALTER TABLE library_courses 
  DROP CONSTRAINT IF EXISTS check_youtube_or_file;

-- Agregar comentarios
COMMENT ON COLUMN library_courses.youtube_url IS 'URL del video de YouTube (opcional si hay archivo)';
COMMENT ON COLUMN library_courses.file_path IS 'Ruta del archivo en storage (opcional si hay YouTube)';
COMMENT ON COLUMN library_courses.file_name IS 'Nombre original del archivo';
COMMENT ON COLUMN library_courses.file_type IS 'Tipo MIME del archivo';
COMMENT ON COLUMN library_courses.file_size IS 'Tamaño del archivo en bytes';

