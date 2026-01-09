-- ==================================================================
-- VERIFICAR SI EL TRIGGER SE ESTÁ EJECUTANDO
-- ==================================================================
-- Este script verifica si el trigger se ejecuta cuando se marca una compra como recibido
-- ==================================================================

-- 1. Verificar que el trigger existe y está activo
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement,
  action_orientation
FROM information_schema.triggers
WHERE trigger_name LIKE '%reception%'
ORDER BY event_object_table, trigger_name;

-- 2. Verificar la función del trigger
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'create_reception_control_on_received';

-- 3. Verificar compras que están en estado "recibido"
SELECT 
  'purchases_materials' as tabla,
  id,
  order_id,
  tenant_id,
  material,
  cantidad,
  estado,
  created_at
FROM purchases_materials
WHERE estado = 'recibido'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Verificar si hay controles de recepción para esas compras
SELECT 
  prc.id as control_id,
  prc.order_id,
  prc.tenant_id,
  prc.purchase_type,
  prc.estado as control_estado,
  prc.created_at as control_created_at,
  pm.id as purchase_id,
  pm.material,
  pm.estado as purchase_estado
FROM purchase_reception_control prc
RIGHT JOIN purchases_materials pm 
  ON prc.order_id = pm.order_id 
  AND prc.tenant_id = pm.tenant_id
WHERE pm.estado = 'recibido'
ORDER BY pm.created_at DESC
LIMIT 10;

-- 5. Verificar los logs más recientes (si tienes acceso)
-- SELECT * FROM postgres_logs WHERE message LIKE '%reception%' ORDER BY log_time DESC LIMIT 20;

-- 6. Probar manualmente el trigger con una compra específica
-- (Reemplaza los valores con una compra real que esté en estado "recibido")
/*
DO $$
DECLARE
  test_order_id uuid;
  test_tenant_id uuid;
BEGIN
  -- Obtener una compra recibida
  SELECT order_id, tenant_id INTO test_order_id, test_tenant_id
  FROM purchases_materials
  WHERE estado = 'recibido'
  LIMIT 1;
  
  IF test_order_id IS NOT NULL THEN
    RAISE NOTICE 'Probando con order_id: %, tenant_id: %', test_order_id, test_tenant_id;
    
    -- Verificar si ya existe un control
    IF EXISTS (
      SELECT 1 FROM purchase_reception_control 
      WHERE order_id = test_order_id AND tenant_id = test_tenant_id
    ) THEN
      RAISE NOTICE 'Ya existe un control para esta orden';
    ELSE
      RAISE NOTICE 'NO existe un control para esta orden - el trigger no se ejecutó';
    END IF;
  ELSE
    RAISE NOTICE 'No hay compras en estado recibido para probar';
  END IF;
END $$;
*/

-- ==================================================================
-- INSTRUCCIONES:
-- ==================================================================
-- 1. Ejecuta este script para verificar el estado del trigger
-- 2. Si el trigger existe pero no se ejecuta, verifica:
--    - Que la compra realmente cambió a estado "recibido"
--    - Que el order_id coincide
--    - Que el tenant_id coincide
-- 3. Si no hay controles para compras recibidas, el trigger no se ejecutó
-- ==================================================================





