-- ============================================
-- Verificar y corregir tenant_id en vacaciones
-- ============================================
-- Este script verifica que todas las vacaciones tengan el tenant_id correcto
-- y corrige cualquier inconsistencia
-- ============================================

-- 1. Ver vacaciones sin tenant_id o con tenant_id incorrecto
-- ============================================
SELECT 
  v.id,
  v.user_id,
  v.tenant_id as tenant_id_actual,
  p.email as user_email,
  p.tenant_id as tenant_id_correcto,
  t.name as tenant_name,
  t.slug as tenant_slug,
  CASE 
    WHEN v.tenant_id IS NULL THEN '❌ Sin tenant_id'
    WHEN v.tenant_id != p.tenant_id THEN '⚠️ Tenant incorrecto'
    ELSE '✅ Correcto'
  END as estado
FROM vacations v
JOIN profiles p ON p.id = v.user_id
LEFT JOIN tenants t ON t.id = COALESCE(v.tenant_id, p.tenant_id)
WHERE v.tenant_id IS NULL 
   OR v.tenant_id != p.tenant_id
ORDER BY v.created_at DESC;

-- 2. Corregir vacaciones sin tenant_id o con tenant_id incorrecto
-- ============================================
-- Ejecuta esto para corregir todas las vacaciones
UPDATE vacations v
SET tenant_id = p.tenant_id
FROM profiles p
WHERE p.id = v.user_id
  AND (v.tenant_id IS NULL OR v.tenant_id != p.tenant_id);

-- 3. Verificar que todas las vacaciones tienen tenant_id correcto
-- ============================================
SELECT 
  COUNT(*) as total_vacaciones,
  COUNT(CASE WHEN v.tenant_id IS NULL THEN 1 END) as sin_tenant_id,
  COUNT(CASE WHEN v.tenant_id != p.tenant_id THEN 1 END) as tenant_incorrecto,
  COUNT(CASE WHEN v.tenant_id = p.tenant_id THEN 1 END) as correctas
FROM vacations v
JOIN profiles p ON p.id = v.user_id;

-- 4. Ver vacaciones por tenant
-- ============================================
SELECT 
  t.name as empresa,
  t.slug,
  COUNT(*) as total_vacaciones,
  COUNT(CASE WHEN v.status = 'pending' THEN 1 END) as pendientes,
  COUNT(CASE WHEN v.status = 'approved' THEN 1 END) as aprobadas,
  COUNT(CASE WHEN v.status = 'rejected' THEN 1 END) as rechazadas
FROM vacations v
JOIN tenants t ON t.id = v.tenant_id
GROUP BY t.id, t.name, t.slug
ORDER BY t.name;

