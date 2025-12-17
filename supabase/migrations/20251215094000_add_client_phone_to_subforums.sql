-- ============================================
-- Agregar teléfono de contacto a subforums
-- ============================================

ALTER TABLE subforums
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN subforums.phone IS 'Teléfono de contacto principal del cliente';



