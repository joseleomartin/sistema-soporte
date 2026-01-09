-- ==================================================================
-- MIGRACIÓN: Agregar Estados de Venta y Sistema de Control de Recepción
-- ==================================================================
-- Fecha: 2025-01-20
-- Descripción: Agrega estados 'recibido' y 'pagado' a las ventas,
--              y crea sistema de control de recepción similar a compras
--              El stock no se mueve hasta que se confirme la recepción
-- ==================================================================

-- ============================================
-- 1. Agregar columna estado a sales
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'estado'
  ) THEN
    ALTER TABLE sales 
    DROP CONSTRAINT IF EXISTS sales_estado_check;
    ALTER TABLE sales 
    ADD COLUMN IF NOT EXISTS estado text DEFAULT 'pendiente';
    ALTER TABLE sales 
    ADD CONSTRAINT sales_estado_check CHECK (estado IN ('pendiente', 'recibido'));
    
    COMMENT ON COLUMN sales.estado IS 'Estado de recepción: pendiente (cliente no recibió) o recibido (cliente recibió)';
    RAISE NOTICE 'Columna estado agregada a sales';
  ELSE
    RAISE NOTICE 'La columna estado ya existe en sales';
  END IF;
END $$;

-- ============================================
-- 2. Agregar columna pagado a sales
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'pagado'
  ) THEN
    ALTER TABLE sales 
    ADD COLUMN pagado boolean DEFAULT false;
    
    COMMENT ON COLUMN sales.pagado IS 'Indica si la venta está pagada (true) o impaga (false)';
    RAISE NOTICE 'Columna pagado agregada a sales';
  ELSE
    RAISE NOTICE 'La columna pagado ya existe en sales';
  END IF;
END $$;

-- ============================================
-- 3. Crear tabla para control de recepción de ventas
-- ============================================
CREATE TABLE IF NOT EXISTS sales_reception_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL, -- order_id de la venta
  fecha_recepcion timestamp with time zone DEFAULT now(),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completado')),
  controlado_por uuid REFERENCES profiles(id),
  fecha_control timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE sales_reception_control IS 'Control de recepción de órdenes de venta por parte del cliente';
COMMENT ON COLUMN sales_reception_control.order_id IS 'ID de la orden de venta (order_id de sales)';
COMMENT ON COLUMN sales_reception_control.estado IS 'Estado del control: pendiente o completado';

-- ============================================
-- 4. Crear tabla para items de control de recepción de ventas
-- ============================================
CREATE TABLE IF NOT EXISTS sales_reception_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reception_control_id uuid NOT NULL REFERENCES sales_reception_control(id) ON DELETE CASCADE,
  item_nombre text NOT NULL, -- Nombre del producto
  tipo_producto text NOT NULL CHECK (tipo_producto IN ('fabricado', 'reventa')),
  cantidad_esperada numeric NOT NULL, -- Cantidad que se esperaba entregar
  cantidad_recibida numeric DEFAULT 0, -- Cantidad real recibida (se completa en el control)
  unidad text DEFAULT 'unidades', -- Unidad de medida
  observaciones text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE sales_reception_items IS 'Items individuales de una orden de venta en control de recepción';
COMMENT ON COLUMN sales_reception_items.cantidad_esperada IS 'Cantidad que se esperaba entregar según la orden de venta';
COMMENT ON COLUMN sales_reception_items.cantidad_recibida IS 'Cantidad real recibida por el cliente (se completa durante el control)';

-- ============================================
-- 5. Crear índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sales_reception_control_tenant_order 
  ON sales_reception_control(tenant_id, order_id);

CREATE INDEX IF NOT EXISTS idx_sales_reception_control_estado 
  ON sales_reception_control(estado) WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_sales_reception_items_reception 
  ON sales_reception_items(reception_control_id);

CREATE INDEX IF NOT EXISTS idx_sales_estado 
  ON sales(estado);

CREATE INDEX IF NOT EXISTS idx_sales_pagado 
  ON sales(pagado);

-- ============================================
-- 6. Función para crear control de recepción cuando se marca como recibido
-- ============================================
CREATE OR REPLACE FUNCTION create_sales_reception_control_on_received()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  control_id uuid;
  item_record RECORD;
BEGIN
  -- Solo procesar si el estado cambió a 'recibido'
  IF NEW.estado = 'recibido' AND (OLD.estado IS NULL OR OLD.estado != 'recibido') THEN
    -- Verificar si ya existe un control para esta orden
    SELECT id INTO control_id
    FROM sales_reception_control
    WHERE tenant_id = NEW.tenant_id
      AND order_id = NEW.order_id
    LIMIT 1;

    -- Si no existe, crear uno nuevo
    IF control_id IS NULL THEN
      BEGIN
        INSERT INTO sales_reception_control (
          tenant_id,
          order_id,
          estado
        ) VALUES (
          NEW.tenant_id,
          NEW.order_id,
          'pendiente'
        ) RETURNING id INTO control_id;
        
        RAISE NOTICE 'Control de recepción de venta creado: id=%, order_id=%', control_id, NEW.order_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error al crear control de recepción de venta: %', SQLERRM;
        RETURN NEW;
      END;

      -- Crear items de control para todos los items de la orden
      FOR item_record IN 
        SELECT producto, tipo_producto, cantidad
        FROM sales
        WHERE tenant_id = NEW.tenant_id
          AND order_id = NEW.order_id
      LOOP
        BEGIN
          INSERT INTO sales_reception_items (
            tenant_id,
            reception_control_id,
            item_nombre,
            tipo_producto,
            cantidad_esperada,
            unidad
          ) VALUES (
            NEW.tenant_id,
            control_id,
            item_record.producto,
            item_record.tipo_producto,
            item_record.cantidad,
            'unidades'
          );
          RAISE NOTICE 'Item de recepción de venta creado: producto=%, cantidad=%', item_record.producto, item_record.cantidad;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Error al crear item de recepción de venta: %', SQLERRM;
        END;
      END LOOP;
    ELSE
      RAISE NOTICE 'Control de recepción de venta ya existe para order_id=%', NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Crear trigger para crear control automáticamente
-- ============================================
DROP TRIGGER IF EXISTS trigger_create_sales_reception_control ON sales;
CREATE TRIGGER trigger_create_sales_reception_control
  AFTER UPDATE OF estado ON sales
  FOR EACH ROW
  WHEN (NEW.estado = 'recibido' AND (OLD.estado IS NULL OR OLD.estado != 'recibido'))
  EXECUTE FUNCTION create_sales_reception_control_on_received();

-- ============================================
-- 8. Función RPC para crear control manualmente (respaldo)
-- ============================================
CREATE OR REPLACE FUNCTION create_sales_reception_control_manual(
  p_order_id uuid,
  p_tenant_id uuid
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
  FROM sales_reception_control
  WHERE tenant_id = p_tenant_id
    AND order_id = p_order_id
  LIMIT 1;

  -- Si no existe, crear uno nuevo
  IF control_id IS NULL THEN
    INSERT INTO sales_reception_control (
      tenant_id,
      order_id,
      estado
    ) VALUES (
      p_tenant_id,
      p_order_id,
      'pendiente'
    ) RETURNING id INTO control_id;

    -- Crear items de control
    FOR item_record IN 
      SELECT producto, tipo_producto, cantidad
      FROM sales
      WHERE tenant_id = p_tenant_id
        AND order_id = p_order_id
    LOOP
      INSERT INTO sales_reception_items (
        tenant_id,
        reception_control_id,
        item_nombre,
        tipo_producto,
        cantidad_esperada,
        unidad
      ) VALUES (
        p_tenant_id,
        control_id,
        item_record.producto,
        item_record.tipo_producto,
        item_record.cantidad,
        'unidades'
      );
    END LOOP;
  END IF;

  RETURN control_id;
END;
$$;

-- ============================================
-- 9. RLS Policies
-- ============================================
ALTER TABLE sales_reception_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_reception_items ENABLE ROW LEVEL SECURITY;

-- Policy para sales_reception_control
DROP POLICY IF EXISTS "Users can view sales reception controls in own tenant" ON sales_reception_control;
CREATE POLICY "Users can view sales reception controls in own tenant"
  ON sales_reception_control
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert sales reception controls in own tenant" ON sales_reception_control;
CREATE POLICY "Users can insert sales reception controls in own tenant"
  ON sales_reception_control
  FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update sales reception controls in own tenant" ON sales_reception_control;
CREATE POLICY "Users can update sales reception controls in own tenant"
  ON sales_reception_control
  FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Policy para sales_reception_items
DROP POLICY IF EXISTS "Users can view sales reception items in own tenant" ON sales_reception_items;
CREATE POLICY "Users can view sales reception items in own tenant"
  ON sales_reception_items
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert sales reception items in own tenant" ON sales_reception_items;
CREATE POLICY "Users can insert sales reception items in own tenant"
  ON sales_reception_items
  FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update sales reception items in own tenant" ON sales_reception_items;
CREATE POLICY "Users can update sales reception items in own tenant"
  ON sales_reception_items
  FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ============================================
-- FIN DEL SCRIPT
-- ============================================


