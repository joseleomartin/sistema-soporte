-- ============================================
-- Optimizar índices para consultas de vencimientos
-- ============================================
-- Índice compuesto para mejorar consultas que filtran por tenant_id y hoja_nombre
-- ============================================

-- Índice compuesto para consultas comunes: tenant_id + hoja_nombre
CREATE INDEX IF NOT EXISTS idx_vencimientos_tenant_hoja 
  ON vencimientos(tenant_id, hoja_nombre);

-- Comentario
COMMENT ON INDEX idx_vencimientos_tenant_hoja IS 
  'Índice compuesto para optimizar consultas que filtran por tenant_id y hoja_nombre simultáneamente';
