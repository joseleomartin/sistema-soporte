-- ============================================
-- Asignar usuario existente a Demo Company
-- ============================================
-- Ejecuta este script para asociar un usuario con la empresa "demo"
-- ============================================

-- PASO 1: Ver usuarios disponibles
-- ============================================
-- Ejecuta esto primero para ver qué usuarios tienes
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  CASE WHEN p.id IS NULL THEN 'Sin perfil' ELSE 'Con perfil' END as estado_perfil,
  t.name as empresa_actual,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN tenants t ON p.tenant_id = t.id
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================
-- PASO 2: Asignar usuario a Demo Company
-- ============================================
-- ⚠️ IMPORTANTE: 
-- 1. Ejecuta primero el PASO 1 para ver usuarios disponibles
-- 2. Cambia 'demo@demo.com' por el email del usuario que quieres asignar
-- 3. Ejecuta este bloque

DO $$
DECLARE
  -- ⚠️ CAMBIA ESTE EMAIL por el email del usuario que quieres asignar
  user_email text := 'demo@demo.com';
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
    RAISE EXCEPTION 'El tenant Demo no existe. Ejecuta primero PASO_1_crear_tenant_demo.sql';
  END IF;

  -- Buscar el usuario por email
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;

  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado. Verifica el email en el PASO 1.', user_email;
  END IF;

  -- Crear o actualizar el perfil asignándolo a Demo Company
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
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = 'admin',
    tenant_id = demo_tenant_id; -- Asignar a Demo Company

  RAISE NOTICE '✅ Usuario asignado a Demo Company exitosamente';
  RAISE NOTICE '   - Usuario ID: %', user_id;
  RAISE NOTICE '   - Email: %', user_email;
  RAISE NOTICE '   - Nombre: %', user_full_name;
  RAISE NOTICE '   - Rol: admin';
  RAISE NOTICE '   - Tenant: Demo Company (%)', demo_tenant_id;
END $$;

-- ============================================
-- PASO 3: Verificar asignación
-- ============================================
-- Ejecuta esto para verificar que el usuario esté asignado correctamente
SELECT 
  t.name as empresa,
  t.slug,
  p.email,
  p.full_name,
  p.role,
  u.email_confirmed_at
FROM profiles p
JOIN tenants t ON p.tenant_id = t.id
LEFT JOIN auth.users u ON p.id = u.id
WHERE t.slug = 'demo'
ORDER BY p.email;







