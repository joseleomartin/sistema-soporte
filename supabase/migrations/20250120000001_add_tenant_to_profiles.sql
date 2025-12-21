-- ============================================
-- Agregar tenant_id a tabla profiles
-- ============================================

-- 1. Agregar columna tenant_id (nullable inicialmente para migración)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- 2. Crear índice
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);

-- 3. Migrar datos existentes al tenant EmaGroup
UPDATE profiles
SET tenant_id = (
  SELECT id FROM tenants WHERE slug = 'emagroup' LIMIT 1
)
WHERE tenant_id IS NULL;

-- 4. Hacer tenant_id NOT NULL después de la migración
ALTER TABLE profiles 
  ALTER COLUMN tenant_id SET NOT NULL;

-- 5. Modificar trigger handle_new_user para asignar tenant
-- NOTA: Este trigger se actualizará cuando se implemente el registro de empresas
-- Por ahora, si un usuario se crea sin tenant_id en metadata, se asignará al tenant por defecto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_tenant_id uuid;
  new_tenant_id uuid;
BEGIN
  -- Intentar obtener tenant_id de metadata, si no existe usar el por defecto
  new_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::uuid;
  
  -- Si no hay tenant_id en metadata, usar el tenant por defecto (EmaGroup)
  IF new_tenant_id IS NULL THEN
    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'emagroup' LIMIT 1;
    new_tenant_id := default_tenant_id;
  END IF;
  
  INSERT INTO public.profiles (id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')::text,
    new_tenant_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Actualizar políticas RLS de profiles para incluir tenant_id
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Users can view profiles from own tenant"
  ON profiles FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND tenant_id = get_user_tenant_id())
  WITH CHECK (id = auth.uid() AND tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update profiles from own tenant"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- 7. Actualizar políticas RLS de tenants ahora que profiles tiene tenant_id
DROP POLICY IF EXISTS "Users can view tenants temporarily" ON tenants;
DROP POLICY IF EXISTS "Admins can update tenants temporarily" ON tenants;

CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update own tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT tenant_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

