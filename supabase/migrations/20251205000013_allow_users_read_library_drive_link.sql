-- ==================================================================
-- Permitir que todos los usuarios lean el link de Google Drive de la biblioteca
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Los usuarios comunes pueden leer el link de Google Drive
--              pero solo los admins pueden modificarlo
-- ==================================================================

-- Política: Todos los usuarios autenticados pueden LEER el link de Google Drive
CREATE POLICY "Todos pueden leer library_google_drive_link"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (key = 'library_google_drive_link');

-- ==================================================================
-- FIN DE LA MIGRACIÓN
-- ==================================================================









