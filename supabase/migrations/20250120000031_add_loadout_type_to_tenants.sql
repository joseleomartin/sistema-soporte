-- ============================================
-- Agregar campo loadout_type a tenants
-- ============================================
-- Este campo almacena el tipo de plantilla aplicada (servicios, produccion, personalizado)
-- ============================================

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS loadout_type text;

-- Comentario
COMMENT ON COLUMN tenants.loadout_type IS 'Tipo de plantilla aplicada: servicios, produccion, o null para personalizado';


