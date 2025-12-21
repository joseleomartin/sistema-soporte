-- ============================================
-- Función para crear perfil manualmente (bypass RLS)
-- ============================================
-- Esta función permite crear un perfil manualmente cuando el trigger falla
-- Usa SECURITY DEFINER para bypassear RLS, similar al trigger

CREATE OR REPLACE FUNCTION create_profile_manually(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_tenant_id uuid,
  p_role text DEFAULT 'user'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_profile jsonb;
BEGIN
  -- Validar que el tenant existe
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'El tenant_id % no existe', p_tenant_id;
  END IF;
  
  -- Validar que el usuario existe en auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'El usuario con id % no existe en auth.users', p_user_id;
  END IF;
  
  -- Insertar o actualizar el perfil
  INSERT INTO profiles (id, email, full_name, role, tenant_id)
  VALUES (
    p_user_id,
    COALESCE(p_email, ''),
    COALESCE(p_full_name, 'Usuario'),
    COALESCE(p_role, 'user')::text,
    p_tenant_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = COALESCE(EXCLUDED.role, profiles.role),
    tenant_id = COALESCE(EXCLUDED.tenant_id, profiles.tenant_id)
  RETURNING jsonb_build_object(
    'id', id,
    'email', email,
    'full_name', full_name,
    'role', role,
    'tenant_id', tenant_id
  ) INTO created_profile;
    
  RAISE NOTICE 'Perfil creado/actualizado exitosamente para usuario %', p_user_id;
  
  RETURN created_profile;
END;
$$;

-- Comentario
COMMENT ON FUNCTION create_profile_manually IS 
'Función para crear un perfil manualmente cuando el trigger falla.
Usa SECURITY DEFINER para bypassear RLS. Útil para recuperación de errores durante el registro.';

