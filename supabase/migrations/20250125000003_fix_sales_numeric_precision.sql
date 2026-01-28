-- ==================================================================
-- MIGRACIÓN: Aumentar Precisión de Campos Numéricos en Ventas
-- ==================================================================
-- Fecha: 2025-01-25
-- Descripción: Aumenta la precisión de los campos numéricos en sales
--              para evitar errores de "numeric field overflow"
--              cuando se registran valores muy grandes
-- ==================================================================

-- ============================================
-- Aumentar precisión en tabla sales
-- ============================================
DO $$
BEGIN
  -- Verificar y modificar cantidad
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'cantidad'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN cantidad TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de cantidad aumentada en sales';
  END IF;

  -- Verificar y modificar precio_unitario
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'precio_unitario'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN precio_unitario TYPE numeric(30,2);
    RAISE NOTICE 'Precisión de precio_unitario aumentada en sales';
  END IF;

  -- Verificar y modificar descuento_pct
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'descuento_pct'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN descuento_pct TYPE numeric(10,4);
    RAISE NOTICE 'Precisión de descuento_pct aumentada en sales';
  END IF;

  -- Verificar y modificar iib_pct
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'iib_pct'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN iib_pct TYPE numeric(10,4);
    RAISE NOTICE 'Precisión de iib_pct aumentada en sales';
  END IF;

  -- Verificar y modificar precio_final
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'precio_final'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN precio_final TYPE numeric(30,2);
    RAISE NOTICE 'Precisión de precio_final aumentada en sales';
  END IF;

  -- Verificar y modificar costo_unitario
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'costo_unitario'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN costo_unitario TYPE numeric(30,2);
    RAISE NOTICE 'Precisión de costo_unitario aumentada en sales';
  END IF;

  -- Verificar y modificar ingreso_bruto
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'ingreso_bruto'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN ingreso_bruto TYPE numeric(30,2);
    RAISE NOTICE 'Precisión de ingreso_bruto aumentada en sales';
  END IF;

  -- Verificar y modificar ingreso_neto
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'ingreso_neto'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN ingreso_neto TYPE numeric(30,2);
    RAISE NOTICE 'Precisión de ingreso_neto aumentada en sales';
  END IF;

  -- Verificar y modificar ganancia_un
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'ganancia_un'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN ganancia_un TYPE numeric(30,2);
    RAISE NOTICE 'Precisión de ganancia_un aumentada en sales';
  END IF;

  -- Verificar y modificar ganancia_total
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'ganancia_total'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN ganancia_total TYPE numeric(30,2);
    RAISE NOTICE 'Precisión de ganancia_total aumentada en sales';
  END IF;

  -- Verificar y modificar stock_antes
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'stock_antes'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN stock_antes TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de stock_antes aumentada en sales';
  END IF;

  -- Verificar y modificar stock_despues
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'stock_despues'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN stock_despues TYPE numeric(18,2);
    RAISE NOTICE 'Precisión de stock_despues aumentada en sales';
  END IF;

  -- Verificar y modificar iva_pct (si existe)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'iva_pct'
  ) THEN
    ALTER TABLE sales 
    ALTER COLUMN iva_pct TYPE numeric(10,4);
    RAISE NOTICE 'Precisión de iva_pct aumentada en sales';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
