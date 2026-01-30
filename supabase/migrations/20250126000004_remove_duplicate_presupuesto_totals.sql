-- ============================================
-- Eliminar conceptos duplicados de presupuesto
-- ============================================
-- Elimina "Total Ingresos Operativos" y "Total Impuestos (No Incluye IVA)"
-- ya que son duplicados de "Ingresos Totales" y "Egresos Totales"
-- ============================================

-- Eliminar valores asociados a "Total Ingresos Operativos"
DELETE FROM presupuesto_values
WHERE concept_id IN (
  SELECT id FROM presupuesto_concepts
  WHERE name = 'Total Ingresos Operativos'
);

-- Eliminar valores asociados a "Total Impuestos (No Incluye IVA)"
DELETE FROM presupuesto_values
WHERE concept_id IN (
  SELECT id FROM presupuesto_concepts
  WHERE name = 'Total Impuestos (No Incluye IVA)'
);

-- Eliminar el concepto "Total Ingresos Operativos"
DELETE FROM presupuesto_concepts
WHERE name = 'Total Ingresos Operativos';

-- Eliminar el concepto "Total Impuestos (No Incluye IVA)"
DELETE FROM presupuesto_concepts
WHERE name = 'Total Impuestos (No Incluye IVA)';
