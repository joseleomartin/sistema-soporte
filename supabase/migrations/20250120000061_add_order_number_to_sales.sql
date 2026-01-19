-- ============================================
-- MIGRACIÓN: Agregar order_number secuencial a sales
-- ============================================
-- Agrega un campo order_number para numeración secuencial (001, 002, etc.)
-- ============================================

-- Agregar columna order_number si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'order_number'
  ) THEN
    ALTER TABLE sales ADD COLUMN order_number integer;
    
    COMMENT ON COLUMN sales.order_number IS 'Número secuencial de orden de venta (001, 002, etc.) por tenant';
    
    -- Crear índice para mejorar las consultas
    CREATE INDEX IF NOT EXISTS idx_sales_order_number ON sales(tenant_id, order_number);
    
    RAISE NOTICE 'Columna order_number agregada a sales';
  ELSE
    RAISE NOTICE 'La columna order_number ya existe en sales';
  END IF;
END $$;

-- Función para obtener el siguiente número de orden por tenant
CREATE OR REPLACE FUNCTION get_next_order_number(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_number integer;
BEGIN
  -- Obtener el máximo order_number para este tenant
  SELECT COALESCE(MAX(order_number), 0) + 1
  INTO v_next_number
  FROM sales
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_next_number;
END;
$$;

COMMENT ON FUNCTION get_next_order_number IS 'Obtiene el siguiente número secuencial de orden de venta para un tenant';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
