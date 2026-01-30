-- ============================================
-- Sistema de Presupuesto
-- ============================================
-- Permite a los usuarios crear presupuestos anuales con ingresos y egresos
-- que se ven afectados por el IPC (Índice de Precios al Consumidor) mensual
-- ============================================

-- 1. TABLA DE AÑOS DE PRESUPUESTO
CREATE TABLE IF NOT EXISTS presupuesto_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year integer NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, year)
);

-- 2. TABLA DE CONCEPTOS (Ingresos y Egresos)
CREATE TABLE IF NOT EXISTS presupuesto_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  concept_type text NOT NULL CHECK (concept_type IN (
    'ingreso',  -- Ingresos
    'egreso'    -- Egresos
  )),
  category text, -- Categoría opcional (ej: "Ingresos por Venta", "Sueldos", etc.)
  display_order integer NOT NULL DEFAULT 0,
  is_total boolean DEFAULT false, -- Para filas de totales
  parent_concept_id uuid REFERENCES presupuesto_concepts(id) ON DELETE SET NULL, -- Para agrupar conceptos
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name, concept_type)
);

-- 3. TABLA DE VALORES POR MES (Presupuesto y Real)
CREATE TABLE IF NOT EXISTS presupuesto_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES presupuesto_years(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES presupuesto_concepts(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  presupuesto numeric(20, 10) NOT NULL DEFAULT 0, -- Valor presupuestado
  real numeric(20, 10) DEFAULT NULL, -- Valor real (opcional)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year_id, concept_id, month)
);

-- 4. TABLA DE IPC POR MES/AÑO
CREATE TABLE IF NOT EXISTS presupuesto_ipc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES presupuesto_years(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  ipc_percentage numeric(10, 4) NOT NULL DEFAULT 0, -- Porcentaje de IPC (ej: 2.50 para 2.50%)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(year_id, month)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_presupuesto_years_tenant ON presupuesto_years(tenant_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_years_year ON presupuesto_years(year);
CREATE INDEX IF NOT EXISTS idx_presupuesto_concepts_tenant ON presupuesto_concepts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_concepts_type ON presupuesto_concepts(concept_type);
CREATE INDEX IF NOT EXISTS idx_presupuesto_concepts_order ON presupuesto_concepts(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_presupuesto_concepts_parent ON presupuesto_concepts(parent_concept_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_values_year ON presupuesto_values(year_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_values_concept ON presupuesto_values(concept_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_values_month ON presupuesto_values(month);
CREATE INDEX IF NOT EXISTS idx_presupuesto_values_tenant ON presupuesto_values(tenant_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_ipc_year ON presupuesto_ipc(year_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_ipc_month ON presupuesto_ipc(month);
CREATE INDEX IF NOT EXISTS idx_presupuesto_ipc_tenant ON presupuesto_ipc(tenant_id);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS presupuesto_years_updated_at ON presupuesto_years;
CREATE TRIGGER presupuesto_years_updated_at
  BEFORE UPDATE ON presupuesto_years
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS presupuesto_concepts_updated_at ON presupuesto_concepts;
CREATE TRIGGER presupuesto_concepts_updated_at
  BEFORE UPDATE ON presupuesto_concepts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS presupuesto_values_updated_at ON presupuesto_values;
CREATE TRIGGER presupuesto_values_updated_at
  BEFORE UPDATE ON presupuesto_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS presupuesto_ipc_updated_at ON presupuesto_ipc;
CREATE TRIGGER presupuesto_ipc_updated_at
  BEFORE UPDATE ON presupuesto_ipc
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE presupuesto_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_ipc ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para presupuesto_years
DROP POLICY IF EXISTS "Users can view presupuesto_years from their tenant" ON presupuesto_years;
CREATE POLICY "Users can view presupuesto_years from their tenant"
  ON presupuesto_years FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert presupuesto_years for their tenant" ON presupuesto_years;
CREATE POLICY "Users can insert presupuesto_years for their tenant"
  ON presupuesto_years FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update presupuesto_years from their tenant" ON presupuesto_years;
CREATE POLICY "Users can update presupuesto_years from their tenant"
  ON presupuesto_years FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete presupuesto_years from their tenant" ON presupuesto_years;
CREATE POLICY "Users can delete presupuesto_years from their tenant"
  ON presupuesto_years FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para presupuesto_concepts
DROP POLICY IF EXISTS "Users can view presupuesto_concepts from their tenant" ON presupuesto_concepts;
CREATE POLICY "Users can view presupuesto_concepts from their tenant"
  ON presupuesto_concepts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert presupuesto_concepts for their tenant" ON presupuesto_concepts;
CREATE POLICY "Users can insert presupuesto_concepts for their tenant"
  ON presupuesto_concepts FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update presupuesto_concepts from their tenant" ON presupuesto_concepts;
CREATE POLICY "Users can update presupuesto_concepts from their tenant"
  ON presupuesto_concepts FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete presupuesto_concepts from their tenant" ON presupuesto_concepts;
CREATE POLICY "Users can delete presupuesto_concepts from their tenant"
  ON presupuesto_concepts FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para presupuesto_values
DROP POLICY IF EXISTS "Users can view presupuesto_values from their tenant" ON presupuesto_values;
CREATE POLICY "Users can view presupuesto_values from their tenant"
  ON presupuesto_values FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert presupuesto_values for their tenant" ON presupuesto_values;
CREATE POLICY "Users can insert presupuesto_values for their tenant"
  ON presupuesto_values FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update presupuesto_values from their tenant" ON presupuesto_values;
CREATE POLICY "Users can update presupuesto_values from their tenant"
  ON presupuesto_values FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete presupuesto_values from their tenant" ON presupuesto_values;
CREATE POLICY "Users can delete presupuesto_values from their tenant"
  ON presupuesto_values FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para presupuesto_ipc
DROP POLICY IF EXISTS "Users can view presupuesto_ipc from their tenant" ON presupuesto_ipc;
CREATE POLICY "Users can view presupuesto_ipc from their tenant"
  ON presupuesto_ipc FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert presupuesto_ipc for their tenant" ON presupuesto_ipc;
CREATE POLICY "Users can insert presupuesto_ipc for their tenant"
  ON presupuesto_ipc FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update presupuesto_ipc from their tenant" ON presupuesto_ipc;
CREATE POLICY "Users can update presupuesto_ipc from their tenant"
  ON presupuesto_ipc FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete presupuesto_ipc from their tenant" ON presupuesto_ipc;
CREATE POLICY "Users can delete presupuesto_ipc from their tenant"
  ON presupuesto_ipc FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- ============================================
-- COMENTARIOS
-- ============================================
-- 1. El sistema permite crear presupuestos anuales con conceptos de ingresos y egresos
-- 2. Cada concepto tiene valores presupuestados por mes
-- 3. El IPC se configura por mes y se aplica acumulativamente a los valores presupuestados
-- 4. Los valores "Real" son opcionales y se pueden ingresar manualmente
-- 5. El sistema calcula automáticamente los totales y acumulados
-- ============================================
