-- ============================================
-- Agregar campo para tipos de vencimientos a subforums
-- ============================================
-- Este campo almacena un array de tipos de vencimientos que aplican al cliente
-- Los tipos posibles son: Autónomos, Monotributo, IVA, Ingresos Brutos, 
-- Relación de Dependencia, Servicio Doméstico, Personas Humanas, 
-- Personas Jurídicas, Retenciones
-- ============================================

ALTER TABLE subforums
  ADD COLUMN IF NOT EXISTS vencimientos_tipos text[] DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN subforums.vencimientos_tipos IS 'Array de tipos de vencimientos que aplican al cliente (ej: Autónomos, Monotributo, IVA, etc.)';

-- Índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_subforums_vencimientos_tipos ON subforums USING gin(vencimientos_tipos);
