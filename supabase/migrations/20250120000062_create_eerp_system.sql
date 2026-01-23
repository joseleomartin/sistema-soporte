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

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_eerr_statements_tenant ON eerr_statements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eerr_statements_period ON eerr_statements(period_year);
CREATE INDEX IF NOT EXISTS idx_eerr_items_statement ON eerr_items(statement_id);
CREATE INDEX IF NOT EXISTS idx_eerr_items_tenant ON eerr_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eerr_items_section ON eerr_items(section);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_eerr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER eerr_statements_updated_at
  BEFORE UPDATE ON eerr_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_eerr_updated_at();

CREATE TRIGGER eerr_items_updated_at
  BEFORE UPDATE ON eerr_items
  FOR EACH ROW
  EXECUTE FUNCTION update_eerr_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS
ALTER TABLE eerr_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE eerr_items ENABLE ROW LEVEL SECURITY;

-- Políticas para eerr_statements
CREATE POLICY "Users can view eerr_statements from their tenant"
  ON eerr_statements FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create eerr_statements in their tenant"
  ON eerr_statements FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update eerr_statements from their tenant"
  ON eerr_statements FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete eerr_statements from their tenant"
  ON eerr_statements FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Políticas para eerr_items
CREATE POLICY "Users can view eerr_items from their tenant"
  ON eerr_items FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create eerr_items in their tenant"
  ON eerr_items FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update eerr_items from their tenant"
  ON eerr_items FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete eerr_items from their tenant"
  ON eerr_items FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );
