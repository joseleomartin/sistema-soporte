-- ============================================
-- MIGRACIÓN: Agregar localidad y condicion_pago a clients
-- ============================================
-- Agrega las columnas localidad y condicion_pago a la tabla clients
-- ============================================

-- Agregar columna localidad si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'localidad'
  ) THEN
    ALTER TABLE clients ADD COLUMN localidad text;
    RAISE NOTICE 'Columna localidad agregada a la tabla clients';
  ELSE
    RAISE NOTICE 'La columna localidad ya existe en la tabla clients';
  END IF;
END $$;

-- Agregar columna condicion_pago si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'clients' 
    AND column_name = 'condicion_pago'
  ) THEN
    ALTER TABLE clients ADD COLUMN condicion_pago text;
    RAISE NOTICE 'Columna condicion_pago agregada a la tabla clients';
  ELSE
    RAISE NOTICE 'La columna condicion_pago ya existe en la tabla clients';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

