-- ==================================================================
-- MIGRACIÓN: Aumentar Precisión de Campos Numéricos en Compras
-- ==================================================================
-- Fecha: 2025-01-05
-- Descripción: Aumenta la precisión de los campos numéricos en purchases_materials
--              y purchases_products para evitar errores de "numeric field overflow"
-- ==================================================================

-- ============================================
-- 1. Aumentar precisión en purchases_materials
-- ============================================
DO $$
BEGIN
  -- Verificar y modificar cantidad
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'cantidad'
  ) THEN
    ALTER TABLE purchases_materials 
    ALTER COLUMN cantidad TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de cantidad aumentada en purchases_materials';
  END IF;

  -- Verificar y modificar precio
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'precio'
  ) THEN
    ALTER TABLE purchases_materials 
    ALTER COLUMN precio TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de precio aumentada en purchases_materials';
  END IF;

  -- Verificar y modificar valor_dolar
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'valor_dolar'
  ) THEN
    ALTER TABLE purchases_materials 
    ALTER COLUMN valor_dolar TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de valor_dolar aumentada en purchases_materials';
  END IF;

  -- Verificar y modificar total
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'total'
  ) THEN
    ALTER TABLE purchases_materials 
    ALTER COLUMN total TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de total aumentada en purchases_materials';
  END IF;
END $$;

-- ============================================
-- 2. Aumentar precisión en purchases_products
-- ============================================
DO $$
BEGIN
  -- Verificar y modificar cantidad
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'cantidad'
  ) THEN
    ALTER TABLE purchases_products 
    ALTER COLUMN cantidad TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de cantidad aumentada en purchases_products';
  END IF;

  -- Verificar y modificar precio
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'precio'
  ) THEN
    ALTER TABLE purchases_products 
    ALTER COLUMN precio TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de precio aumentada en purchases_products';
  END IF;

  -- Verificar y modificar valor_dolar
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'valor_dolar'
  ) THEN
    ALTER TABLE purchases_products 
    ALTER COLUMN valor_dolar TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de valor_dolar aumentada en purchases_products';
  END IF;

  -- Verificar y modificar total
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'total'
  ) THEN
    ALTER TABLE purchases_products 
    ALTER COLUMN total TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de total aumentada en purchases_products';
  END IF;
END $$;

-- ============================================
-- 3. Aumentar precisión en purchase_reception_items
-- ============================================
DO $$
BEGIN
  -- Verificar y modificar cantidad_esperada
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_reception_items' 
    AND column_name = 'cantidad_esperada'
  ) THEN
    ALTER TABLE purchase_reception_items 
    ALTER COLUMN cantidad_esperada TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de cantidad_esperada aumentada en purchase_reception_items';
  END IF;

  -- Verificar y modificar cantidad_recibida
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchase_reception_items' 
    AND column_name = 'cantidad_recibida'
  ) THEN
    ALTER TABLE purchase_reception_items 
    ALTER COLUMN cantidad_recibida TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de cantidad_recibida aumentada en purchase_reception_items';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================










