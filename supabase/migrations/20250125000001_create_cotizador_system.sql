-- ============================================
-- Sistema de Cotizador
-- ============================================
-- Permite a los usuarios crear y gestionar cotizaciones con costos por mes
-- Incluye secciones: Servicios Profesionales, Pauta, Terceros, Gastos Logísticos, Costos Fijos
-- ============================================

-- 1. TABLA DE COTIZACIONES (datos de la oportunidad)
CREATE TABLE IF NOT EXISTS cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cliente text NOT NULL,
  proyecto text,
  fecha_cotizacion date,
  fecha_inicio_proyecto date,
  duracion_total_meses integer DEFAULT 12,
  precio_base_sin_iva numeric(30, 10) DEFAULT 0,
  fee_comercial_porcentaje numeric(10, 4) DEFAULT 0,
  precio_taquion_sin_iva numeric(30, 10) DEFAULT 0,
  precio_taquion_fee_sin_iva numeric(30, 10) DEFAULT 0,
  costo_financiero_porcentaje numeric(10, 4) DEFAULT 0,
  valor_factura_porcentaje numeric(10, 4) DEFAULT 1.21,
  incremental_iibb_recuperado numeric(30, 10) DEFAULT 0,
  margen_total_porcentaje numeric(10, 4) DEFAULT 0,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. TABLA DE SECCIONES DE COSTOS
CREATE TABLE IF NOT EXISTS cotizador_secciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  section_type text NOT NULL CHECK (section_type IN (
    'servicios_profesionales',
    'pauta',
    'terceros_integrados',
    'gastos_logisticos',
    'costos_fijos'
  )),
  markup_porcentaje numeric(10, 4) DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name, section_type)
);

-- 3. TABLA DE CONCEPTOS (detalles dentro de cada sección)
CREATE TABLE IF NOT EXISTS cotizador_conceptos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  seccion_id uuid NOT NULL REFERENCES cotizador_secciones(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  horas integer DEFAULT 0,
  precio_unitario numeric(30, 10) DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. TABLA DE VALORES POR MES (12 meses)
CREATE TABLE IF NOT EXISTS cotizador_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto_id uuid NOT NULL REFERENCES cotizador_conceptos(id) ON DELETE CASCADE,
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  value numeric(30, 10) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(concepto_id, month)
);

-- 5. TABLA DE PROVEEDORES (para sección de terceros)
CREATE TABLE IF NOT EXISTS cotizador_proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proveedor_type text NOT NULL CHECK (proveedor_type IN (
    'insights',
    'inspire',
    'ignite'
  )),
  value numeric(20, 10) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cotizacion_id, proveedor_type)
);

-- 6. TABLA DE GASTOS LOGÍSTICOS (viajes, alojamiento, viáticos, comidas)
CREATE TABLE IF NOT EXISTS cotizador_gastos_logisticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gasto_type text NOT NULL CHECK (gasto_type IN (
    'viajes',
    'alojamiento',
    'viaticos',
    'comidas'
  )),
  value numeric(20, 10) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cotizacion_id, gasto_type)
);

-- 7. TABLA DE COSTOS FIJOS
CREATE TABLE IF NOT EXISTS cotizador_costos_fijos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  overhead numeric(30, 10) DEFAULT 0,
  presupuesto_mkt_porcentaje numeric(10, 4) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cotizacion_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_cotizaciones_tenant ON cotizaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_created_by ON cotizaciones(created_by);
CREATE INDEX IF NOT EXISTS idx_cotizador_secciones_tenant ON cotizador_secciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_secciones_type ON cotizador_secciones(section_type);
CREATE INDEX IF NOT EXISTS idx_cotizador_conceptos_cotizacion ON cotizador_conceptos(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_conceptos_seccion ON cotizador_conceptos(seccion_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_conceptos_tenant ON cotizador_conceptos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_valores_concepto ON cotizador_valores(concepto_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_valores_cotizacion ON cotizador_valores(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_valores_month ON cotizador_valores(month);
CREATE INDEX IF NOT EXISTS idx_cotizador_valores_tenant ON cotizador_valores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_proveedores_cotizacion ON cotizador_proveedores(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_proveedores_tenant ON cotizador_proveedores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_gastos_logisticos_cotizacion ON cotizador_gastos_logisticos(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_gastos_logisticos_tenant ON cotizador_gastos_logisticos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_costos_fijos_cotizacion ON cotizador_costos_fijos(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_costos_fijos_tenant ON cotizador_costos_fijos(tenant_id);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS cotizaciones_updated_at ON cotizaciones;
CREATE TRIGGER cotizaciones_updated_at
  BEFORE UPDATE ON cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cotizador_secciones_updated_at ON cotizador_secciones;
CREATE TRIGGER cotizador_secciones_updated_at
  BEFORE UPDATE ON cotizador_secciones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cotizador_conceptos_updated_at ON cotizador_conceptos;
CREATE TRIGGER cotizador_conceptos_updated_at
  BEFORE UPDATE ON cotizador_conceptos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cotizador_valores_updated_at ON cotizador_valores;
CREATE TRIGGER cotizador_valores_updated_at
  BEFORE UPDATE ON cotizador_valores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cotizador_proveedores_updated_at ON cotizador_proveedores;
CREATE TRIGGER cotizador_proveedores_updated_at
  BEFORE UPDATE ON cotizador_proveedores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cotizador_gastos_logisticos_updated_at ON cotizador_gastos_logisticos;
CREATE TRIGGER cotizador_gastos_logisticos_updated_at
  BEFORE UPDATE ON cotizador_gastos_logisticos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS cotizador_costos_fijos_updated_at ON cotizador_costos_fijos;
CREATE TRIGGER cotizador_costos_fijos_updated_at
  BEFORE UPDATE ON cotizador_costos_fijos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizador_secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizador_conceptos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizador_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizador_proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizador_gastos_logisticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizador_costos_fijos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cotizaciones
CREATE POLICY "Users can view cotizaciones from their tenant"
  ON cotizaciones FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cotizaciones for their tenant"
  ON cotizaciones FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cotizaciones from their tenant"
  ON cotizaciones FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cotizaciones from their tenant"
  ON cotizaciones FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Políticas RLS para secciones
CREATE POLICY "Users can view cotizador_secciones from their tenant"
  ON cotizador_secciones FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cotizador_secciones for their tenant"
  ON cotizador_secciones FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cotizador_secciones from their tenant"
  ON cotizador_secciones FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cotizador_secciones from their tenant"
  ON cotizador_secciones FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Políticas RLS para conceptos
CREATE POLICY "Users can view cotizador_conceptos from their tenant"
  ON cotizador_conceptos FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cotizador_conceptos for their tenant"
  ON cotizador_conceptos FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cotizador_conceptos from their tenant"
  ON cotizador_conceptos FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cotizador_conceptos from their tenant"
  ON cotizador_conceptos FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Políticas RLS para valores
CREATE POLICY "Users can view cotizador_valores from their tenant"
  ON cotizador_valores FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cotizador_valores for their tenant"
  ON cotizador_valores FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cotizador_valores from their tenant"
  ON cotizador_valores FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cotizador_valores from their tenant"
  ON cotizador_valores FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Políticas RLS para proveedores
CREATE POLICY "Users can view cotizador_proveedores from their tenant"
  ON cotizador_proveedores FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cotizador_proveedores for their tenant"
  ON cotizador_proveedores FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cotizador_proveedores from their tenant"
  ON cotizador_proveedores FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cotizador_proveedores from their tenant"
  ON cotizador_proveedores FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Políticas RLS para gastos logísticos
CREATE POLICY "Users can view cotizador_gastos_logisticos from their tenant"
  ON cotizador_gastos_logisticos FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cotizador_gastos_logisticos for their tenant"
  ON cotizador_gastos_logisticos FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cotizador_gastos_logisticos from their tenant"
  ON cotizador_gastos_logisticos FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cotizador_gastos_logisticos from their tenant"
  ON cotizador_gastos_logisticos FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Políticas RLS para costos fijos
CREATE POLICY "Users can view cotizador_costos_fijos from their tenant"
  ON cotizador_costos_fijos FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cotizador_costos_fijos for their tenant"
  ON cotizador_costos_fijos FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cotizador_costos_fijos from their tenant"
  ON cotizador_costos_fijos FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cotizador_costos_fijos from their tenant"
  ON cotizador_costos_fijos FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
