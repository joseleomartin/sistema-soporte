-- ============================================
-- Agregar usuario responsable de vencimientos a subforums
-- ============================================
-- Permite asignar un usuario que se encargará de todos los vencimientos de cada cliente
-- ============================================

ALTER TABLE subforums
  ADD COLUMN IF NOT EXISTS vencimientos_responsable_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subforums_vencimientos_responsable_id ON subforums(vencimientos_responsable_id);

COMMENT ON COLUMN subforums.vencimientos_responsable_id IS 'Usuario responsable de gestionar todos los vencimientos de este cliente';
