-- ============================================
-- Sistema Multi-Tenant - Tabla de Tenants
-- ============================================
-- Crea la tabla de tenants (empresas) y migra datos existentes
-- ============================================

-- 1. Crear tabla tenants
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);

-- 3. Habilitar RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para tenants
-- NOTA: Estas políticas se actualizarán en la migración 2 después de agregar tenant_id a profiles
-- Por ahora, permitimos que todos los usuarios autenticados vean tenants (temporal)
CREATE POLICY "Users can view tenants temporarily"
  ON tenants FOR SELECT
  TO authenticated
  USING (true);

-- Política temporal para actualización (se actualizará en migración 2)
CREATE POLICY "Admins can update tenants temporarily"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 5. Crear tenant por defecto "EmaGroup" para migrar datos existentes
-- Este tenant se crea solo si no existe ninguno
DO $$
DECLARE
  emagroup_tenant_id uuid;
BEGIN
  -- Verificar si ya existe el tenant EmaGroup
  SELECT id INTO emagroup_tenant_id
  FROM tenants
  WHERE slug = 'emagroup'
  LIMIT 1;

  -- Si no existe, crearlo
  IF emagroup_tenant_id IS NULL THEN
    INSERT INTO tenants (name, slug, settings)
    VALUES ('EmaGroup', 'emagroup', '{}'::jsonb)
    RETURNING id INTO emagroup_tenant_id;
  END IF;
END $$;

-- 6. Función helper para obtener el tenant_id del usuario autenticado
-- NOTA: Esta función funcionará correctamente después de la migración 2
-- Por ahora, retorna NULL si tenant_id no existe aún en profiles
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid AS $$
DECLARE
  user_tenant_id uuid;
BEGIN
  -- Verificar si la columna tenant_id existe en profiles
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'tenant_id'
  ) THEN
    SELECT tenant_id INTO user_tenant_id
    FROM profiles
    WHERE id = auth.uid();
  ELSE
    -- Si la columna no existe aún, retornar NULL
    user_tenant_id := NULL;
  END IF;
  
  RETURN user_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at_trigger ON tenants;
CREATE TRIGGER tenants_updated_at_trigger
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_updated_at();

