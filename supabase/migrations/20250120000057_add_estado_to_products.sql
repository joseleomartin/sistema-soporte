-- ============================================
-- MIGRACIÓN: Agregar estado a products
-- ============================================

-- Añadir columna estado a products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'estado'
  ) THEN
    ALTER TABLE products
    ADD COLUMN estado text NOT NULL DEFAULT 'pendiente';
    
    ALTER TABLE products
    ADD CONSTRAINT products_estado_check CHECK (estado IN ('pendiente', 'completada'));
    
    COMMENT ON COLUMN products.estado IS 'Estado de la orden de producción: pendiente o completada';
    
    RAISE NOTICE 'Columna estado agregada a products';
  ELSE
    RAISE NOTICE 'La columna estado ya existe en products';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
