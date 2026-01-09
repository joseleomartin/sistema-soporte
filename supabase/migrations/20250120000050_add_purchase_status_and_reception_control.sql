-- ==================================================================
-- MIGRACIÓN: Agregar Estados de Compra y Sistema de Control de Recepción
-- ==================================================================
-- Fecha: 2025-01-05
-- Descripción: Agrega estados 'recibido' y 'pagado' a las compras,
--              y crea sistema de control de recepción
-- ==================================================================

-- ============================================
-- 1. Agregar columna estado a purchases_materials
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_materials' 
    AND column_name = 'estado'
  ) THEN
    ALTER TABLE purchases_materials 
    DROP CONSTRAINT IF EXISTS purchases_materials_estado_check;
    ALTER TABLE purchases_materials 
    ADD COLUMN IF NOT EXISTS estado text DEFAULT 'pendiente';
    ALTER TABLE purchases_materials 
    ADD CONSTRAINT purchases_materials_estado_check CHECK (estado IN ('pendiente', 'recibido'));
    
    COMMENT ON COLUMN purchases_materials.estado IS 'Estado de recepción: pendiente (no recibido) o recibido';
    RAISE NOTICE 'Columna estado agregada a purchases_materials';
  ELSE
    RAISE NOTICE 'La columna estado ya existe en purchases_materials';
  END IF;
END $$;

-- ============================================
-- 2. Agregar columna estado a purchases_products
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases_products' 
    AND column_name = 'estado'
  ) THEN
    ALTER TABLE purchases_products 
    DROP CONSTRAINT IF EXISTS purchases_products_estado_check;
    ALTER TABLE purchases_products 
    ADD COLUMN IF NOT EXISTS estado text DEFAULT 'pendiente';
    ALTER TABLE purchases_products 
    ADD CONSTRAINT purchases_products_estado_check CHECK (estado IN ('pendiente', 'recibido'));
    
    COMMENT ON COLUMN purchases_products.estado IS 'Estado de recepción: pendiente (no recibido) o recibido';
    RAISE NOTICE 'Columna estado agregada a purchases_products';
  ELSE
    RAISE NOTICE 'La columna estado ya existe en purchases_products';
  END IF;
END $$;

-- ============================================
-- 3. Crear tabla para control de recepción
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_reception_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL, -- order_id de la compra
  purchase_type text NOT NULL CHECK (purchase_type IN ('material', 'product')),
  fecha_recepcion timestamp with time zone DEFAULT now(),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado')),
  controlado_por uuid REFERENCES profiles(id),
  fecha_control timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE purchase_reception_control IS 'Control de recepción de órdenes de compra';
COMMENT ON COLUMN purchase_reception_control.order_id IS 'ID de la orden de compra (order_id de purchases_materials o purchases_products)';
COMMENT ON COLUMN purchase_reception_control.purchase_type IS 'Tipo de compra: material o product';
COMMENT ON COLUMN purchase_reception_control.estado IS 'Estado del control: pendiente o completado';

-- ============================================
-- 4. Crear tabla para items de control de recepción
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_reception_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reception_control_id uuid NOT NULL REFERENCES purchase_reception_control(id) ON DELETE CASCADE,
  item_nombre text NOT NULL, -- Nombre del material o producto
  cantidad_esperada numeric NOT NULL, -- Cantidad que se esperaba recibir
  cantidad_recibida numeric DEFAULT 0, -- Cantidad real recibida (se completa en el control)
  unidad text DEFAULT 'kg', -- Unidad de medida (kg para materiales, unidades para productos)
  observaciones text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE purchase_reception_items IS 'Items individuales de una orden de compra en control de recepción';
COMMENT ON COLUMN purchase_reception_items.cantidad_esperada IS 'Cantidad que se esperaba recibir según la orden de compra';
COMMENT ON COLUMN purchase_reception_items.cantidad_recibida IS 'Cantidad real recibida (se completa durante el control)';

-- ============================================
-- 5. Crear índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_purchase_reception_control_tenant_order 
  ON purchase_reception_control(tenant_id, order_id);

CREATE INDEX IF NOT EXISTS idx_purchase_reception_control_estado 
  ON purchase_reception_control(estado) WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_purchase_reception_items_reception 
  ON purchase_reception_items(reception_control_id);

CREATE INDEX IF NOT EXISTS idx_purchases_materials_estado 
  ON purchases_materials(estado);

CREATE INDEX IF NOT EXISTS idx_purchases_products_estado 
  ON purchases_products(estado);

-- ============================================
-- 6. Función para crear control de recepción cuando se marca como recibido
-- ============================================
CREATE OR REPLACE FUNCTION create_reception_control_on_received()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  control_id uuid;
  item_record RECORD;
  purchase_type_value text;
BEGIN
  -- Solo procesar si el estado cambió a 'recibido'
  IF NEW.estado = 'recibido' AND (OLD.estado IS NULL OR OLD.estado != 'recibido') THEN
    -- Determinar el tipo de compra
    purchase_type_value := CASE 
      WHEN TG_TABLE_NAME = 'purchases_materials' THEN 'material'
      WHEN TG_TABLE_NAME = 'purchases_products' THEN 'product'
      ELSE NULL
    END;
    
    -- Verificar si ya existe un control para esta orden
    SELECT id INTO control_id
    FROM purchase_reception_control
    WHERE tenant_id = NEW.tenant_id
      AND order_id = NEW.order_id
      AND purchase_type = purchase_type_value
    LIMIT 1;

    -- Si no existe, crear uno nuevo
    IF control_id IS NULL THEN
      BEGIN
        INSERT INTO purchase_reception_control (
          tenant_id,
          order_id,
          purchase_type,
          estado
        ) VALUES (
          NEW.tenant_id,
          NEW.order_id,
          purchase_type_value,
          'pendiente'
        ) RETURNING id INTO control_id;
        
        RAISE NOTICE 'Control de recepción creado: id=%, order_id=%, purchase_type=%', control_id, NEW.order_id, purchase_type_value;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error al crear control de recepción: %', SQLERRM;
        RETURN NEW;
      END;

      -- Crear items de control para todos los items de la orden
      IF TG_TABLE_NAME = 'purchases_materials' THEN
        FOR item_record IN 
          SELECT material, cantidad
          FROM purchases_materials
          WHERE tenant_id = NEW.tenant_id
            AND order_id = NEW.order_id
        LOOP
          BEGIN
            INSERT INTO purchase_reception_items (
              tenant_id,
              reception_control_id,
              item_nombre,
              cantidad_esperada,
              unidad
            ) VALUES (
              NEW.tenant_id,
              control_id,
              item_record.material,
              item_record.cantidad,
              'kg'
            );
            RAISE NOTICE 'Item de recepción creado: material=%, cantidad=%', item_record.material, item_record.cantidad;
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error al crear item de recepción: %', SQLERRM;
          END;
        END LOOP;
      ELSIF TG_TABLE_NAME = 'purchases_products' THEN
        FOR item_record IN 
          SELECT producto, cantidad
          FROM purchases_products
          WHERE tenant_id = NEW.tenant_id
            AND order_id = NEW.order_id
        LOOP
          BEGIN
            INSERT INTO purchase_reception_items (
              tenant_id,
              reception_control_id,
              item_nombre,
              cantidad_esperada,
              unidad
            ) VALUES (
              NEW.tenant_id,
              control_id,
              item_record.producto,
              item_record.cantidad,
              'unidades'
            );
            RAISE NOTICE 'Item de recepción creado: producto=%, cantidad=%', item_record.producto, item_record.cantidad;
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error al crear item de recepción: %', SQLERRM;
          END;
        END LOOP;
      END IF;
    ELSE
      RAISE NOTICE 'Control de recepción ya existe para order_id=%, purchase_type=%', NEW.order_id, purchase_type_value;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Crear triggers para crear control automáticamente
-- ============================================
DROP TRIGGER IF EXISTS trigger_create_reception_control_materials ON purchases_materials;
CREATE TRIGGER trigger_create_reception_control_materials
  AFTER UPDATE OF estado ON purchases_materials
  FOR EACH ROW
  WHEN (NEW.estado = 'recibido' AND (OLD.estado IS NULL OR OLD.estado != 'recibido'))
  EXECUTE FUNCTION create_reception_control_on_received();

DROP TRIGGER IF EXISTS trigger_create_reception_control_products ON purchases_products;
CREATE TRIGGER trigger_create_reception_control_products
  AFTER UPDATE OF estado ON purchases_products
  FOR EACH ROW
  WHEN (NEW.estado = 'recibido' AND (OLD.estado IS NULL OR OLD.estado != 'recibido'))
  EXECUTE FUNCTION create_reception_control_on_received();

-- ============================================
-- 8. Función RPC para crear control manualmente (respaldo)
-- ============================================
CREATE OR REPLACE FUNCTION create_reception_control_manual(
  p_order_id uuid,
  p_tenant_id uuid,
  p_purchase_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  control_id uuid;
  item_record RECORD;
BEGIN
  -- Verificar si ya existe un control
  SELECT id INTO control_id
  FROM purchase_reception_control
  WHERE tenant_id = p_tenant_id
    AND order_id = p_order_id
    AND purchase_type = p_purchase_type
  LIMIT 1;

  -- Si no existe, crear uno nuevo
  IF control_id IS NULL THEN
    INSERT INTO purchase_reception_control (
      tenant_id,
      order_id,
      purchase_type,
      estado
    ) VALUES (
      p_tenant_id,
      p_order_id,
      p_purchase_type,
      'pendiente'
    ) RETURNING id INTO control_id;

    -- Crear items de control
    IF p_purchase_type = 'material' THEN
      FOR item_record IN 
        SELECT material, cantidad
        FROM purchases_materials
        WHERE tenant_id = p_tenant_id
          AND order_id = p_order_id
      LOOP
        INSERT INTO purchase_reception_items (
          tenant_id,
          reception_control_id,
          item_nombre,
          cantidad_esperada,
          unidad
        ) VALUES (
          p_tenant_id,
          control_id,
          item_record.material,
          item_record.cantidad,
          'kg'
        );
      END LOOP;
    ELSIF p_purchase_type = 'product' THEN
      FOR item_record IN 
        SELECT producto, cantidad
        FROM purchases_products
        WHERE tenant_id = p_tenant_id
          AND order_id = p_order_id
      LOOP
        INSERT INTO purchase_reception_items (
          tenant_id,
          reception_control_id,
          item_nombre,
          cantidad_esperada,
          unidad
        ) VALUES (
          p_tenant_id,
          control_id,
          item_record.producto,
          item_record.cantidad,
          'unidades'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN control_id;
END;
$$;

-- ============================================
-- 9. RLS Policies
-- ============================================
ALTER TABLE purchase_reception_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_reception_items ENABLE ROW LEVEL SECURITY;

-- Policy para purchase_reception_control
DROP POLICY IF EXISTS "Users can view reception controls in own tenant" ON purchase_reception_control;
CREATE POLICY "Users can view reception controls in own tenant"
  ON purchase_reception_control
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert reception controls in own tenant" ON purchase_reception_control;
CREATE POLICY "Users can insert reception controls in own tenant"
  ON purchase_reception_control
  FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update reception controls in own tenant" ON purchase_reception_control;
CREATE POLICY "Users can update reception controls in own tenant"
  ON purchase_reception_control
  FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Policy para purchase_reception_items
DROP POLICY IF EXISTS "Users can view reception items in own tenant" ON purchase_reception_items;
CREATE POLICY "Users can view reception items in own tenant"
  ON purchase_reception_items
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert reception items in own tenant" ON purchase_reception_items;
CREATE POLICY "Users can insert reception items in own tenant"
  ON purchase_reception_items
  FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update reception items in own tenant" ON purchase_reception_items;
CREATE POLICY "Users can update reception items in own tenant"
  ON purchase_reception_items
  FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

