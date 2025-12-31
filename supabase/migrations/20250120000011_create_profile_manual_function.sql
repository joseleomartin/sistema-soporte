-- ============================================
-- Función para crear perfil manualmente si el trigger falla
-- ============================================
-- Esta función permite crear un perfil manualmente en caso de que el trigger falle
-- Útil para recuperación de errores durante el registro de empresas

CREATE OR REPLACE FUNCTION create_profile_for_user(
  user_id uuid,
  user_email text,
  user_full_name text,
  user_role text DEFAULT 'user',
  user_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar que el tenant existe
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = user_tenant_id) THEN
    RAISE EXCEPTION 'El tenant_id % no existe', user_tenant_id;
  END IF;
  
  -- Insertar o actualizar el perfil
  INSERT INTO profiles (id, email, full_name, role, tenant_id)
  VALUES (
    user_id,
    COALESCE(user_email, ''),
    COALESCE(user_full_name, 'Usuario'),
    COALESCE(user_role, 'user')::text,
    user_tenant_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = COALESCE(EXCLUDED.role, profiles.role),
    tenant_id = COALESCE(EXCLUDED.tenant_id, profiles.tenant_id);
END;
$$;

-- Comentario
COMMENT ON FUNCTION create_profile_for_user IS 
'Función para crear un perfil manualmente si el trigger handle_new_user falla.
Usa SECURITY DEFINER para bypassear RLS. Útil para recuperación de errores.';


