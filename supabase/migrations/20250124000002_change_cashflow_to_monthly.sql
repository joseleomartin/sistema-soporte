-- ============================================
-- Cambiar Cash Flow de Semanal a Mensual
-- ============================================
-- Convierte el sistema de cash flow de semanas a meses
-- Permite visualizar todo el mes (días 1-31)
-- Si las tablas no existen, las crea desde cero
-- ============================================

-- 0. Crear tablas si no existen (por si la primera migración no se ejecutó)
DO $$
BEGIN
  -- Crear cashflow_categories si no existe
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_categories') THEN
    CREATE TABLE cashflow_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name text NOT NULL,
      category_type text NOT NULL CHECK (category_type IN (
        'disponibilidades',
        'ingresos',
        'egresos'
      )),
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(tenant_id, name, category_type)
    );

    CREATE INDEX IF NOT EXISTS idx_cashflow_categories_tenant ON cashflow_categories(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_cashflow_categories_type ON cashflow_categories(category_type);
    CREATE INDEX IF NOT EXISTS idx_cashflow_categories_order ON cashflow_categories(tenant_id, display_order);

    ALTER TABLE cashflow_categories ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view cashflow_categories from their tenant"
      ON cashflow_categories FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can insert cashflow_categories for their tenant"
      ON cashflow_categories FOR INSERT
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can update cashflow_categories from their tenant"
      ON cashflow_categories FOR UPDATE
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can delete cashflow_categories from their tenant"
      ON cashflow_categories FOR DELETE
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    DROP TRIGGER IF EXISTS cashflow_categories_updated_at ON cashflow_categories;
    CREATE TRIGGER cashflow_categories_updated_at
      BEFORE UPDATE ON cashflow_categories
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Crear cashflow_sub_items si no existe
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_sub_items') THEN
    CREATE TABLE cashflow_sub_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id uuid NOT NULL REFERENCES cashflow_categories(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name text NOT NULL,
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_cashflow_sub_items_category ON cashflow_sub_items(category_id);
    CREATE INDEX IF NOT EXISTS idx_cashflow_sub_items_tenant ON cashflow_sub_items(tenant_id);

    ALTER TABLE cashflow_sub_items ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view cashflow_sub_items from their tenant"
      ON cashflow_sub_items FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can insert cashflow_sub_items for their tenant"
      ON cashflow_sub_items FOR INSERT
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can update cashflow_sub_items from their tenant"
      ON cashflow_sub_items FOR UPDATE
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can delete cashflow_sub_items from their tenant"
      ON cashflow_sub_items FOR DELETE
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    DROP TRIGGER IF EXISTS cashflow_sub_items_updated_at ON cashflow_sub_items;
    CREATE TRIGGER cashflow_sub_items_updated_at
      BEFORE UPDATE ON cashflow_sub_items
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 1. Verificar si existe cashflow_weeks y renombrarla, o crear cashflow_months directamente
DO $$
BEGIN
  -- Si existe cashflow_weeks, renombrarla
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_weeks') THEN
    ALTER TABLE cashflow_weeks RENAME TO cashflow_months;
    
    -- Agregar campos para mes y año
    ALTER TABLE cashflow_months 
      ADD COLUMN IF NOT EXISTS month integer,
      ADD COLUMN IF NOT EXISTS year integer;
    
    -- Migrar datos existentes (si los hay)
    UPDATE cashflow_months 
    SET 
      month = EXTRACT(MONTH FROM start_date),
      year = EXTRACT(YEAR FROM start_date)
    WHERE month IS NULL OR year IS NULL;
    
    -- Hacer month y year NOT NULL después de migrar
    ALTER TABLE cashflow_months 
      ALTER COLUMN month SET NOT NULL,
      ALTER COLUMN year SET NOT NULL;
    
    -- Cambiar la restricción UNIQUE para usar month y year
    ALTER TABLE cashflow_months 
      DROP CONSTRAINT IF EXISTS cashflow_months_tenant_id_start_date_key;
    
    ALTER TABLE cashflow_months 
      ADD CONSTRAINT cashflow_months_tenant_month_year_unique 
      UNIQUE(tenant_id, month, year);
  ELSE
    -- Si no existe cashflow_weeks, crear cashflow_months directamente
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_months') THEN
      CREATE TABLE cashflow_months (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name text NOT NULL DEFAULT 'Planificación Financiera',
        month integer NOT NULL,
        year integer NOT NULL,
        created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(tenant_id, month, year)
      );
    END IF;
  END IF;
END $$;

-- 2. Asegurar que cashflow_months existe antes de crear cashflow_values
-- (ya se creó en la sección 1)

-- 3. Crear cashflow_values si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_values') THEN
    CREATE TABLE cashflow_values (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      month_id uuid NOT NULL REFERENCES cashflow_months(id) ON DELETE CASCADE,
      sub_item_id uuid REFERENCES cashflow_sub_items(id) ON DELETE CASCADE,
      category_id uuid REFERENCES cashflow_categories(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      day_of_month integer NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
      value numeric(20, 10) NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(month_id, sub_item_id, category_id, day_of_month)
    );

    CREATE INDEX IF NOT EXISTS idx_cashflow_values_month ON cashflow_values(month_id);
    CREATE INDEX IF NOT EXISTS idx_cashflow_values_sub_item ON cashflow_values(sub_item_id);
    CREATE INDEX IF NOT EXISTS idx_cashflow_values_category ON cashflow_values(category_id);
    CREATE INDEX IF NOT EXISTS idx_cashflow_values_day ON cashflow_values(day_of_month);
    CREATE INDEX IF NOT EXISTS idx_cashflow_values_tenant ON cashflow_values(tenant_id);

    ALTER TABLE cashflow_values ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view cashflow_values from their tenant"
      ON cashflow_values FOR SELECT
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can insert cashflow_values for their tenant"
      ON cashflow_values FOR INSERT
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can update cashflow_values from their tenant"
      ON cashflow_values FOR UPDATE
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    CREATE POLICY "Users can delete cashflow_values from their tenant"
      ON cashflow_values FOR DELETE
      USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

    DROP TRIGGER IF EXISTS cashflow_values_updated_at ON cashflow_values;
    CREATE TRIGGER cashflow_values_updated_at
      BEFORE UPDATE ON cashflow_values
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 4. Cambiar tabla de valores: day_of_week a day_of_month (si existe la columna antigua)
DO $$
BEGIN
  -- Solo proceder si la tabla cashflow_values existe
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_values') THEN
    -- Verificar si existe la columna day_of_week y renombrarla
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'cashflow_values' AND column_name = 'day_of_week'
    ) THEN
      ALTER TABLE cashflow_values RENAME COLUMN day_of_week TO day_of_month;
    END IF;
    
    -- Si no existe day_of_month, crearla (por si acaso)
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'cashflow_values' AND column_name = 'day_of_month'
    ) THEN
      ALTER TABLE cashflow_values ADD COLUMN day_of_month integer;
    END IF;
  END IF;
END $$;

-- Cambiar restricción CHECK para días del mes (1-31)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_values') THEN
    ALTER TABLE cashflow_values 
      DROP CONSTRAINT IF EXISTS cashflow_values_day_of_week_check;

    ALTER TABLE cashflow_values 
      DROP CONSTRAINT IF EXISTS cashflow_values_day_of_month_check;

    ALTER TABLE cashflow_values 
      ADD CONSTRAINT cashflow_values_day_of_month_check 
      CHECK (day_of_month BETWEEN 1 AND 31);
  END IF;
END $$;

-- 5. Renombrar foreign key de week_id a month_id
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_values') THEN
    -- Verificar si existe la columna week_id y renombrarla
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'cashflow_values' AND column_name = 'week_id'
    ) THEN
      ALTER TABLE cashflow_values RENAME COLUMN week_id TO month_id;
    END IF;
    
    -- Si no existe month_id, crearla (por si acaso)
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'cashflow_values' AND column_name = 'month_id'
    ) THEN
      ALTER TABLE cashflow_values ADD COLUMN month_id uuid REFERENCES cashflow_months(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Actualizar constraint de foreign key
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_values') THEN
    ALTER TABLE cashflow_values 
      DROP CONSTRAINT IF EXISTS cashflow_values_week_id_fkey;

    ALTER TABLE cashflow_values 
      DROP CONSTRAINT IF EXISTS cashflow_values_month_id_fkey;

    ALTER TABLE cashflow_values 
      ADD CONSTRAINT cashflow_values_month_id_fkey 
      FOREIGN KEY (month_id) REFERENCES cashflow_months(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Actualizar constraint UNIQUE para usar month_id y day_of_month
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_values') THEN
    ALTER TABLE cashflow_values 
      DROP CONSTRAINT IF EXISTS cashflow_values_week_id_sub_item_id_category_id_day_of_week_key;

    ALTER TABLE cashflow_values 
      DROP CONSTRAINT IF EXISTS cashflow_values_month_sub_item_category_day_unique;

    ALTER TABLE cashflow_values 
      ADD CONSTRAINT cashflow_values_month_sub_item_category_day_unique 
      UNIQUE(month_id, sub_item_id, category_id, day_of_month);
  END IF;
END $$;

-- 7. Actualizar índices
DROP INDEX IF EXISTS idx_cashflow_weeks_tenant;
DROP INDEX IF EXISTS idx_cashflow_weeks_start_date;
DROP INDEX IF EXISTS idx_cashflow_values_week;
DROP INDEX IF EXISTS idx_cashflow_values_day;

CREATE INDEX IF NOT EXISTS idx_cashflow_months_tenant ON cashflow_months(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_months_month_year ON cashflow_months(year, month);

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cashflow_values') THEN
    CREATE INDEX IF NOT EXISTS idx_cashflow_values_month ON cashflow_values(month_id);
    CREATE INDEX IF NOT EXISTS idx_cashflow_values_day ON cashflow_values(day_of_month);
  END IF;
END $$;

-- 8. Actualizar triggers
DROP TRIGGER IF EXISTS cashflow_weeks_updated_at ON cashflow_months;
DROP TRIGGER IF EXISTS cashflow_months_updated_at ON cashflow_months;
CREATE TRIGGER cashflow_months_updated_at
  BEFORE UPDATE ON cashflow_months
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Actualizar políticas RLS
-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Users can view cashflow_weeks from their tenant" ON cashflow_months;
DROP POLICY IF EXISTS "Users can insert cashflow_weeks for their tenant" ON cashflow_months;
DROP POLICY IF EXISTS "Users can update cashflow_weeks from their tenant" ON cashflow_months;
DROP POLICY IF EXISTS "Users can delete cashflow_weeks from their tenant" ON cashflow_months;

-- Crear nuevas políticas para cashflow_months
DROP POLICY IF EXISTS "Users can view cashflow_months from their tenant" ON cashflow_months;
CREATE POLICY "Users can view cashflow_months from their tenant"
  ON cashflow_months FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert cashflow_months for their tenant" ON cashflow_months;
CREATE POLICY "Users can insert cashflow_months for their tenant"
  ON cashflow_months FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update cashflow_months from their tenant" ON cashflow_months;
CREATE POLICY "Users can update cashflow_months from their tenant"
  ON cashflow_months FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete cashflow_months from their tenant" ON cashflow_months;
CREATE POLICY "Users can delete cashflow_months from their tenant"
  ON cashflow_months FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));
