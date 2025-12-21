-- ============================================
-- Fix: Aislar vacaciones por tenant
-- ============================================
-- Este script asegura que las vacaciones estén correctamente aisladas por tenant
-- ============================================

-- 1. Verificar que la columna tenant_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vacations' 
    AND column_name = 'tenant_id'
  ) THEN
    -- Agregar columna tenant_id si no existe
    ALTER TABLE vacations 
    ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    
    -- Migrar datos existentes
    UPDATE vacations 
    SET tenant_id = (
      SELECT p.tenant_id 
      FROM profiles p 
      WHERE p.id = vacations.user_id 
      LIMIT 1
    )
    WHERE tenant_id IS NULL;
    
    -- Hacer NOT NULL después de migrar
    ALTER TABLE vacations 
    ALTER COLUMN tenant_id SET NOT NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_vacations_tenant_id ON vacations(tenant_id);
    
    RAISE NOTICE '✅ Columna tenant_id agregada a vacations';
  ELSE
    RAISE NOTICE 'ℹ️  Columna tenant_id ya existe en vacations';
  END IF;
END $$;

-- 2. Migrar cualquier registro que no tenga tenant_id
UPDATE vacations 
SET tenant_id = (
  SELECT p.tenant_id 
  FROM profiles p 
  WHERE p.id = vacations.user_id 
  LIMIT 1
)
WHERE tenant_id IS NULL;

-- 3. Eliminar TODAS las políticas RLS existentes (incluyendo las nuevas)
-- Esto asegura que no haya conflictos al recrearlas
DROP POLICY IF EXISTS "Users can view own vacations" ON vacations;
DROP POLICY IF EXISTS "Admins can view all vacations" ON vacations;
DROP POLICY IF EXISTS "Users can create own vacations" ON vacations;
DROP POLICY IF EXISTS "Users can update own pending vacations" ON vacations;
DROP POLICY IF EXISTS "Users can delete own pending vacations" ON vacations;
DROP POLICY IF EXISTS "Admins can approve vacations" ON vacations;
DROP POLICY IF EXISTS "Admins can delete any vacation" ON vacations;
DROP POLICY IF EXISTS "Users can view vacations from own tenant" ON vacations;
DROP POLICY IF EXISTS "Users can create vacations in own tenant" ON vacations;
DROP POLICY IF EXISTS "Admins can update vacations in own tenant" ON vacations;
DROP POLICY IF EXISTS "Users can update own pending vacations in own tenant" ON vacations;
DROP POLICY IF EXISTS "Users can delete own pending vacations in own tenant" ON vacations;
DROP POLICY IF EXISTS "Admins can delete vacations in own tenant" ON vacations;

-- 4. Crear políticas RLS correctas con aislamiento por tenant
CREATE POLICY "Users can view vacations from own tenant"
  ON vacations FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

CREATE POLICY "Users can create vacations in own tenant"
  ON vacations FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update own pending vacations in own tenant"
  ON vacations FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Admins can update vacations in own tenant"
  ON vacations FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can delete own pending vacations in own tenant"
  ON vacations FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Admins can delete vacations in own tenant"
  ON vacations FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- 5. Verificar que todos los registros tienen tenant_id
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM vacations
  WHERE tenant_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING '⚠️  Hay % registros de vacaciones sin tenant_id. Estos se migrarán automáticamente.', null_count;
    
    -- Intentar migrar nuevamente
    UPDATE vacations 
    SET tenant_id = (
      SELECT p.tenant_id 
      FROM profiles p 
      WHERE p.id = vacations.user_id 
      LIMIT 1
    )
    WHERE tenant_id IS NULL;
  ELSE
    RAISE NOTICE '✅ Todos los registros de vacaciones tienen tenant_id asignado';
  END IF;
END $$;

-- Comentario
COMMENT ON TABLE vacations IS 
'Tabla de vacaciones con aislamiento multi-tenant. Cada registro está asociado a un tenant_id.';

