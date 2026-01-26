-- ============================================
-- Sistema de Gastos
-- ============================================
-- Permite a los usuarios gestionar gastos por concepto, mes, categoría y sub-categoría
-- ============================================

-- 1. TABLA DE CATEGORÍAS (crear primero, no tiene dependencias)
CREATE TABLE IF NOT EXISTS gastos_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- 2. TABLA DE SUB-CATEGORÍAS (pertenecen a una categoría)
CREATE TABLE IF NOT EXISTS gastos_sub_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES gastos_categories(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, category_id, name)
);

-- 3. TABLA DE CONCEPTOS (gastos individuales)
CREATE TABLE IF NOT EXISTS gastos_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  category_id uuid REFERENCES gastos_categories(id) ON DELETE SET NULL,
  sub_category_id uuid REFERENCES gastos_sub_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- 4. TABLA DE VALORES POR MES
CREATE TABLE IF NOT EXISTS gastos_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id uuid NOT NULL REFERENCES gastos_concepts(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  value numeric(20, 10) NOT NULL DEFAULT 0,
  category_id uuid REFERENCES gastos_categories(id) ON DELETE SET NULL,
  sub_category_id uuid REFERENCES gastos_sub_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(concept_id, month, year)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_gastos_concepts_tenant ON gastos_concepts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gastos_concepts_order ON gastos_concepts(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_gastos_categories_tenant ON gastos_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gastos_categories_order ON gastos_categories(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_gastos_sub_categories_category ON gastos_sub_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_gastos_sub_categories_tenant ON gastos_sub_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gastos_sub_categories_order ON gastos_sub_categories(category_id, display_order);
CREATE INDEX IF NOT EXISTS idx_gastos_values_concept ON gastos_values(concept_id);
CREATE INDEX IF NOT EXISTS idx_gastos_values_month_year ON gastos_values(year, month);
CREATE INDEX IF NOT EXISTS idx_gastos_values_category ON gastos_values(category_id);
CREATE INDEX IF NOT EXISTS idx_gastos_values_sub_category ON gastos_values(sub_category_id);
CREATE INDEX IF NOT EXISTS idx_gastos_values_tenant ON gastos_values(tenant_id);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS gastos_concepts_updated_at ON gastos_concepts;
CREATE TRIGGER gastos_concepts_updated_at
  BEFORE UPDATE ON gastos_concepts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS gastos_categories_updated_at ON gastos_categories;
CREATE TRIGGER gastos_categories_updated_at
  BEFORE UPDATE ON gastos_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS gastos_sub_categories_updated_at ON gastos_sub_categories;
CREATE TRIGGER gastos_sub_categories_updated_at
  BEFORE UPDATE ON gastos_sub_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS gastos_values_updated_at ON gastos_values;
CREATE TRIGGER gastos_values_updated_at
  BEFORE UPDATE ON gastos_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE gastos_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_sub_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_values ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para gastos_concepts
DROP POLICY IF EXISTS "Users can view gastos_concepts from their tenant" ON gastos_concepts;
CREATE POLICY "Users can view gastos_concepts from their tenant"
  ON gastos_concepts FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert gastos_concepts for their tenant" ON gastos_concepts;
CREATE POLICY "Users can insert gastos_concepts for their tenant"
  ON gastos_concepts FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update gastos_concepts from their tenant" ON gastos_concepts;
CREATE POLICY "Users can update gastos_concepts from their tenant"
  ON gastos_concepts FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete gastos_concepts from their tenant" ON gastos_concepts;
CREATE POLICY "Users can delete gastos_concepts from their tenant"
  ON gastos_concepts FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para gastos_categories
DROP POLICY IF EXISTS "Users can view gastos_categories from their tenant" ON gastos_categories;
CREATE POLICY "Users can view gastos_categories from their tenant"
  ON gastos_categories FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert gastos_categories for their tenant" ON gastos_categories;
CREATE POLICY "Users can insert gastos_categories for their tenant"
  ON gastos_categories FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update gastos_categories from their tenant" ON gastos_categories;
CREATE POLICY "Users can update gastos_categories from their tenant"
  ON gastos_categories FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete gastos_categories from their tenant" ON gastos_categories;
CREATE POLICY "Users can delete gastos_categories from their tenant"
  ON gastos_categories FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para gastos_sub_categories
DROP POLICY IF EXISTS "Users can view gastos_sub_categories from their tenant" ON gastos_sub_categories;
CREATE POLICY "Users can view gastos_sub_categories from their tenant"
  ON gastos_sub_categories FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert gastos_sub_categories for their tenant" ON gastos_sub_categories;
CREATE POLICY "Users can insert gastos_sub_categories for their tenant"
  ON gastos_sub_categories FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update gastos_sub_categories from their tenant" ON gastos_sub_categories;
CREATE POLICY "Users can update gastos_sub_categories from their tenant"
  ON gastos_sub_categories FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete gastos_sub_categories from their tenant" ON gastos_sub_categories;
CREATE POLICY "Users can delete gastos_sub_categories from their tenant"
  ON gastos_sub_categories FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Políticas RLS para gastos_values
DROP POLICY IF EXISTS "Users can view gastos_values from their tenant" ON gastos_values;
CREATE POLICY "Users can view gastos_values from their tenant"
  ON gastos_values FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert gastos_values for their tenant" ON gastos_values;
CREATE POLICY "Users can insert gastos_values for their tenant"
  ON gastos_values FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update gastos_values from their tenant" ON gastos_values;
CREATE POLICY "Users can update gastos_values from their tenant"
  ON gastos_values FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete gastos_values from their tenant" ON gastos_values;
CREATE POLICY "Users can delete gastos_values from their tenant"
  ON gastos_values FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- Función para inicializar datos de ejemplo
CREATE OR REPLACE FUNCTION initialize_gastos_example_data(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_concept_id uuid;
  v_category_id uuid;
  v_sub_category_id uuid;
  v_order integer := 1;
BEGIN
  -- Solo inicializar si no hay conceptos para este tenant
  IF EXISTS (SELECT 1 FROM gastos_concepts WHERE tenant_id = p_tenant_id) THEN
    RETURN;
  END IF;

  -- Crear categorías de ejemplo
  INSERT INTO gastos_categories (tenant_id, name, display_order) VALUES
    (p_tenant_id, 'COGS', 1),
    (p_tenant_id, 'SERVICIOS', 2),
    (p_tenant_id, 'INFRAESTRUCTURA', 3),
    (p_tenant_id, 'COMERCIAL', 4)
  RETURNING id INTO v_category_id;

  -- Obtener IDs de categorías para crear sub-categorías
  -- COGS
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'COGS';
  INSERT INTO gastos_sub_categories (category_id, tenant_id, name, display_order) VALUES
    (v_category_id, p_tenant_id, 'Materia Prima', 1),
    (v_category_id, p_tenant_id, 'Mano de Obra', 2),
    (v_category_id, p_tenant_id, 'Materiales', 3)
  RETURNING id INTO v_sub_category_id;

  -- SERVICIOS
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'SERVICIOS';
  INSERT INTO gastos_sub_categories (category_id, tenant_id, name, display_order) VALUES
    (v_category_id, p_tenant_id, 'Agua', 1),
    (v_category_id, p_tenant_id, 'Gas', 2),
    (v_category_id, p_tenant_id, 'Luz', 3),
    (v_category_id, p_tenant_id, 'Internet', 4),
    (v_category_id, p_tenant_id, 'Telefonía', 5),
    (v_category_id, p_tenant_id, 'Servicios Públicos', 6)
  RETURNING id INTO v_sub_category_id;

  -- INFRAESTRUCTURA
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'INFRAESTRUCTURA';
  INSERT INTO gastos_sub_categories (category_id, tenant_id, name, display_order) VALUES
    (v_category_id, p_tenant_id, 'Alquileres', 1),
    (v_category_id, p_tenant_id, 'Mantenimiento', 2),
    (v_category_id, p_tenant_id, 'Seguridad', 3),
    (v_category_id, p_tenant_id, 'Limpieza', 4),
    (v_category_id, p_tenant_id, 'Equipamiento', 5)
  RETURNING id INTO v_sub_category_id;

  -- COMERCIAL
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'COMERCIAL';
  INSERT INTO gastos_sub_categories (category_id, tenant_id, name, display_order) VALUES
    (v_category_id, p_tenant_id, 'Marketing', 1),
    (v_category_id, p_tenant_id, 'Publicidad', 2),
    (v_category_id, p_tenant_id, 'Ventas', 3),
    (v_category_id, p_tenant_id, 'Almuerzos y Viáticos', 4),
    (v_category_id, p_tenant_id, 'Comisiones', 5)
  RETURNING id INTO v_sub_category_id;

  -- Crear conceptos de ejemplo
  INSERT INTO gastos_concepts (tenant_id, name, display_order) VALUES
    (p_tenant_id, 'Proveedor de Tela 1', 1),
    (p_tenant_id, 'Proveedor de Tela 2', 2),
    (p_tenant_id, 'ABL', 3),
    (p_tenant_id, 'Agua (aysa)', 4),
    (p_tenant_id, 'Almuerzos', 5),
    (p_tenant_id, 'Alquileres', 6),
    (p_tenant_id, 'Capacitaciones', 7),
    (p_tenant_id, 'Combustible', 8),
    (p_tenant_id, 'Donaciones', 9),
    (p_tenant_id, 'Fletes', 10),
    (p_tenant_id, 'Gas', 11),
    (p_tenant_id, 'Gastos bancarios', 12),
    (p_tenant_id, 'Honorarios', 13),
    (p_tenant_id, 'Impuestos', 14),
    (p_tenant_id, 'Internet', 15),
    (p_tenant_id, 'Librería', 16),
    (p_tenant_id, 'Limpieza', 17),
    (p_tenant_id, 'Logistica de producción', 18),
    (p_tenant_id, 'Luz', 19),
    (p_tenant_id, 'Mantenimiento locales', 20),
    (p_tenant_id, 'Mantenimiento vehiculos', 21),
    (p_tenant_id, 'Movilidad y Viaticos', 22),
    (p_tenant_id, 'Muebles y Utiles', 23),
    (p_tenant_id, 'Publicidad', 24),
    (p_tenant_id, 'Seguridad e Higiene', 25),
    (p_tenant_id, 'Sistemas', 26);

  -- Actualizar conceptos con categorías y sub-categorías
  -- Proveedor de Tela 1 - COGS / Materia Prima
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Proveedor de Tela 1';
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'COGS';
  SELECT id INTO v_sub_category_id FROM gastos_sub_categories WHERE tenant_id = p_tenant_id AND category_id = v_category_id AND name = 'Materia Prima';
  UPDATE gastos_concepts SET category_id = v_category_id, sub_category_id = v_sub_category_id WHERE id = v_concept_id;
  
  -- Proveedor de Tela 2 - COGS / Materia Prima
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Proveedor de Tela 2';
  UPDATE gastos_concepts SET category_id = v_category_id, sub_category_id = v_sub_category_id WHERE id = v_concept_id;
  
  -- ABL - INFRAESTRUCTURA / Alquileres
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'ABL';
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'INFRAESTRUCTURA';
  SELECT id INTO v_sub_category_id FROM gastos_sub_categories WHERE tenant_id = p_tenant_id AND category_id = v_category_id AND name = 'Alquileres';
  UPDATE gastos_concepts SET category_id = v_category_id, sub_category_id = v_sub_category_id WHERE id = v_concept_id;
  
  -- Agua - SERVICIOS / Agua
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Agua (aysa)';
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'SERVICIOS';
  SELECT id INTO v_sub_category_id FROM gastos_sub_categories WHERE tenant_id = p_tenant_id AND category_id = v_category_id AND name = 'Agua';
  UPDATE gastos_concepts SET category_id = v_category_id, sub_category_id = v_sub_category_id WHERE id = v_concept_id;
  
  -- Almuerzos - COMERCIAL / Almuerzos y Viáticos
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Almuerzos';
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'COMERCIAL';
  SELECT id INTO v_sub_category_id FROM gastos_sub_categories WHERE tenant_id = p_tenant_id AND category_id = v_category_id AND name = 'Almuerzos y Viáticos';
  UPDATE gastos_concepts SET category_id = v_category_id, sub_category_id = v_sub_category_id WHERE id = v_concept_id;
  
  -- Luz - SERVICIOS / Luz
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Luz';
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'SERVICIOS';
  SELECT id INTO v_sub_category_id FROM gastos_sub_categories WHERE tenant_id = p_tenant_id AND category_id = v_category_id AND name = 'Luz';
  UPDATE gastos_concepts SET category_id = v_category_id, sub_category_id = v_sub_category_id WHERE id = v_concept_id;
  
  -- Alquileres - INFRAESTRUCTURA / Alquileres
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Alquileres';
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'INFRAESTRUCTURA';
  SELECT id INTO v_sub_category_id FROM gastos_sub_categories WHERE tenant_id = p_tenant_id AND category_id = v_category_id AND name = 'Alquileres';
  UPDATE gastos_concepts SET category_id = v_category_id, sub_category_id = v_sub_category_id WHERE id = v_concept_id;
  
  -- Mantenimiento locales - INFRAESTRUCTURA / Mantenimiento
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Mantenimiento locales';
  SELECT id INTO v_category_id FROM gastos_categories WHERE tenant_id = p_tenant_id AND name = 'INFRAESTRUCTURA';
  SELECT id INTO v_sub_category_id FROM gastos_sub_categories WHERE tenant_id = p_tenant_id AND category_id = v_category_id AND name = 'Mantenimiento';
  UPDATE gastos_concepts SET category_id = v_category_id, sub_category_id = v_sub_category_id WHERE id = v_concept_id;

  -- Insertar algunos valores de ejemplo (Septiembre, Octubre, Noviembre, Diciembre 2025)
  -- Solo insertar valores si el concepto tiene categoría y sub-categoría asignadas
  -- Proveedor de Tela 1
  SELECT id, category_id, sub_category_id INTO v_concept_id, v_category_id, v_sub_category_id 
  FROM gastos_concepts 
  WHERE tenant_id = p_tenant_id AND name = 'Proveedor de Tela 1' AND category_id IS NOT NULL;
  IF v_concept_id IS NOT NULL THEN
    INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
      (v_concept_id, p_tenant_id, 9, 2025, 1000000.00, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 10, 2025, 750000.00, v_category_id, v_sub_category_id);
  END IF;

  -- Proveedor de Tela 2
  SELECT id, category_id, sub_category_id INTO v_concept_id, v_category_id, v_sub_category_id 
  FROM gastos_concepts 
  WHERE tenant_id = p_tenant_id AND name = 'Proveedor de Tela 2' AND category_id IS NOT NULL;
  IF v_concept_id IS NOT NULL THEN
    INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
      (v_concept_id, p_tenant_id, 9, 2025, 500000.00, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 10, 2025, 250000.00, v_category_id, v_sub_category_id);
  END IF;

  -- ABL
  SELECT id, category_id, sub_category_id INTO v_concept_id, v_category_id, v_sub_category_id 
  FROM gastos_concepts 
  WHERE tenant_id = p_tenant_id AND name = 'ABL' AND category_id IS NOT NULL;
  IF v_concept_id IS NOT NULL THEN
    INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
      (v_concept_id, p_tenant_id, 9, 2025, 188304.00, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 10, 2025, 188784.00, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 11, 2025, 198579.84, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 12, 2025, 204507.84, v_category_id, v_sub_category_id);
  END IF;

  -- Agua
  SELECT id, category_id, sub_category_id INTO v_concept_id, v_category_id, v_sub_category_id 
  FROM gastos_concepts 
  WHERE tenant_id = p_tenant_id AND name = 'Agua (aysa)' AND category_id IS NOT NULL;
  IF v_concept_id IS NOT NULL THEN
    INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
      (v_concept_id, p_tenant_id, 9, 2025, 46394.40, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 10, 2025, 45938.40, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 11, 2025, 45938.40, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 12, 2025, 48851.04, v_category_id, v_sub_category_id);
  END IF;

  -- Almuerzos
  SELECT id, category_id, sub_category_id INTO v_concept_id, v_category_id, v_sub_category_id 
  FROM gastos_concepts 
  WHERE tenant_id = p_tenant_id AND name = 'Almuerzos' AND category_id IS NOT NULL;
  IF v_concept_id IS NOT NULL THEN
    INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
      (v_concept_id, p_tenant_id, 9, 2025, 1000.00, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 10, 2025, 1000.00, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 11, 2025, 1000.00, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 12, 2025, 1000.00, v_category_id, v_sub_category_id);
  END IF;

  -- Luz
  SELECT id, category_id, sub_category_id INTO v_concept_id, v_category_id, v_sub_category_id 
  FROM gastos_concepts 
  WHERE tenant_id = p_tenant_id AND name = 'Luz' AND category_id IS NOT NULL;
  IF v_concept_id IS NOT NULL THEN
    INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
      (v_concept_id, p_tenant_id, 9, 2025, 328107.00, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 10, 2025, 271758.60, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 11, 2025, 449753.40, v_category_id, v_sub_category_id),
      (v_concept_id, p_tenant_id, 12, 2025, 516045.00, v_category_id, v_sub_category_id);
  END IF;

  -- Alquileres
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Alquileres';
  INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
    (v_concept_id, p_tenant_id, 9, 2025, 2911965.00, NULL, NULL),
    (v_concept_id, p_tenant_id, 10, 2025, 2911965.00, NULL, NULL),
    (v_concept_id, p_tenant_id, 11, 2025, 3138769.80, NULL, NULL),
    (v_concept_id, p_tenant_id, 12, 2025, 3138769.80, NULL, NULL);

  -- Logistica de producción
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Logistica de producción';
  INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
    (v_concept_id, p_tenant_id, 9, 2025, 504000.00, NULL, NULL),
    (v_concept_id, p_tenant_id, 10, 2025, 416100.00, NULL, NULL),
    (v_concept_id, p_tenant_id, 11, 2025, 147882.00, NULL, NULL),
    (v_concept_id, p_tenant_id, 12, 2025, 312484.00, NULL, NULL);

  -- Luz
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Luz';
  INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
    (v_concept_id, p_tenant_id, 9, 2025, 328107.00, NULL, NULL),
    (v_concept_id, p_tenant_id, 10, 2025, 271758.60, NULL, NULL),
    (v_concept_id, p_tenant_id, 11, 2025, 449753.40, NULL, NULL),
    (v_concept_id, p_tenant_id, 12, 2025, 516045.00, NULL, NULL);

  -- Mantenimiento locales
  SELECT id INTO v_concept_id FROM gastos_concepts WHERE tenant_id = p_tenant_id AND name = 'Mantenimiento locales';
  INSERT INTO gastos_values (concept_id, tenant_id, month, year, value, category_id, sub_category_id) VALUES
    (v_concept_id, p_tenant_id, 12, 2025, 2143000.00, NULL, NULL);

END;
$$;
