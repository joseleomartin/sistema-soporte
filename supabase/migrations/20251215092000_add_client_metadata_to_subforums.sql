-- ============================================
-- Agregar metadatos de cliente a subforums
-- ============================================
-- Nuevos campos:
--  - cuit
--  - email
--  - access_keys (claves de acceso / portales)
--  - economic_link (vinculación económica)
--  - contact_full_name (nombre y apellido de contacto)
--  - client_type (tipo de cliente)
-- ============================================

ALTER TABLE subforums
  ADD COLUMN IF NOT EXISTS cuit text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS access_keys text,
  ADD COLUMN IF NOT EXISTS economic_link text,
  ADD COLUMN IF NOT EXISTS contact_full_name text,
  ADD COLUMN IF NOT EXISTS client_type text;

COMMENT ON COLUMN subforums.cuit IS 'CUIT del cliente';
COMMENT ON COLUMN subforums.email IS 'Email principal del cliente';
COMMENT ON COLUMN subforums.access_keys IS 'Claves de acceso o credenciales relevantes (texto libre, uso interno)';
COMMENT ON COLUMN subforums.economic_link IS 'Información de vinculación económica / relación con otros contribuyentes';
COMMENT ON COLUMN subforums.contact_full_name IS 'Nombre y apellido del contacto principal';
COMMENT ON COLUMN subforums.client_type IS 'Tipo de cliente (por ejemplo: Monotributista, Responsable Inscripto, Empresa, etc.)';







