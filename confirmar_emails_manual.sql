-- ============================================
-- Script para confirmar emails manualmente
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================

-- OPCIÓN 1: Confirmar email de un usuario específico
-- ============================================
-- Reemplaza 'fabinsa@estudiomartin.com' con el email que quieres confirmar
/*
SELECT confirm_user_email_manually('fabinsa@estudiomartin.com');
*/

-- OPCIÓN 2: Confirmar todos los emails de un tenant
-- ============================================
-- Esto confirmará todos los emails de usuarios del tenant "fabinsa"
/*
SELECT confirm_all_emails_for_tenant('fabinsa');
*/

-- OPCIÓN 3: Confirmar email directamente (más directo)
-- ============================================
-- Reemplaza '[USER_EMAIL]' con el email que quieres confirmar
/*
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = '[USER_EMAIL]';
*/

-- OPCIÓN 4: Ver usuarios sin confirmar
-- ============================================
-- Esto te mostrará todos los usuarios que no han confirmado su email
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at,
  p.full_name,
  p.role,
  t.name as tenant_name,
  t.slug as tenant_slug
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN tenants t ON p.tenant_id = t.id
WHERE u.email_confirmed_at IS NULL
ORDER BY u.created_at DESC;

-- OPCIÓN 5: Confirmar todos los emails de usuarios sin confirmar
-- ============================================
-- ⚠️ CUIDADO: Esto confirmará TODOS los emails sin confirmar
-- Solo úsalo si estás seguro
/*
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email_confirmed_at IS NULL;
*/

-- ============================================
-- INSTRUCCIONES
-- ============================================
-- 
-- 1. Para confirmar un email específico, usa la OPCIÓN 3:
--    - Reemplaza '[USER_EMAIL]' con el email
--    - Ejecuta el UPDATE
-- 
-- 2. Para confirmar todos los emails de un tenant, usa la OPCIÓN 2
-- 
-- 3. Para ver qué usuarios no han confirmado, ejecuta la OPCIÓN 4
-- 
-- 4. Para confirmar todos los emails (solo desarrollo), usa la OPCIÓN 5
-- 
-- ============================================



