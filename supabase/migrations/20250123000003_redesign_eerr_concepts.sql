-- ============================================
-- Rediseño del sistema EERR con conceptos y sub-conceptos
-- ============================================
-- Nueva estructura: Conceptos principales con sub-conceptos
-- Cada concepto tiene una sumatoria total de sus sub-conceptos
-- ============================================

-- 1. TABLA DE CONCEPTOS PRINCIPALES
CREATE TABLE IF NOT EXISTS eerr_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_calculated boolean NOT NULL DEFAULT false, -- Si es true, es un concepto calculado (margen, etc.)
  calculation_type text CHECK (calculation_type IN (
    'sum',           -- Suma de conceptos anteriores
    'difference',    -- Diferencia entre conceptos
    'percentage'     -- Porcentaje de otro concepto
  )),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- 2. TABLA DE SUB-CONCEPTOS (items dentro de cada concepto)
CREATE TABLE IF NOT EXISTS eerr_sub_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES eerr_concepts(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. TABLA DE VALORES POR PERÍODO
CREATE TABLE IF NOT EXISTS eerr_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES eerr_statements(id) ON DELETE CASCADE,
  sub_concept_id uuid REFERENCES eerr_sub_concepts(id) ON DELETE CASCADE,
  concept_id uuid REFERENCES eerr_concepts(id) ON DELETE CASCADE, -- Para conceptos calculados sin sub-conceptos
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  value numeric(20, 10) NOT NULL DEFAULT 0, -- Aumentado precisión para evitar redondeo
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(statement_id, sub_concept_id, concept_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_eerr_concepts_tenant_order ON eerr_concepts(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_eerr_sub_concepts_concept ON eerr_sub_concepts(concept_id);
CREATE INDEX IF NOT EXISTS idx_eerr_sub_concepts_tenant ON eerr_sub_concepts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eerr_values_statement ON eerr_values(statement_id);
CREATE INDEX IF NOT EXISTS idx_eerr_values_sub_concept ON eerr_values(sub_concept_id);
CREATE INDEX IF NOT EXISTS idx_eerr_values_concept ON eerr_values(concept_id);
CREATE INDEX IF NOT EXISTS idx_eerr_values_tenant ON eerr_values(tenant_id);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS eerr_concepts_updated_at ON eerr_concepts;
CREATE TRIGGER eerr_concepts_updated_at
  BEFORE UPDATE ON eerr_concepts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS eerr_sub_concepts_updated_at ON eerr_sub_concepts;
CREATE TRIGGER eerr_sub_concepts_updated_at
  BEFORE UPDATE ON eerr_sub_concepts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS eerr_values_updated_at ON eerr_values;
CREATE TRIGGER eerr_values_updated_at
  BEFORE UPDATE ON eerr_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE eerr_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eerr_sub_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eerr_values ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para eerr_concepts
DROP POLICY IF EXISTS "Users can view eerr_concepts from their tenant" ON eerr_concepts;
CREATE POLICY "Users can view eerr_concepts from their tenant"
  ON eerr_concepts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert eerr_concepts for their tenant" ON eerr_concepts;
CREATE POLICY "Users can insert eerr_concepts for their tenant"
  ON eerr_concepts FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update eerr_concepts from their tenant" ON eerr_concepts;
CREATE POLICY "Users can update eerr_concepts from their tenant"
  ON eerr_concepts FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete eerr_concepts from their tenant" ON eerr_concepts;
CREATE POLICY "Users can delete eerr_concepts from their tenant"
  ON eerr_concepts FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para eerr_sub_concepts
DROP POLICY IF EXISTS "Users can view eerr_sub_concepts from their tenant" ON eerr_sub_concepts;
CREATE POLICY "Users can view eerr_sub_concepts from their tenant"
  ON eerr_sub_concepts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert eerr_sub_concepts for their tenant" ON eerr_sub_concepts;
CREATE POLICY "Users can insert eerr_sub_concepts for their tenant"
  ON eerr_sub_concepts FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update eerr_sub_concepts from their tenant" ON eerr_sub_concepts;
CREATE POLICY "Users can update eerr_sub_concepts from their tenant"
  ON eerr_sub_concepts FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete eerr_sub_concepts from their tenant" ON eerr_sub_concepts;
CREATE POLICY "Users can delete eerr_sub_concepts from their tenant"
  ON eerr_sub_concepts FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para eerr_values
DROP POLICY IF EXISTS "Users can view eerr_values from their tenant" ON eerr_values;
CREATE POLICY "Users can view eerr_values from their tenant"
  ON eerr_values FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert eerr_values for their tenant" ON eerr_values;
CREATE POLICY "Users can insert eerr_values for their tenant"
  ON eerr_values FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update eerr_values from their tenant" ON eerr_values;
CREATE POLICY "Users can update eerr_values from their tenant"
  ON eerr_values FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete eerr_values from their tenant" ON eerr_values;
CREATE POLICY "Users can delete eerr_values from their tenant"
  ON eerr_values FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));
