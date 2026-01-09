-- ============================================
-- MIGRACIÓN: Agregar order_id a purchases_materials y purchases_products
-- ============================================
-- Agrega el campo order_id para agrupar múltiples productos/materiales en una sola orden de compra
-- ============================================

-- Agregar columna order_id a purchases_materials si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'order_id'
  ) THEN
    ALTER TABLE purchases_materials ADD COLUMN order_id uuid;
    RAISE NOTICE 'Columna order_id agregada a la tabla purchases_materials';
  ELSE
    RAISE NOTICE 'La columna order_id ya existe en la tabla purchases_materials';
  END IF;
END $$;

-- Agregar columna order_id a purchases_products si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'order_id'
  ) THEN
    ALTER TABLE purchases_products ADD COLUMN order_id uuid;
    RAISE NOTICE 'Columna order_id agregada a la tabla purchases_products';
  ELSE
    RAISE NOTICE 'La columna order_id ya existe en la tabla purchases_products';
  END IF;
END $$;

-- Crear índices para mejorar las consultas agrupadas
CREATE INDEX IF NOT EXISTS idx_purchases_materials_order_id ON purchases_materials(order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_products_order_id ON purchases_products(order_id);

-- Para las compras existentes sin order_id, crear un order_id único para cada una
-- (esto permite que las compras antiguas sigan funcionando)
UPDATE purchases_materials 
SET order_id = id 
WHERE order_id IS NULL;

UPDATE purchases_products 
SET order_id = id 
WHERE order_id IS NULL;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================







