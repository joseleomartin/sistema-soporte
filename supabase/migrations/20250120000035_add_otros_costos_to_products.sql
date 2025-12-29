-- ============================================
-- MIGRACIÓN: Agregar otros_costos a products
-- ============================================

-- Añadir columna otros_costos a products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS otros_costos decimal(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN products.otros_costos IS 'Otros costos adicionales en ARS para el producto';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

