-- ============================================
-- Agregar campo is_affected_by_ipc a presupuesto_concepts
-- ============================================
-- Permite que cada concepto indique si está afectado por el IPC o no
-- ============================================

-- Agregar columna is_affected_by_ipc
ALTER TABLE presupuesto_concepts
ADD COLUMN IF NOT EXISTS is_affected_by_ipc boolean NOT NULL DEFAULT true;

-- Comentario en la columna
COMMENT ON COLUMN presupuesto_concepts.is_affected_by_ipc IS 'Indica si el concepto está afectado por el IPC. Si es false, el valor presupuestado no se ajusta con el IPC mensual.';
