-- ============================================
-- Sistema de Cash Flow (Flujo de Caja)
-- ============================================
-- Permite a los usuarios crear planificaciones financieras semanales
-- con disponibilidades, ingresos y egresos configurables por día
-- ============================================

-- 1. TABLA DE PLANIFICACIONES SEMANALES
CREATE TABLE IF NOT EXISTS cashflow_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Planificación Financiera',
  start_date date NOT NULL, -- Fecha de inicio de la semana (lunes)
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, start_date)
);

-- 2. TABLA DE CATEGORÍAS (Disponibilidades, Ingresos, Egresos)
CREATE TABLE IF NOT EXISTS cashflow_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category_type text NOT NULL CHECK (category_type IN (
    'disponibilidades',  -- Disponibilidades al inicio del día
    'ingresos',          -- Ingresos corrientes y extraordinarios
    'egresos'            -- Egresos corrientes
  )),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name, category_type)
);

-- 3. TABLA DE SUB-ITEMS (items dentro de cada categoría)
CREATE TABLE IF NOT EXISTS cashflow_sub_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES cashflow_categories(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. TABLA DE VALORES POR DÍA
CREATE TABLE IF NOT EXISTS cashflow_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES cashflow_weeks(id) ON DELETE CASCADE,
  sub_item_id uuid REFERENCES cashflow_sub_items(id) ON DELETE CASCADE,
  category_id uuid REFERENCES cashflow_categories(id) ON DELETE CASCADE, -- Para valores directos de categoría
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=lunes, 6=domingo
  value numeric(20, 10) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, sub_item_id, category_id, day_of_week)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cashflow_weeks_tenant ON cashflow_weeks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_weeks_start_date ON cashflow_weeks(start_date);
CREATE INDEX IF NOT EXISTS idx_cashflow_categories_tenant ON cashflow_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_categories_type ON cashflow_categories(category_type);
CREATE INDEX IF NOT EXISTS idx_cashflow_categories_order ON cashflow_categories(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_cashflow_sub_items_category ON cashflow_sub_items(category_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_sub_items_tenant ON cashflow_sub_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_values_week ON cashflow_values(week_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_values_sub_item ON cashflow_values(sub_item_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_values_category ON cashflow_values(category_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_values_day ON cashflow_values(day_of_week);
CREATE INDEX IF NOT EXISTS idx_cashflow_values_tenant ON cashflow_values(tenant_id);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS cashflow_weeks_updated_at ON cashflow_weeks;
CREATE TRIGGER cashflow_weeks_updated_at
  BEFORE UPDATE ON cashflow_weeks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cashflow_categories_updated_at ON cashflow_categories;
CREATE TRIGGER cashflow_categories_updated_at
  BEFORE UPDATE ON cashflow_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cashflow_sub_items_updated_at ON cashflow_sub_items;
CREATE TRIGGER cashflow_sub_items_updated_at
  BEFORE UPDATE ON cashflow_sub_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cashflow_values_updated_at ON cashflow_values;
CREATE TRIGGER cashflow_values_updated_at
  BEFORE UPDATE ON cashflow_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE cashflow_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_sub_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_values ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cashflow_weeks
DROP POLICY IF EXISTS "Users can view cashflow_weeks from their tenant" ON cashflow_weeks;
CREATE POLICY "Users can view cashflow_weeks from their tenant"
  ON cashflow_weeks FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert cashflow_weeks for their tenant" ON cashflow_weeks;
CREATE POLICY "Users can insert cashflow_weeks for their tenant"
  ON cashflow_weeks FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update cashflow_weeks from their tenant" ON cashflow_weeks;
CREATE POLICY "Users can update cashflow_weeks from their tenant"
  ON cashflow_weeks FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete cashflow_weeks from their tenant" ON cashflow_weeks;
CREATE POLICY "Users can delete cashflow_weeks from their tenant"
  ON cashflow_weeks FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para cashflow_categories
DROP POLICY IF EXISTS "Users can view cashflow_categories from their tenant" ON cashflow_categories;
CREATE POLICY "Users can view cashflow_categories from their tenant"
  ON cashflow_categories FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert cashflow_categories for their tenant" ON cashflow_categories;
CREATE POLICY "Users can insert cashflow_categories for their tenant"
  ON cashflow_categories FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update cashflow_categories from their tenant" ON cashflow_categories;
CREATE POLICY "Users can update cashflow_categories from their tenant"
  ON cashflow_categories FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete cashflow_categories from their tenant" ON cashflow_categories;
CREATE POLICY "Users can delete cashflow_categories from their tenant"
  ON cashflow_categories FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para cashflow_sub_items
DROP POLICY IF EXISTS "Users can view cashflow_sub_items from their tenant" ON cashflow_sub_items;
CREATE POLICY "Users can view cashflow_sub_items from their tenant"
  ON cashflow_sub_items FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert cashflow_sub_items for their tenant" ON cashflow_sub_items;
CREATE POLICY "Users can insert cashflow_sub_items for their tenant"
  ON cashflow_sub_items FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update cashflow_sub_items from their tenant" ON cashflow_sub_items;
CREATE POLICY "Users can update cashflow_sub_items from their tenant"
  ON cashflow_sub_items FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete cashflow_sub_items from their tenant" ON cashflow_sub_items;
CREATE POLICY "Users can delete cashflow_sub_items from their tenant"
  ON cashflow_sub_items FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para cashflow_values
DROP POLICY IF EXISTS "Users can view cashflow_values from their tenant" ON cashflow_values;
CREATE POLICY "Users can view cashflow_values from their tenant"
  ON cashflow_values FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert cashflow_values for their tenant" ON cashflow_values;
CREATE POLICY "Users can insert cashflow_values for their tenant"
  ON cashflow_values FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update cashflow_values from their tenant" ON cashflow_values;
CREATE POLICY "Users can update cashflow_values from their tenant"
  ON cashflow_values FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete cashflow_values from their tenant" ON cashflow_values;
CREATE POLICY "Users can delete cashflow_values from their tenant"
  ON cashflow_values FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));
