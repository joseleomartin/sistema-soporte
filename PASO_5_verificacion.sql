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


