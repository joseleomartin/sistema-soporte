-- ============================================
-- MIGRACIÓN: Permitir edición y eliminación de mensajes en task_messages
-- ============================================
-- Permite que los usuarios editen y eliminen sus propios mensajes en task_messages
-- ============================================

-- 1. TASK_MESSAGES - Permitir que usuarios editen sus propios mensajes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_messages') THEN
    -- Eliminar TODAS las políticas UPDATE existentes para evitar conflictos
    DROP POLICY IF EXISTS "Users can update own task messages in own tenant" ON task_messages;
    DROP POLICY IF EXISTS "Users can update task messages" ON task_messages;
    DROP POLICY IF EXISTS "Users can update task messages in own tenant" ON task_messages;
    DROP POLICY IF EXISTS "Usuarios pueden actualizar mensajes de sus tareas" ON task_messages;
    
    -- Crear política UPDATE que permite a usuarios editar sus propios mensajes o a admin/support editar cualquiera
    CREATE POLICY "Users can update own task messages in own tenant"
      ON task_messages FOR UPDATE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'support')
            AND profiles.tenant_id = get_user_tenant_id()
          )
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'support')
            AND profiles.tenant_id = get_user_tenant_id()
          )
        )
      );
  END IF;
END $$;

-- 2. TASK_MESSAGES - Permitir que usuarios eliminen sus propios mensajes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_messages') THEN
    -- Eliminar política DELETE existente
    DROP POLICY IF EXISTS "Users can delete own task messages in own tenant" ON task_messages;
    
    -- Crear política DELETE que permite a usuarios eliminar sus propios mensajes o a admin/support eliminar cualquiera
    CREATE POLICY "Users can delete own task messages in own tenant"
      ON task_messages FOR DELETE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'support')
            AND profiles.tenant_id = get_user_tenant_id()
          )
        )
      );
  END IF;
END $$;

-- 3. Verificar que Realtime esté habilitado para task_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'task_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;
    RAISE NOTICE 'Tabla task_messages agregada a supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabla task_messages ya está en supabase_realtime';
  END IF;
END $$;

-- 4. Configurar REPLICA IDENTITY FULL para task_messages (necesario para eventos DELETE en Realtime)
ALTER TABLE task_messages REPLICA IDENTITY FULL;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Políticas UPDATE y DELETE creadas para task_messages
-- ✅ Realtime verificado para task_messages
-- ✅ REPLICA IDENTITY FULL configurado
-- 
-- Ahora los usuarios pueden editar y eliminar sus propios mensajes en las tareas
-- ============================================

