-- ==================================================================
-- Agregar configuración de Google Drive para biblioteca
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Permite configurar un link único de Google Drive
--              para mostrar en la biblioteca
-- ==================================================================

-- Insertar o actualizar el link de Google Drive de la biblioteca
INSERT INTO app_settings (key, value, description)
VALUES (
  'library_google_drive_link',
  '',
  'Link de Google Drive para mostrar en la biblioteca. Debe ser un link a una carpeta.'
)
ON CONFLICT (key) DO UPDATE 
SET 
  description = EXCLUDED.description,
  updated_at = NOW();

-- ==================================================================
-- FIN DE LA MIGRACIÓN
-- ==================================================================



