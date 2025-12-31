-- ============================================
-- Permitir creación de tenants durante registro de empresas
-- ============================================

-- Política RLS para permitir que usuarios autenticados creen tenants
-- Esto es necesario para el registro de nuevas empresas
-- Solo se permite si el usuario no tiene un tenant_id asignado aún (nuevo registro)
CREATE POLICY "Authenticated users can create tenants"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Permitir si el usuario no tiene un tenant_id asignado (registro de nueva empresa)
    NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tenant_id IS NOT NULL
    )
  );

-- También necesitamos una función SECURITY DEFINER para crear tenants de forma segura
-- Esto permite crear el tenant incluso si el usuario ya tiene un tenant_id
CREATE OR REPLACE FUNCTION create_tenant_for_registration(
  tenant_name text,
  tenant_slug text,
  tenant_settings jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Verificar que el slug sea único
  IF EXISTS (SELECT 1 FROM tenants WHERE slug = tenant_slug) THEN
    RAISE EXCEPTION 'El slug "%" ya está en uso', tenant_slug;
  END IF;
  
  -- Crear el tenant
  INSERT INTO tenants (name, slug, settings)
  VALUES (tenant_name, tenant_slug, tenant_settings)
  RETURNING id INTO new_tenant_id;
  
  RETURN new_tenant_id;
END;
$$;

-- Comentario sobre el uso de la función
COMMENT ON FUNCTION create_tenant_for_registration IS 
'Función para crear tenants durante el registro de nuevas empresas. Usa SECURITY DEFINER para bypassear RLS.';


