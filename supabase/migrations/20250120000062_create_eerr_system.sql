-- ============================================
-- Sistema de EERR (Estado de Resultados)
-- ============================================
-- Permite a los usuarios crear estados de resultados personalizados
-- con items personalizables y cálculos automáticos de márgenes
-- ============================================

-- 1. TABLA DE ESTADOS DE RESULTADOS
CREATE TABLE IF NOT EXISTS eerr_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Estado de Resultados',
  period_year integer NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, period_year)
);

-- 2. TABLA DE ITEMS DEL ESTADO DE RESULTADOS
CREATE TABLE IF NOT EXISTS eerr_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES eerr_statements(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  value numeric(15, 2) NOT NULL DEFAULT 0,
  section text NOT NULL CHECK (section IN (
    'revenue',           -- Venta Netas
    'cogs',              -- COGS (Cost of Goods Sold)
    'commercial',        -- Equipo Comercial
    'operating',         -- Operativo
    'administration',    -- Administración
    'investments',        -- Inversiones
    'financial'          -- Resultados Financieros
  )),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. TABLA DE NOMBRES PERSONALIZADOS DE SECCIONES CALCULADAS
CREATE TABLE IF NOT EXISTS eerr_section_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  section_key text NOT NULL CHECK (section_key IN (
    'grossMargin',
    'commercialMargin',
    'operatingMargin',
    'netMargin',
    'investments',
    'ebitda',
    'financialResults',
    'result'
  )),
  custom_label text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, section_key)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_eerr_statements_tenant ON eerr_statements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eerr_statements_period ON eerr_statements(period_year);
CREATE INDEX IF NOT EXISTS idx_eerr_items_statement ON eerr_items(statement_id);
CREATE INDEX IF NOT EXISTS idx_eerr_items_tenant ON eerr_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eerr_items_section ON eerr_items(section);
CREATE INDEX IF NOT EXISTS idx_eerr_section_labels_tenant ON eerr_section_labels(tenant_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_eerr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eerr_statements_updated_at ON eerr_statements;
CREATE TRIGGER eerr_statements_updated_at
  BEFORE UPDATE ON eerr_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_eerr_updated_at();

DROP TRIGGER IF EXISTS eerr_items_updated_at ON eerr_items;
CREATE TRIGGER eerr_items_updated_at
  BEFORE UPDATE ON eerr_items
  FOR EACH ROW
  EXECUTE FUNCTION update_eerr_updated_at();

DROP TRIGGER IF EXISTS eerr_section_labels_updated_at ON eerr_section_labels;
CREATE TRIGGER eerr_section_labels_updated_at
  BEFORE UPDATE ON eerr_section_labels
  FOR EACH ROW
  EXECUTE FUNCTION update_eerr_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS
ALTER TABLE eerr_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE eerr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE eerr_section_labels ENABLE ROW LEVEL SECURITY;

-- Políticas para eerr_statements
DROP POLICY IF EXISTS "Users can view eerr_statements from their tenant" ON eerr_statements;
CREATE POLICY "Users can view eerr_statements from their tenant"
  ON eerr_statements FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create eerr_statements in their tenant" ON eerr_statements;
CREATE POLICY "Users can create eerr_statements in their tenant"
  ON eerr_statements FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update eerr_statements from their tenant" ON eerr_statements;
CREATE POLICY "Users can update eerr_statements from their tenant"
  ON eerr_statements FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete eerr_statements from their tenant" ON eerr_statements;
CREATE POLICY "Users can delete eerr_statements from their tenant"
  ON eerr_statements FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Políticas para eerr_items
DROP POLICY IF EXISTS "Users can view eerr_items from their tenant" ON eerr_items;
CREATE POLICY "Users can view eerr_items from their tenant"
  ON eerr_items FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create eerr_items in their tenant" ON eerr_items;
CREATE POLICY "Users can create eerr_items in their tenant"
  ON eerr_items FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update eerr_items from their tenant" ON eerr_items;
CREATE POLICY "Users can update eerr_items from their tenant"
  ON eerr_items FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete eerr_items from their tenant" ON eerr_items;
CREATE POLICY "Users can delete eerr_items from their tenant"
  ON eerr_items FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Políticas para eerr_section_labels
DROP POLICY IF EXISTS "Users can view eerr_section_labels from their tenant" ON eerr_section_labels;
CREATE POLICY "Users can view eerr_section_labels from their tenant"
  ON eerr_section_labels FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create eerr_section_labels in their tenant" ON eerr_section_labels;
CREATE POLICY "Users can create eerr_section_labels in their tenant"
  ON eerr_section_labels FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update eerr_section_labels from their tenant" ON eerr_section_labels;
CREATE POLICY "Users can update eerr_section_labels from their tenant"
  ON eerr_section_labels FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete eerr_section_labels from their tenant" ON eerr_section_labels;
CREATE POLICY "Users can delete eerr_section_labels from their tenant"
  ON eerr_section_labels FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
