-- ============================================
-- MIGRACIÓN: Agregar campo cliente a sales
-- ============================================
-- Agrega el campo cliente (text) a la tabla sales para asociar ventas con clientes
-- ============================================

-- Agregar columna cliente si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'cliente'
  ) THEN
    ALTER TABLE sales ADD COLUMN cliente text;
    RAISE NOTICE 'Columna cliente agregada a la tabla sales';
  ELSE
    RAISE NOTICE 'La columna cliente ya existe en la tabla sales';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================



