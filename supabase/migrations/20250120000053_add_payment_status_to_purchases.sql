-- ==================================================================
-- MIGRACIÓN: Agregar Estado de Pago Separado a Compras
-- ==================================================================
-- Fecha: 2025-01-05
-- Descripción: Agrega campo pagado (boolean) para separar el estado
--              de recepción (estado) del estado de pago (pagado)
-- ==================================================================

-- ============================================
-- 1. Agregar columna pagado a purchases_materials
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'pagado'
  ) THEN
    ALTER TABLE purchases_materials 
    ADD COLUMN pagado boolean DEFAULT false;
    
    COMMENT ON COLUMN purchases_materials.pagado IS 'Indica si la compra está pagada (true) o impaga (false)';
    RAISE NOTICE 'Columna pagado agregada a purchases_materials';
  ELSE
    RAISE NOTICE 'La columna pagado ya existe en purchases_materials';
  END IF;
END $$;

-- ============================================
-- 2. Agregar columna pagado a purchases_products
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'pagado'
  ) THEN
    ALTER TABLE purchases_products 
    ADD COLUMN pagado boolean DEFAULT false;
    
    COMMENT ON COLUMN purchases_products.pagado IS 'Indica si la compra está pagada (true) o impaga (false)';
    RAISE NOTICE 'Columna pagado agregada a purchases_products';
  ELSE
    RAISE NOTICE 'La columna pagado ya existe en purchases_products';
  END IF;
END $$;

-- ============================================
-- 3. Actualizar compras existentes
-- ============================================
-- Si una compra tiene estado 'pagado', marcar pagado = true y cambiar estado a 'recibido'
UPDATE purchases_materials 
SET pagado = true, estado = 'recibido'
WHERE estado = 'pagado';

UPDATE purchases_products 
SET pagado = true, estado = 'recibido'
WHERE estado = 'pagado';

-- Actualizar el constraint del estado para remover 'pagado'
DO $$
BEGIN
  -- Para purchases_materials
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'purchases_materials_estado_check'
    AND table_name = 'purchases_materials'
  ) THEN
    ALTER TABLE purchases_materials DROP CONSTRAINT purchases_materials_estado_check;
  END IF;
  ALTER TABLE purchases_materials 
  ADD CONSTRAINT purchases_materials_estado_check CHECK (estado IN ('pendiente', 'recibido'));
  
  -- Para purchases_products
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'purchases_products_estado_check'
    AND table_name = 'purchases_products'
  ) THEN
    ALTER TABLE purchases_products DROP CONSTRAINT purchases_products_estado_check;
  END IF;
  ALTER TABLE purchases_products 
  ADD CONSTRAINT purchases_products_estado_check CHECK (estado IN ('pendiente', 'recibido'));
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

