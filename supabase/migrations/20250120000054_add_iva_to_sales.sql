-- ==================================================================
-- MIGRACIÓN: Agregar Campos de IVA a Ventas
-- ==================================================================
-- Fecha: 2025-01-20
-- Descripción: Agrega campos tiene_iva e iva_pct a sales
--              para controlar el IVA en las ventas
-- ==================================================================

-- ============================================
-- Agregar campos IVA a sales
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'tiene_iva'
  ) THEN
    ALTER TABLE sales 
    ADD COLUMN tiene_iva boolean DEFAULT false;
    
    COMMENT ON COLUMN sales.tiene_iva IS 'Indica si la venta tiene IVA aplicado';
    RAISE NOTICE 'Columna tiene_iva agregada a sales';
  ELSE
    RAISE NOTICE 'La columna tiene_iva ya existe en sales';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'iva_pct'
  ) THEN
    ALTER TABLE sales 
    ADD COLUMN iva_pct numeric(5,2) DEFAULT 21.00;
    
    COMMENT ON COLUMN sales.iva_pct IS 'Porcentaje de IVA aplicado (por defecto 21%)';
    RAISE NOTICE 'Columna iva_pct agregada a sales';
  ELSE
    RAISE NOTICE 'La columna iva_pct ya existe en sales';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================



