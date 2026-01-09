-- ============================================
-- Verificar y corregir tenant_id en salas de reuniones
-- ============================================
-- Este script verifica que todas las salas de reuniones tengan el tenant_id correcto
-- ============================================

-- 1. Ver salas sin tenant_id o con tenant_id incorrecto
-- ============================================
SELECT 
  mr.id,
  mr.name,
  mr.tenant_id as tenant_id_actual,
  p.email as creador_email,
  p.tenant_id as tenant_id_correcto,
  t.name as tenant_name,
  t.slug as tenant_slug,
  CASE 
    WHEN mr.tenant_id IS NULL THEN '❌ Sin tenant_id'
    WHEN mr.tenant_id != p.tenant_id THEN '⚠️ Tenant incorrecto'
    ELSE '✅ Correcto'
  END as estado
FROM meeting_rooms mr
JOIN profiles p ON p.id = mr.created_by
LEFT JOIN tenants t ON t.id = COALESCE(mr.tenant_id, p.tenant_id)
WHERE mr.tenant_id IS NULL 
   OR mr.tenant_id != p.tenant_id
ORDER BY mr.created_at DESC;

-- 2. Corregir salas sin tenant_id o con tenant_id incorrecto
-- ============================================
UPDATE meeting_rooms mr
SET tenant_id = p.tenant_id
FROM profiles p
WHERE p.id = mr.created_by
  AND (mr.tenant_id IS NULL OR mr.tenant_id != p.tenant_id);

-- 3. Verificar que todas las salas tienen tenant_id correcto
-- ============================================
SELECT 
  COUNT(*) as total_salas,
  COUNT(CASE WHEN mr.tenant_id IS NULL THEN 1 END) as sin_tenant_id,
  COUNT(CASE WHEN mr.tenant_id != p.tenant_id THEN 1 END) as tenant_incorrecto,
  COUNT(CASE WHEN mr.tenant_id = p.tenant_id THEN 1 END) as correctas
FROM meeting_rooms mr
JOIN profiles p ON p.id = mr.created_by;

-- 4. Ver salas por tenant
-- ============================================
SELECT 
  t.name as empresa,
  t.slug,
  COUNT(*) as total_salas,
  COUNT(CASE WHEN mr.is_active = true THEN 1 END) as activas,
  COUNT(CASE WHEN mr.is_active = false THEN 1 END) as inactivas
FROM meeting_rooms mr
JOIN tenants t ON t.id = mr.tenant_id
GROUP BY t.id, t.name, t.slug
ORDER BY t.name;







