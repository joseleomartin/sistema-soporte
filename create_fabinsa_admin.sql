-- ============================================
-- Script para crear empresa Fabinsa y usuario administrador
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================

-- PASO 1: Crear el tenant (empresa) Fabinsa
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
END $$;

-- PASO 2: Crear el usuario administrador
-- ============================================
-- NOTA: Para crear el usuario en auth.users, necesitas hacerlo desde:
-- 1. El Dashboard de Supabase (Authentication → Users → Add user)
-- 2. O usar la API Admin de Supabase
-- 
-- Después de crear el usuario, ejecuta el PASO 3 con el ID del usuario

-- PASO 3: Crear el perfil del administrador
-- ============================================
-- IMPORTANTE: Reemplaza '[USER_ID_AQUI]' con el ID del usuario que creaste
-- Puedes obtener el ID desde: Authentication → Users → [Tu usuario] → UUID

-- Descomenta y ejecuta esto después de crear el usuario:
/*
DO $$
DECLARE
  user_id uuid := '[USER_ID_AQUI]'::uuid; -- ⚠️ REEMPLAZA CON EL ID DEL USUARIO
  user_email text := 'fabinsa@estudiomartin.com'; -- ⚠️ REEMPLAZA CON EL EMAIL DEL USUARIO
  user_full_name text := 'Administrador Fabinsa';
  fabinsa_tenant_id uuid;
BEGIN
  -- Obtener el tenant_id de Fabinsa
  SELECT id INTO fabinsa_tenant_id
  FROM tenants
  WHERE slug = 'fabinsa'
  LIMIT 1;

  IF fabinsa_tenant_id IS NULL THEN
    RAISE EXCEPTION 'El tenant Fabinsa no existe. Ejecuta primero el PASO 1.';
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

  RAISE NOTICE '✅ Perfil de administrador creado/actualizado exitosamente';
  RAISE NOTICE '   - Usuario ID: %', user_id;
  RAISE NOTICE '   - Email: %', user_email;
  RAISE NOTICE '   - Nombre: %', user_full_name;
  RAISE NOTICE '   - Rol: admin';
  RAISE NOTICE '   - Tenant: Fabinsa (%)', fabinsa_tenant_id;
END $$;
*/

-- ============================================
-- INSTRUCCIONES COMPLETAS
-- ============================================
-- 
-- 1. Ejecuta el PASO 1 (ya está ejecutado arriba)
-- 
-- 2. Crea el usuario desde el Dashboard de Supabase:
--    - Ve a: Authentication → Users → Add user
--    - Email: fabinsa@estudiomartin.com (o el que prefieras)
--    - Password: (la que quieras)
--    - Auto Confirm User: ✅ (marca esta opción para que no necesite confirmar email)
--    - Haz clic en "Create user"
--    - Copia el UUID del usuario creado
-- 
-- 3. Ejecuta el PASO 3:
--    - Descomenta el bloque DO $$ ... END $$;
--    - Reemplaza '[USER_ID_AQUI]' con el UUID que copiaste
--    - Reemplaza el email si usaste uno diferente
--    - Ejecuta el script
-- 
-- 4. Verifica que todo esté correcto:
--    SELECT 
--      p.id,
--      p.email,
--      p.full_name,
--      p.role,
--      t.name as tenant_name,
--      t.slug as tenant_slug
--    FROM profiles p
--    JOIN tenants t ON p.tenant_id = t.id
--    WHERE t.slug = 'fabinsa';
-- 
-- ============================================

