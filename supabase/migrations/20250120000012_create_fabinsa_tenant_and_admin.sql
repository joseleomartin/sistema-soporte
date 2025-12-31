-- ============================================
-- Crear empresa Fabinsa y usuario administrador
-- ============================================
-- Este script crea el tenant "fabinsa" y prepara todo para crear un usuario administrador
-- ============================================

-- 1. Crear el tenant (empresa) Fabinsa
-- ============================================
DO $$
DECLARE
  fabinsa_tenant_id uuid;
  existing_tenant_id uuid;
BEGIN
  -- Verificar si ya existe el tenant fabinsa
  SELECT id INTO existing_tenant_id
  FROM tenants
  WHERE slug = 'fabinsa'
  LIMIT 1;

  IF existing_tenant_id IS NULL THEN
    -- Crear el tenant usando la función
    SELECT create_tenant_for_registration(
      tenant_name := 'Fabinsa',
      tenant_slug := 'fabinsa',
      tenant_settings := '{}'::jsonb
    ) INTO fabinsa_tenant_id;
    
    RAISE NOTICE '✅ Tenant Fabinsa creado con ID: %', fabinsa_tenant_id;
  ELSE
    fabinsa_tenant_id := existing_tenant_id;
    RAISE NOTICE 'ℹ️  Tenant Fabinsa ya existe con ID: %', fabinsa_tenant_id;
  END IF;

  -- Mostrar información del tenant creado
  RAISE NOTICE '📋 Información del tenant:';
  RAISE NOTICE '   - Nombre: Fabinsa';
  RAISE NOTICE '   - Slug: fabinsa';
  RAISE NOTICE '   - ID: %', fabinsa_tenant_id;
END $$;

-- 2. Función helper para crear el perfil del administrador
-- ============================================
-- Esta función se puede usar después de crear el usuario en auth.users
-- desde el Dashboard de Supabase o usando la API Admin

CREATE OR REPLACE FUNCTION create_fabinsa_admin_profile(
  user_id uuid,
  user_email text,
  user_full_name text DEFAULT 'Administrador Fabinsa'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fabinsa_tenant_id uuid;
BEGIN
  -- Obtener el tenant_id de Fabinsa
  SELECT id INTO fabinsa_tenant_id
  FROM tenants
  WHERE slug = 'fabinsa'
  LIMIT 1;

  IF fabinsa_tenant_id IS NULL THEN
    RAISE EXCEPTION 'El tenant Fabinsa no existe. Ejecuta primero la parte 1 del script.';
  END IF;

  -- Crear o actualizar el perfil
  INSERT INTO profiles (id, email, full_name, role, tenant_id)
  VALUES (
    user_id,
    user_email,
    user_full_name,
    'admin',
    fabinsa_tenant_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = 'admin',
    tenant_id = fabinsa_tenant_id;

  RAISE NOTICE '✅ Perfil de administrador creado/actualizado para usuario % en tenant Fabinsa', user_id;
END;
$$;

-- Comentario
COMMENT ON FUNCTION create_fabinsa_admin_profile IS 
'Función para crear el perfil de administrador de Fabinsa después de crear el usuario en auth.users.';

-- 3. Mostrar instrucciones
-- ============================================
DO $$
DECLARE
  fabinsa_tenant_id uuid;
BEGIN
  SELECT id INTO fabinsa_tenant_id
  FROM tenants
  WHERE slug = 'fabinsa'
  LIMIT 1;

  IF fabinsa_tenant_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Tenant Fabinsa creado exitosamente';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Próximos pasos para crear el usuario administrador:';
    RAISE NOTICE '';
    RAISE NOTICE 'OPCIÓN 1: Desde el Dashboard de Supabase';
    RAISE NOTICE '1. Ve a Authentication → Users → Add user';
    RAISE NOTICE '2. Crea un usuario con:';
    RAISE NOTICE '   - Email: fabinsa@estudiomartin.com (o el que prefieras)';
    RAISE NOTICE '   - Password: (la que quieras)';
    RAISE NOTICE '   - Auto Confirm User: ✅ (marcar esta opción)';
    RAISE NOTICE '3. Después de crear el usuario, ejecuta:';
    RAISE NOTICE '';
    RAISE NOTICE '   SELECT create_fabinsa_admin_profile(';
    RAISE NOTICE '     user_id := ''[ID_DEL_USUARIO_CREADO]'',';
    RAISE NOTICE '     user_email := ''fabinsa@estudiomartin.com'',';
    RAISE NOTICE '     user_full_name := ''Administrador Fabinsa''';
    RAISE NOTICE '   );';
    RAISE NOTICE '';
    RAISE NOTICE 'OPCIÓN 2: Usando la API Admin de Supabase';
    RAISE NOTICE 'Puedes usar el código del componente CompanyRegistration.tsx';
    RAISE NOTICE 'o crear el usuario programáticamente usando la API Admin.';
    RAISE NOTICE '';
    RAISE NOTICE 'Tenant ID de Fabinsa: %', fabinsa_tenant_id;
    RAISE NOTICE '========================================';
  END IF;
END $$;


