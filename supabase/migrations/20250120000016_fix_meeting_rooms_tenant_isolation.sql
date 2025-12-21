-- ============================================
-- Fix: Aislar salas de reuniones por tenant
-- ============================================
-- Este script asegura que las salas de reuniones estén correctamente aisladas por tenant
-- ============================================

-- 1. Verificar que la columna tenant_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'meeting_rooms' 
    AND column_name = 'tenant_id'
  ) THEN
    -- Agregar columna tenant_id si no existe
    ALTER TABLE meeting_rooms 
    ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    
    -- Migrar datos existentes
    UPDATE meeting_rooms 
    SET tenant_id = (
      SELECT p.tenant_id 
      FROM profiles p 
      WHERE p.id = meeting_rooms.created_by 
      LIMIT 1
    )
    WHERE tenant_id IS NULL;
    
    -- Hacer NOT NULL después de migrar
    ALTER TABLE meeting_rooms 
    ALTER COLUMN tenant_id SET NOT NULL;
    
    -- Crear índice
    CREATE INDEX IF NOT EXISTS idx_meeting_rooms_tenant_id ON meeting_rooms(tenant_id);
    
    RAISE NOTICE '✅ Columna tenant_id agregada a meeting_rooms';
  ELSE
    RAISE NOTICE 'ℹ️  Columna tenant_id ya existe en meeting_rooms';
  END IF;
END $$;

-- 2. Migrar cualquier registro que no tenga tenant_id
UPDATE meeting_rooms 
SET tenant_id = (
  SELECT p.tenant_id 
  FROM profiles p 
  WHERE p.id = meeting_rooms.created_by 
  LIMIT 1
)
WHERE tenant_id IS NULL;

-- 3. Eliminar TODAS las políticas RLS existentes
DROP POLICY IF EXISTS "Users can view meeting rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "Users can create meeting rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "Users can update meeting rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "Admin can create meeting rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "Admin can update meeting rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "Admin can delete meeting rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "All authenticated users can view active rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "Users can view meeting rooms from own tenant" ON meeting_rooms;
DROP POLICY IF EXISTS "Users can create meeting rooms in own tenant" ON meeting_rooms;
DROP POLICY IF EXISTS "Users can update meeting rooms in own tenant" ON meeting_rooms;

-- 4. Crear políticas RLS correctas con aislamiento por tenant
CREATE POLICY "Users can view meeting rooms from own tenant"
  ON meeting_rooms FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND is_active = true
  );

CREATE POLICY "Admins can create meeting rooms in own tenant"
  ON meeting_rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Admins can update meeting rooms in own tenant"
  ON meeting_rooms FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Admins can delete meeting rooms in own tenant"
  ON meeting_rooms FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- 5. Verificar que todos los registros tienen tenant_id
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM meeting_rooms
  WHERE tenant_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE WARNING '⚠️  Hay % registros de salas de reuniones sin tenant_id. Estos se migrarán automáticamente.', null_count;
    
    -- Intentar migrar nuevamente
    UPDATE meeting_rooms 
    SET tenant_id = (
      SELECT p.tenant_id 
      FROM profiles p 
      WHERE p.id = meeting_rooms.created_by 
      LIMIT 1
    )
    WHERE tenant_id IS NULL;
  ELSE
    RAISE NOTICE '✅ Todos los registros de salas de reuniones tienen tenant_id asignado';
  END IF;
END $$;

-- 6. Corregir políticas RLS de room_presence
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'room_presence') THEN
    -- Eliminar políticas antiguas
    DROP POLICY IF EXISTS "Anyone can view room presence" ON room_presence;
    DROP POLICY IF EXISTS "Users can insert their own presence" ON room_presence;
    DROP POLICY IF EXISTS "Users can update their own presence" ON room_presence;
    DROP POLICY IF EXISTS "Users can delete their own presence" ON room_presence;
    DROP POLICY IF EXISTS "Users can view room presence from own tenant" ON room_presence;
    DROP POLICY IF EXISTS "Users can update room presence in own tenant" ON room_presence;

    -- Crear políticas correctas con aislamiento por tenant
    CREATE POLICY "Users can view room presence from own tenant"
      ON room_presence FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM meeting_rooms mr
          WHERE mr.id = room_presence.room_id
          AND mr.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Users can insert room presence in own tenant"
      ON room_presence FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM meeting_rooms mr
          WHERE mr.id = room_presence.room_id
          AND mr.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Users can update room presence in own tenant"
      ON room_presence FOR UPDATE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
      );

    CREATE POLICY "Users can delete room presence in own tenant"
      ON room_presence FOR DELETE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
      );
  END IF;
END $$;

-- Comentario
COMMENT ON TABLE meeting_rooms IS 
'Tabla de salas de reuniones con aislamiento multi-tenant. Cada registro está asociado a un tenant_id.';

