-- ==================================================================
-- Permitir múltiples videos y archivos por parte de curso
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Modifica la tabla course_parts para permitir múltiples
--              videos de YouTube y múltiples archivos por parte
-- ==================================================================

-- Agregar columnas JSONB para almacenar arrays de videos y archivos
ALTER TABLE course_parts 
ADD COLUMN IF NOT EXISTS youtube_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;

-- Migrar datos existentes a las nuevas columnas
-- Si hay un youtube_url existente, moverlo al array
UPDATE course_parts
SET youtube_urls = CASE 
  WHEN youtube_url IS NOT NULL AND youtube_url != '' THEN 
    jsonb_build_array(youtube_url)
  ELSE 
    '[]'::jsonb
END
WHERE youtube_urls = '[]'::jsonb OR youtube_urls IS NULL;

-- Si hay un archivo existente, moverlo al array
UPDATE course_parts
SET files = CASE 
  WHEN file_path IS NOT NULL THEN 
    jsonb_build_array(jsonb_build_object(
      'file_path', file_path,
      'file_name', file_name,
      'file_type', file_type,
      'file_size', file_size
    ))
  ELSE 
    '[]'::jsonb
END
WHERE files = '[]'::jsonb OR files IS NULL;

-- Crear índices para búsquedas en JSONB
CREATE INDEX IF NOT EXISTS idx_course_parts_youtube_urls ON course_parts USING GIN (youtube_urls);
CREATE INDEX IF NOT EXISTS idx_course_parts_files ON course_parts USING GIN (files);

-- Comentarios
COMMENT ON COLUMN course_parts.youtube_urls IS 'Array de URLs de YouTube para esta parte del curso';
COMMENT ON COLUMN course_parts.files IS 'Array de objetos con información de archivos (file_path, file_name, file_type, file_size)';

-- ==================================================================
-- NOTA: Las columnas antiguas (youtube_url, file_path, etc.) se mantienen
--       por compatibilidad, pero se recomienda usar las nuevas columnas
--       (youtube_urls y files) para nuevas partes
-- ==================================================================
-- FIN DE LA MIGRACIÓN
-- ==================================================================

