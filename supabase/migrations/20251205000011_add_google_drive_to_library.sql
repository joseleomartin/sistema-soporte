-- ==================================================================
-- Agregar soporte para Google Drive en documentos de biblioteca
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Permite vincular documentos de biblioteca con carpetas
--              de Google Drive en lugar de subir archivos
-- ==================================================================

-- Agregar columnas para Google Drive
ALTER TABLE library_courses 
ADD COLUMN IF NOT EXISTS google_drive_link TEXT,
ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- Crear índice para búsquedas por folder ID
CREATE INDEX IF NOT EXISTS idx_library_courses_google_drive_folder_id 
ON library_courses(google_drive_folder_id) 
WHERE google_drive_folder_id IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN library_courses.google_drive_link IS 'Link completo de Google Drive a la carpeta';
COMMENT ON COLUMN library_courses.google_drive_folder_id IS 'ID de la carpeta de Google Drive extraído del link';

-- ==================================================================
-- FIN DE LA MIGRACIÓN
-- ==================================================================



