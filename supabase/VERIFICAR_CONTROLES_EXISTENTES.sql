-- ==================================================================
-- VERIFICAR CONTROLES DE RECEPCIÓN EXISTENTES
-- ==================================================================
-- Este script verifica si hay controles de recepción en la base de datos
-- ==================================================================

-- 1. Verificar todos los controles (sin filtro de estado)
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
LIMIT 20;

-- 2. Verificar controles pendientes específicamente
SELECT 
  COUNT(*) as total_pendientes
FROM purchase_reception_control
WHERE estado = 'pendiente';

-- 3. Verificar compras recibidas y sus controles
SELECT 
  pm.id as purchase_id,
  pm.order_id,
  pm.tenant_id,
  pm.material,
  pm.estado as purchase_estado,
  prc.id as control_id,
  prc.estado as control_estado,
  CASE 
    WHEN prc.id IS NULL THEN '❌ SIN CONTROL'
    ELSE '✅ CON CONTROL'
  END as tiene_control
FROM purchases_materials pm
LEFT JOIN purchase_reception_control prc 
  ON pm.order_id = prc.order_id 
  AND pm.tenant_id = prc.tenant_id
  AND prc.purchase_type = 'material'
WHERE pm.estado = 'recibido'
ORDER BY pm.created_at DESC
LIMIT 10;

-- 4. Verificar items de recepción
SELECT 
  pri.id,
  pri.reception_control_id,
  pri.item_nombre,
  pri.cantidad_esperada,
  pri.cantidad_recibida,
  prc.order_id,
  prc.purchase_type
FROM purchase_reception_items pri
JOIN purchase_reception_control prc ON pri.reception_control_id = prc.id
ORDER BY pri.created_at DESC
LIMIT 10;

-- 5. Verificar tenant específico (reemplaza con tu tenant_id)
SELECT 
  COUNT(*) as total_controles,
  COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
  COUNT(CASE WHEN estado = 'completado' THEN 1 END) as completados
FROM purchase_reception_control
WHERE tenant_id = '00661e15-a20d-42e2-8ecf-7aa0cd1531fa';

-- ==================================================================
-- INSTRUCCIONES:
-- ==================================================================
-- 1. Ejecuta este script para ver si hay controles en la base de datos
-- 2. Si no hay controles pero hay compras "recibidas", el trigger/RPC no funcionó
-- 3. Si hay controles pero no aparecen en el frontend, puede ser un problema de RLS
-- ==================================================================










