-- ==================================================================
-- Modificar client_prices para hacer precios estáticos por cliente
-- ==================================================================
-- Fecha: 2025-12-06
-- Descripción: Modifica la tabla para que los precios sean estáticos
--              por cliente, sin depender del período de fechas
-- ==================================================================

-- Paso 1: Eliminar la restricción única antigua
ALTER TABLE client_prices 
DROP CONSTRAINT IF EXISTS unique_client_period;

-- Paso 2: Hacer las fechas opcionales (NULL permitido)
ALTER TABLE client_prices 
ALTER COLUMN start_date DROP NOT NULL,
ALTER COLUMN end_date DROP NOT NULL;

-- Paso 3: Actualizar registros existentes para tener solo el más reciente por cliente
-- Eliminar duplicados, manteniendo solo el más reciente (por updated_at o created_at)
-- IMPORTANTE: Esto debe hacerse ANTES de agregar la restricción única
DELETE FROM client_prices cp1
WHERE EXISTS (
  SELECT 1 FROM client_prices cp2
  WHERE cp2.client_id = cp1.client_id
  AND cp2.id != cp1.id
  AND (
    cp2.updated_at > cp1.updated_at
    OR (cp2.updated_at = cp1.updated_at AND cp2.created_at > cp1.created_at)
  )
);

-- Paso 4: Crear nueva restricción única solo por cliente
-- Esto asegura que solo haya un precio activo por cliente
ALTER TABLE client_prices 
ADD CONSTRAINT unique_client_price UNIQUE(client_id);

-- Paso 5: Actualizar comentarios
COMMENT ON TABLE client_prices IS 'Almacena los precios a cobrar estáticos configurados para cada cliente (independiente del período)';
COMMENT ON COLUMN client_prices.start_date IS 'Fecha de inicio del período (opcional, para referencia histórica)';
COMMENT ON COLUMN client_prices.end_date IS 'Fecha de fin del período (opcional, para referencia histórica)';
COMMENT ON COLUMN client_prices.price_to_charge IS 'Precio a cobrar estático configurado para este cliente';

-- ==================================================================
-- FIN DE LA MIGRACIÓN
-- ==================================================================

