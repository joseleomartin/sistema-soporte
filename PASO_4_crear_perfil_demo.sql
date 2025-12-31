-- ============================================
-- PASO 4: Crear el perfil para el usuario
-- ============================================
-- ⚠️ IMPORTANTE: 
-- 1. Primero ejecuta el PASO 2 para ver usuarios disponibles
-- 2. Si el usuario demo@demo.com no existe, créalo desde el Dashboard (PASO 3)
-- 3. Luego ejecuta este bloque
-- 4. Si usas otro email, cambia 'demo@demo.com' en la línea de abajo

DO $$
DECLARE
  user_email text := 'demo@demo.com'; -- ⚠️ Cambia este email si usas otro
  user_full_name text := 'Admin Demo';
  demo_tenant_id uuid;
  user_id uuid;
BEGIN
  -- Obtener el tenant_id de Demo
  SELECT id INTO demo_tenant_id
  FROM tenants
  WHERE slug = 'demo'
  LIMIT 1;

  IF demo_tenant_id IS NULL THEN
    RAISE EXCEPTION 'El tenant Demo no existe. Ejecuta primero el PASO 1.';
  END IF;

  -- Buscar el usuario por email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado. Por favor, crea el usuario desde el Dashboard (PASO 3) primero.', user_email;
  END IF;

  -- Crear o actualizar el perfil
  INSERT INTO profiles (id, email, full_name, role, tenant_id)
  VALUES (
    user_id,
    user_email,
    user_full_name,
    'admin',
    demo_tenant_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = 'admin',
    tenant_id = EXCLUDED.tenant_id;

  RAISE NOTICE '✅ Perfil de usuario Demo creado/actualizado exitosamente';
  RAISE NOTICE '   - Usuario ID: %', user_id;
  RAISE NOTICE '   - Email: %', user_email;
  RAISE NOTICE '   - Nombre: %', user_full_name;
  RAISE NOTICE '   - Rol: admin';
  RAISE NOTICE '   - Tenant: Demo Company (%)', demo_tenant_id;
END $$;


