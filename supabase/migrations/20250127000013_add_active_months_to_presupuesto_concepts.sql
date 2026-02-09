-- ============================================
-- Agregar campo active_months a presupuesto_concepts
-- ============================================
-- Permite que cada concepto indique en qué meses del año impacta
-- Si es NULL o vacío, se asume que impacta en todos los meses (comportamiento por defecto)
-- ============================================

-- Agregar columna active_months como array de enteros (meses 1-12)
ALTER TABLE presupuesto_concepts
ADD COLUMN IF NOT EXISTS active_months integer[] DEFAULT NULL;

-- Comentario en la columna
COMMENT ON COLUMN presupuesto_concepts.active_months IS 'Array de meses (1-12) en los que el concepto está activo. Si es NULL o vacío, se aplica a todos los meses del año.';

-- Crear función para validar que los meses estén entre 1 y 12
CREATE OR REPLACE FUNCTION validate_active_months(months integer[])
RETURNS boolean AS $$
BEGIN
  -- Si es NULL o vacío, es válido
  IF months IS NULL OR array_length(months, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  -- Validar que todos los valores estén entre 1 y 12
  RETURN NOT EXISTS (
    SELECT 1 FROM unnest(months) AS m 
    WHERE m < 1 OR m > 12
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Agregar constraint usando la función de validación
ALTER TABLE presupuesto_concepts
ADD CONSTRAINT check_active_months_range 
CHECK (validate_active_months(active_months));
