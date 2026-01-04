-- ============================================
-- Script de diagnóstico para el trigger handle_new_user
-- ============================================
-- Ejecuta este script para verificar el estado actual

-- 1. Verificar que la función existe
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as search_path
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 2. Verificar que el trigger existe
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as is_enabled
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- 3. Verificar estructura de la tabla profiles
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Verificar que existe el tenant por defecto
SELECT id, name, slug 
FROM tenants 
WHERE slug = 'emagroup';

-- 5. Verificar políticas RLS en profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 6. Verificar si hay restricciones NOT NULL en tenant_id
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
  AND contype = 'n'; -- NOT NULL constraints



