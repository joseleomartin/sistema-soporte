-- ============================================
-- AGREGAR SOPORTE PARA DOCUMENTOS DE BIBLIOTECA
-- ============================================
-- Permite diferenciar entre cursos y documentos en library_courses
-- ============================================

-- 1. Agregar columna type para diferenciar cursos de documentos
-- ============================================
ALTER TABLE library_courses
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'course' CHECK (type IN ('course', 'document'));

-- 2. Actualizar registros existentes para que sean cursos
-- ============================================
UPDATE library_courses
SET type = 'course'
WHERE type IS NULL;

-- 3. Crear índice para búsquedas por tipo
-- ============================================
CREATE INDEX IF NOT EXISTS idx_library_courses_type ON library_courses(type);

-- 4. Comentarios
-- ============================================
COMMENT ON COLUMN library_courses.type IS 'Tipo de recurso: course (curso) o document (documento de biblioteca)';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Campo type agregado a library_courses
-- ✅ Índice creado para mejorar rendimiento
-- ✅ Registros existentes marcados como 'course'
-- ============================================






