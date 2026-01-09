-- ============================================
-- Script para verificar que la función RPC existe
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase para verificar

-- 1. Verificar si la función existe
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_profile_manually';

-- 2. Si la función no existe, crearla
-- (Copia y pega el contenido de 20250120000014_allow_profile_insert.sql)

-- 3. Verificar permisos de la función
SELECT 
  p.proname as function_name,
  p.prosecdef as security_definer,
  p.proconfig as search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_profile_manually';

-- 4. Probar la función con un usuario de prueba (opcional)
-- NOTA: Reemplaza los valores con datos reales
/*
DO $$
DECLARE
  test_user_id uuid := (SELECT id FROM auth.users LIMIT 1);
  test_tenant_id uuid := (SELECT id FROM tenants LIMIT 1);
BEGIN
  -- Intentar llamar a la función
  PERFORM create_profile_manually(
    test_user_id,
    'test@example.com',
    'Test User',
    test_tenant_id,
    'user'
  );
  RAISE NOTICE '✅ Función ejecutada exitosamente';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error: %', SQLERRM;
END $$;
*/







