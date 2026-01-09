-- ==================================================================
-- CREAR CONTROLES DE RECEPCIÓN MANUALMENTE
-- ==================================================================
-- Este script crea controles de recepción para compras que están
-- en estado "recibido" pero no tienen control de recepción
-- ==================================================================

-- 1. Crear controles faltantes para purchases_materials
DO $$
DECLARE
  purchase_record RECORD;
  control_id uuid;
  item_record RECORD;
BEGIN
  -- Iterar sobre compras recibidas sin control
  FOR purchase_record IN 
    SELECT DISTINCT 
      pm.order_id,
      pm.tenant_id
    FROM purchases_materials pm
    WHERE pm.estado = 'recibido'
      AND NOT EXISTS (
        SELECT 1 
        FROM purchase_reception_control prc
        WHERE prc.order_id = pm.order_id
          AND prc.tenant_id = pm.tenant_id
          AND prc.purchase_type = 'material'
      )
  LOOP
    -- Crear el control
    INSERT INTO purchase_reception_control (
      tenant_id,
      order_id,
      purchase_type,
      estado
    ) VALUES (
      purchase_record.tenant_id,
      purchase_record.order_id,
      'material',
      'pendiente'
    ) RETURNING id INTO control_id;
    
    RAISE NOTICE 'Control creado: id=%, order_id=%, tenant_id=%', 
      control_id, purchase_record.order_id, purchase_record.tenant_id;
    
    -- Crear items del control
    FOR item_record IN 
      SELECT material, cantidad
      FROM purchases_materials
      WHERE tenant_id = purchase_record.tenant_id
        AND order_id = purchase_record.order_id
    LOOP
      INSERT INTO purchase_reception_items (
        tenant_id,
        reception_control_id,
        item_nombre,
        cantidad_esperada,
        unidad
      ) VALUES (
        purchase_record.tenant_id,
        control_id,
        item_record.material,
        item_record.cantidad,
        'kg'
      );
      
      RAISE NOTICE 'Item creado: material=%, cantidad=%', 
        item_record.material, item_record.cantidad;
    END LOOP;
  END LOOP;
END $$;

-- 2. Crear controles faltantes para purchases_products
DO $$
DECLARE
  purchase_record RECORD;
  control_id uuid;
  item_record RECORD;
BEGIN
  -- Iterar sobre compras recibidas sin control
  FOR purchase_record IN 
    SELECT DISTINCT 
      pp.order_id,
      pp.tenant_id
    FROM purchases_products pp
    WHERE pp.estado = 'recibido'
      AND NOT EXISTS (
        SELECT 1 
        FROM purchase_reception_control prc
        WHERE prc.order_id = pp.order_id
          AND prc.tenant_id = pp.tenant_id
          AND prc.purchase_type = 'product'
      )
  LOOP
    -- Crear el control
    INSERT INTO purchase_reception_control (
      tenant_id,
      order_id,
      purchase_type,
      estado
    ) VALUES (
      purchase_record.tenant_id,
      purchase_record.order_id,
      'product',
      'pendiente'
    ) RETURNING id INTO control_id;
    
    RAISE NOTICE 'Control creado: id=%, order_id=%, tenant_id=%', 
      control_id, purchase_record.order_id, purchase_record.tenant_id;
    
    -- Crear items del control
    FOR item_record IN 
      SELECT producto, cantidad
      FROM purchases_products
      WHERE tenant_id = purchase_record.tenant_id
        AND order_id = purchase_record.order_id
    LOOP
      INSERT INTO purchase_reception_items (
        tenant_id,
        reception_control_id,
        item_nombre,
        cantidad_esperada,
        unidad
      ) VALUES (
        purchase_record.tenant_id,
        control_id,
        item_record.producto,
        item_record.cantidad,
        'unidades'
      );
      
      RAISE NOTICE 'Item creado: producto=%, cantidad=%', 
        item_record.producto, item_record.cantidad;
    END LOOP;
  END LOOP;
END $$;

-- 3. Verificar los controles creados
SELECT 
  prc.id,
  prc.order_id,
  prc.tenant_id,
  prc.purchase_type,
  prc.estado,
  COUNT(pri.id) as items_count
FROM purchase_reception_control prc
LEFT JOIN purchase_reception_items pri ON pri.reception_control_id = prc.id
WHERE prc.estado = 'pendiente'
GROUP BY prc.id, prc.order_id, prc.tenant_id, prc.purchase_type, prc.estado
ORDER BY prc.created_at DESC;

-- ==================================================================
-- INSTRUCCIONES:
-- ==================================================================
-- 1. Ejecuta este script para crear controles faltantes
-- 2. Esto creará controles para todas las compras "recibidas" que no tienen control
-- 3. Después de ejecutar, verifica en Stock -> Control de Recepción
-- 4. Si aparecen, el problema era que el trigger no se ejecutó
-- 5. Si no aparecen, verifica las políticas RLS o el tenant_id
-- ==================================================================





