-- ==================================================================
-- MIGRACIÓN: Agregar Campos de IVA a Compras
-- ==================================================================
-- Fecha: 2025-01-05
-- Descripción: Agrega campos tiene_iva e iva_pct a purchases_materials
--              y purchases_products para controlar el IVA en las compras
-- ==================================================================

-- ============================================
-- 1. Agregar campos IVA a purchases_materials
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'tiene_iva'
  ) THEN
    ALTER TABLE purchases_materials 
    ADD COLUMN tiene_iva boolean DEFAULT false;
    
    COMMENT ON COLUMN purchases_materials.tiene_iva IS 'Indica si el material tiene IVA aplicado';
    RAISE NOTICE 'Columna tiene_iva agregada a purchases_materials';
  ELSE
    RAISE NOTICE 'La columna tiene_iva ya existe en purchases_materials';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'iva_pct'
  ) THEN
    ALTER TABLE purchases_materials 
    ADD COLUMN iva_pct numeric(5,2) DEFAULT 21.00;
    
    COMMENT ON COLUMN purchases_materials.iva_pct IS 'Porcentaje de IVA aplicado (por defecto 21%)';
    RAISE NOTICE 'Columna iva_pct agregada a purchases_materials';
  ELSE
    RAISE NOTICE 'La columna iva_pct ya existe en purchases_materials';
  END IF;
END $$;

-- ============================================
-- 2. Agregar campos IVA a purchases_products
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'tiene_iva'
  ) THEN
    ALTER TABLE purchases_products 
    ADD COLUMN tiene_iva boolean DEFAULT false;
    
    COMMENT ON COLUMN purchases_products.tiene_iva IS 'Indica si el producto tiene IVA aplicado';
    RAISE NOTICE 'Columna tiene_iva agregada a purchases_products';
  ELSE
    RAISE NOTICE 'La columna tiene_iva ya existe en purchases_products';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'iva_pct'
  ) THEN
    ALTER TABLE purchases_products 
    ADD COLUMN iva_pct numeric(5,2) DEFAULT 21.00;
    
    COMMENT ON COLUMN purchases_products.iva_pct IS 'Porcentaje de IVA aplicado (por defecto 21%)';
    RAISE NOTICE 'Columna iva_pct agregada a purchases_products';
  ELSE
    RAISE NOTICE 'La columna iva_pct ya existe en purchases_products';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================





