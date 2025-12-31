-- ============================================
-- MIGRACIÓN: Agregar order_id a sales
-- ============================================
-- Agrega el campo order_id para agrupar múltiples productos en una sola orden de venta
-- ============================================

-- Agregar columna order_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'order_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN order_id uuid;
    RAISE NOTICE 'Columna order_id agregada a la tabla sales';
  ELSE
    RAISE NOTICE 'La columna order_id ya existe en la tabla sales';
  END IF;
END $$;

-- Crear índice para mejorar las consultas agrupadas
CREATE INDEX IF NOT EXISTS idx_sales_order_id ON sales(order_id);

-- Para las ventas existentes sin order_id, crear un order_id único para cada una
-- (esto permite que las ventas antiguas sigan funcionando)
UPDATE sales 
SET order_id = id 
WHERE order_id IS NULL;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================


