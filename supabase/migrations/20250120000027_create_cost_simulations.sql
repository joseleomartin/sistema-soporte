-- ============================================
-- TABLA PARA SIMULACIONES DE COSTOS
-- ============================================

-- Tabla para guardar simulaciones de costos
CREATE TABLE IF NOT EXISTS cost_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla para guardar items de simulación de costos
CREATE TABLE IF NOT EXISTS cost_simulation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES cost_simulations(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  precio_venta decimal(10,2) NOT NULL DEFAULT 0,
  descuento_pct decimal(5,2) NOT NULL DEFAULT 0,
  cantidad_fabricar integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cost_simulations_tenant ON cost_simulations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_simulation_items_simulation ON cost_simulation_items(simulation_id);
CREATE INDEX IF NOT EXISTS idx_cost_simulation_items_product ON cost_simulation_items(product_id);

-- RLS Policies
ALTER TABLE cost_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_simulation_items ENABLE ROW LEVEL SECURITY;

-- Políticas para cost_simulations
CREATE POLICY "Users can view their tenant's cost simulations"
  ON cost_simulations FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their tenant's cost simulations"
  ON cost_simulations FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their tenant's cost simulations"
  ON cost_simulations FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their tenant's cost simulations"
  ON cost_simulations FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Políticas para cost_simulation_items
CREATE POLICY "Users can view their tenant's cost simulation items"
  ON cost_simulation_items FOR SELECT
  USING (
    simulation_id IN (
      SELECT id FROM cost_simulations 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert their tenant's cost simulation items"
  ON cost_simulation_items FOR INSERT
  WITH CHECK (
    simulation_id IN (
      SELECT id FROM cost_simulations 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update their tenant's cost simulation items"
  ON cost_simulation_items FOR UPDATE
  USING (
    simulation_id IN (
      SELECT id FROM cost_simulations 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete their tenant's cost simulation items"
  ON cost_simulation_items FOR DELETE
  USING (
    simulation_id IN (
      SELECT id FROM cost_simulations 
      WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    )
  );







