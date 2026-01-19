-- ============================================
-- MIGRACIÓN: Agregar codigo_producto a resale_products
-- ============================================

-- Añadir columna codigo_producto a resale_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'resale_products' 
    AND column_name = 'codigo_producto'
  ) THEN
    ALTER TABLE resale_products
    ADD COLUMN codigo_producto text;
    
    COMMENT ON COLUMN resale_products.codigo_producto IS 'Código único del producto para identificación e importación masiva';
    
    -- Crear índice para búsquedas rápidas por código
    CREATE INDEX IF NOT EXISTS idx_resale_products_codigo_producto ON resale_products(tenant_id, codigo_producto);
    
    RAISE NOTICE 'Columna codigo_producto agregada a resale_products';
  ELSE
    RAISE NOTICE 'La columna codigo_producto ya existe en resale_products';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
