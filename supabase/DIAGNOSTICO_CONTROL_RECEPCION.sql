-- ==================================================================
-- SCRIPT DE DIAGNÓSTICO: Control de Recepción
-- ==================================================================
-- Este script ayuda a diagnosticar por qué no aparecen los controles
-- de recepción cuando se marca una compra como "recibido"
-- ==================================================================

-- 1. Verificar que las tablas existen
SELECT 
  'purchase_reception_control' as tabla,
  COUNT(*) as registros
FROM purchase_reception_control
UNION ALL
SELECT 
  'purchase_reception_items' as tabla,
  COUNT(*) as registros
FROM purchase_reception_items;

-- 2. Verificar que los triggers existen
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%reception%'
ORDER BY event_object_table, trigger_name;

-- 3. Verificar que la función existe
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'create_reception_control_on_received';

-- 4. Verificar compras marcadas como "recibido"
SELECT 
  'purchases_materials' as tabla,
  COUNT(*) as total_recibidas,
  COUNT(DISTINCT order_id) as ordenes_unicas
FROM purchases_materials
WHERE estado = 'recibido'
UNION ALL
SELECT 
  'purchases_products' as tabla,
  COUNT(*) as total_recibidas,
  COUNT(DISTINCT order_id) as ordenes_unicas
FROM purchases_products
WHERE estado = 'recibido';

-- 5. Verificar controles de recepción existentes
SELECT 
  id,
  tenant_id,
  order_id,
  purchase_type,
  estado,
  fecha_recepcion,
  created_at
FROM purchase_reception_control
ORDER BY created_at DESC
LIMIT 10;

-- 6. Verificar items de recepción
SELECT 
  ri.id,
  ri.reception_control_id,
  ri.item_nombre,
  ri.cantidad_esperada,
  ri.cantidad_recibida,
  rc.order_id,
  rc.purchase_type
FROM purchase_reception_items ri
JOIN purchase_reception_control rc ON ri.reception_control_id = rc.id
ORDER BY ri.created_at DESC
LIMIT 10;

-- 7. Verificar políticas RLS
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
WHERE tablename IN ('purchase_reception_control', 'purchase_reception_items')
ORDER BY tablename, policyname;

-- 8. Verificar si hay compras "recibidas" sin control de recepción
SELECT 
  'purchases_materials' as tabla,
  pm.order_id,
  pm.tenant_id,
  pm.estado,
  pm.material,
  CASE 
    WHEN prc.id IS NULL THEN 'SIN CONTROL'
    ELSE 'CON CONTROL'
  END as tiene_control
FROM purchases_materials pm
LEFT JOIN purchase_reception_control prc 
  ON pm.order_id = prc.order_id 
  AND pm.tenant_id = prc.tenant_id
  AND prc.purchase_type = 'material'
WHERE pm.estado = 'recibido'
ORDER BY pm.created_at DESC
LIMIT 10;

-- 9. Probar manualmente la función (reemplaza los valores con una compra real)
-- SELECT create_reception_control_on_received();

-- ==================================================================
-- INSTRUCCIONES:
-- ==================================================================
-- 1. Ejecuta este script en Supabase SQL Editor
-- 2. Revisa los resultados:
--    - Si no hay triggers, ejecuta la migración 20250120000050
--    - Si hay compras "recibidas" sin control, el trigger no se ejecutó
--    - Si hay errores en las políticas RLS, verifica las políticas
-- 3. Si el trigger no se ejecuta, verifica los logs de Supabase
-- ==================================================================










