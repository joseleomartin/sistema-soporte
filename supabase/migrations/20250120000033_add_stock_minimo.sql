-- ============================================
-- Agregar campo de Stock Mínimo
-- ============================================
-- Agrega el campo stock_minimo a las tablas de stock
-- para definir la cantidad mínima de kilos o unidades
-- ============================================

-- Agregar stock_minimo a stock_materials (en kilos)
ALTER TABLE stock_materials
  ADD COLUMN IF NOT EXISTS stock_minimo decimal(10,2) DEFAULT 0;

COMMENT ON COLUMN stock_materials.stock_minimo IS 'Cantidad mínima de stock en kilos para materia prima';

-- Agregar stock_minimo a stock_products (en unidades)
ALTER TABLE stock_products
  ADD COLUMN IF NOT EXISTS stock_minimo integer DEFAULT 0;

COMMENT ON COLUMN stock_products.stock_minimo IS 'Cantidad mínima de stock en unidades para productos fabricados';

-- Agregar stock_minimo a resale_products (en unidades)
ALTER TABLE resale_products
  ADD COLUMN IF NOT EXISTS stock_minimo integer DEFAULT 0;

COMMENT ON COLUMN resale_products.stock_minimo IS 'Cantidad mínima de stock en unidades para productos de reventa';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================



