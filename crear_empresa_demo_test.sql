-- ============================================
-- Script para crear empresa "demo" y usuario de prueba
-- Ejecuta cada PASO por separado en orden
-- ============================================

-- ============================================
-- PASO 1: Crear el tenant (empresa) "demo"
-- ============================================
-- Ejecuta SOLO este bloque primero
DO $$
DECLARE
  demo_tenant_id uuid;
  existing_tenant_id uuid;
BEGIN
  SELECT id INTO existing_tenant_id
  FROM tenants
  WHERE slug = 'demo'
  LIMIT 1;

  IF existing_tenant_id IS NULL THEN
    SELECT create_tenant_for_registration(
      tenant_name := 'Demo Company',
      tenant_slug := 'demo',
      tenant_settings := '{}'::jsonb
    ) INTO demo_tenant_id;
    
    RAISE NOTICE '✅ Tenant Demo Company creado con ID: %', demo_tenant_id;
  ELSE
    demo_tenant_id := existing_tenant_id;
    RAISE NOTICE 'ℹ️  Tenant Demo Company ya existe con ID: %', demo_tenant_id;
  END IF;
END $$;

-- ============================================
-- PASO 2: Ver usuarios disponibles
-- ============================================
-- Ejecuta SOLO esta consulta para ver qué usuarios tienes
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  CASE WHEN p.id IS NULL THEN 'Sin perfil' ELSE 'Con perfil' END as estado_perfil,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================
-- PASO 3: Crear usuario desde Dashboard (si no existe)
-- ============================================
-- Si no tienes un usuario, créalo desde el Dashboard:
-- 1. Ve a: Authentication → Users → Add user
-- 2. Email: demo@demo.com
-- 3. Password: 123456
-- 4. Auto Confirm User: ✅ (marca esta opción)
-- 5. Haz clic en "Create user"
-- 
-- Luego ejecuta el PASO 4

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

-- ============================================
-- PASO 5: Verificación
-- ============================================
-- Ejecuta esta consulta para verificar que todo esté correcto
SELECT 
  t.name as empresa,
  t.slug,
  p.email,
  p.full_name,
  p.role,
  u.email_confirmed_at,
  CASE WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Confirmado' ELSE '❌ No confirmado' END as estado_email
FROM tenants t
LEFT JOIN profiles p ON p.tenant_id = t.id
LEFT JOIN auth.users u ON p.id = u.id
WHERE t.slug IN ('test', 'demo')
ORDER BY t.name, p.email;
