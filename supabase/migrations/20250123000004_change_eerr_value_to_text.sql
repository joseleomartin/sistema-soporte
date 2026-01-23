-- ==================================================================
-- MIGRACIÓN: Cambiar tipo de columna value a text para preservar precisión exacta
-- ==================================================================
-- Fecha: 2025-01-23
-- Descripción: Cambia la columna value de numeric a text para preservar
--              exactamente todos los decimales tal como se ingresan
-- ==================================================================

-- Cambiar la columna value de numeric(20,10) a text
-- Primero convertir los valores existentes a texto preservando todos los decimales
DO $$
BEGIN
  -- Verificar si la columna existe y es numeric
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'eerr_values' 
    AND column_name = 'value'
    AND data_type = 'numeric'
  ) THEN
    -- Agregar columna temporal para almacenar valores como texto
    ALTER TABLE eerr_values ADD COLUMN IF NOT EXISTS value_text text;
    
    -- Copiar valores existentes a texto preservando precisión
    UPDATE eerr_values 
    SET value_text = value::text
    WHERE value_text IS NULL;
    
    -- Eliminar columna numeric antigua
    ALTER TABLE eerr_values DROP COLUMN value;
    
    -- Renombrar columna text a value
    ALTER TABLE eerr_values RENAME COLUMN value_text TO value;
    
    -- Agregar constraint para validar que sea un número válido
    ALTER TABLE eerr_values 
    ADD CONSTRAINT eerr_values_value_is_numeric 
    CHECK (value ~ '^-?[0-9]+(\.[0-9]+)?$');
    
    RAISE NOTICE 'Columna value cambiada de numeric a text para preservar precisión exacta';
  END IF;
END $$;
