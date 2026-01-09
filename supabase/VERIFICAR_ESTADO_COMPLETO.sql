-- ==================================================================
-- VERIFICACIÓN COMPLETA DEL ESTADO DEL SISTEMA
-- ==================================================================

-- 1. Verificar que los triggers existen y están activos
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_orientation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%reception%'
ORDER BY event_object_table, trigger_name;

-- 2. Verificar compras en estado "recibido"
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

-- 3. Verificar controles de recepción existentes
SELECT 
  COUNT(*) as total_controles,
  COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
  COUNT(CASE WHEN estado = 'completado' THEN 1 END) as completados
FROM purchase_reception_control;

-- 4. COMPARACIÓN: Compras recibidas vs Controles creados
SELECT 
  'purchases_materials' as tabla,
  COUNT(DISTINCT pm.order_id) as compras_recibidas,
  COUNT(DISTINCT prc.order_id) as controles_creados,
  COUNT(DISTINCT pm.order_id) - COUNT(DISTINCT prc.order_id) as faltantes
FROM purchases_materials pm
LEFT JOIN purchase_reception_control prc 
  ON pm.order_id = prc.order_id 
  AND pm.tenant_id = prc.tenant_id
  AND prc.purchase_type = 'material'
WHERE pm.estado = 'recibido'
UNION ALL
SELECT 
  'purchases_products' as tabla,
  COUNT(DISTINCT pp.order_id) as compras_recibidas,
  COUNT(DISTINCT prc.order_id) as controles_creados,
  COUNT(DISTINCT pp.order_id) - COUNT(DISTINCT prc.order_id) as faltantes
FROM purchases_products pp
LEFT JOIN purchase_reception_control prc 
  ON pp.order_id = prc.order_id 
  AND pp.tenant_id = prc.tenant_id
  AND prc.purchase_type = 'product'
WHERE pp.estado = 'recibido';

-- 5. Detalle de compras recibidas SIN control
SELECT 
  'purchases_materials' as tabla,
  pm.id,
  pm.order_id,
  pm.tenant_id,
  pm.material,
  pm.cantidad,
  pm.estado,
  pm.created_at,
  CASE 
    WHEN prc.id IS NULL THEN '❌ SIN CONTROL'
    ELSE '✅ CON CONTROL'
  END as estado_control
FROM purchases_materials pm
LEFT JOIN purchase_reception_control prc 
  ON pm.order_id = prc.order_id 
  AND pm.tenant_id = prc.tenant_id
  AND prc.purchase_type = 'material'
WHERE pm.estado = 'recibido'
ORDER BY pm.created_at DESC
LIMIT 10;

-- 6. Verificar que order_id no sea NULL
SELECT 
  'purchases_materials' as tabla,
  COUNT(*) as total,
  COUNT(CASE WHEN order_id IS NULL THEN 1 END) as sin_order_id
FROM purchases_materials
WHERE estado = 'recibido'
UNION ALL
SELECT 
  'purchases_products' as tabla,
  COUNT(*) as total,
  COUNT(CASE WHEN order_id IS NULL THEN 1 END) as sin_order_id
FROM purchases_products
WHERE estado = 'recibido';

-- ==================================================================
-- INTERPRETACIÓN DE RESULTADOS:
-- ==================================================================
-- 1. Si "faltantes" > 0: El trigger no se ejecutó para esas compras
-- 2. Si "sin_order_id" > 0: Las compras no tienen order_id (problema)
-- 3. Si los triggers no aparecen: La migración no se ejecutó completamente
-- ==================================================================





