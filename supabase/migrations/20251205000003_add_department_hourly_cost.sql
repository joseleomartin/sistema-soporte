-- ==================================================================
-- Agregar campo de costo por hora a las áreas (departments)
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Agrega el campo hourly_cost a la tabla departments
--              para permitir calcular costos de clientes
-- ==================================================================

-- Agregar columna de costo por hora a departments
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS hourly_cost DECIMAL(10,2) DEFAULT 0;

-- Comentario en la columna
COMMENT ON COLUMN departments.hourly_cost IS 'Costo por hora del área para cálculo de costos de clientes';

-- Índice para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_departments_hourly_cost ON departments(hourly_cost) WHERE hourly_cost > 0;

-- ==================================================================
-- FIN DE LA MIGRACIÓN
-- ==================================================================







