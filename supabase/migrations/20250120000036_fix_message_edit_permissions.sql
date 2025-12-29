-- ============================================
-- MIGRACIÓN: Permitir edición y eliminación de mensajes
-- ============================================
-- Permite que los usuarios editen y eliminen sus propios mensajes en forum_messages y direct_messages
-- ============================================

-- 1. FORUM_MESSAGES - Permitir que usuarios editen sus propios mensajes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forum_messages') THEN
    -- Eliminar política existente si solo permite actualizar a admin/support
    DROP POLICY IF EXISTS "Users can update own forum messages in own tenant" ON forum_messages;
    
    -- Crear política que permite a usuarios editar sus propios mensajes
    CREATE POLICY "Users can update own forum messages in own tenant"
      ON forum_messages FOR UPDATE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND (
          created_by = auth.uid()
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
          created_by = auth.uid()
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

-- 2. DIRECT_MESSAGES - Permitir que usuarios editen sus propios mensajes enviados
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'direct_messages') THEN
    -- Eliminar políticas existentes que puedan estar relacionadas
    DROP POLICY IF EXISTS "Users can update read status in own tenant" ON direct_messages;
    DROP POLICY IF EXISTS "Users can update own messages in own tenant" ON direct_messages;
    DROP POLICY IF EXISTS "Users can update read status" ON direct_messages;
    
    -- Crear política que permite:
    -- 1. El remitente puede editar su mensaje (sender_id = auth.uid())
    -- 2. El receptor puede marcar como leído (receiver_id = auth.uid())
    CREATE POLICY "Users can update own messages in own tenant"
      ON direct_messages FOR UPDATE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND (
          sender_id = auth.uid()  -- El remitente puede editar su mensaje
          OR receiver_id = auth.uid()  -- El receptor puede marcar como leído
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND (
          sender_id = auth.uid()  -- El remitente puede editar su mensaje
          OR receiver_id = auth.uid()  -- El receptor puede marcar como leído
        )
      );
  END IF;
END $$;

-- 3. FORUM_MESSAGES - Permitir que usuarios eliminen sus propios mensajes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forum_messages') THEN
    -- Eliminar políticas DELETE existentes
    DROP POLICY IF EXISTS "Users can delete own messages or moderators can delete any" ON forum_messages;
    DROP POLICY IF EXISTS "Users can delete own messages, admin and support can delete any" ON forum_messages;
    DROP POLICY IF EXISTS "Users can delete own forum messages in own tenant" ON forum_messages;
    
    -- Crear política que permite a usuarios eliminar sus propios mensajes
    CREATE POLICY "Users can delete own forum messages in own tenant"
      ON forum_messages FOR DELETE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND (
          created_by = auth.uid()
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

-- 4. DIRECT_MESSAGES - Permitir que usuarios eliminen sus propios mensajes enviados
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'direct_messages') THEN
    -- Eliminar políticas DELETE existentes
    DROP POLICY IF EXISTS "Users can delete own direct messages in own tenant" ON direct_messages;
    
    -- Crear política que permite al remitente eliminar su mensaje
    CREATE POLICY "Users can delete own direct messages in own tenant"
      ON direct_messages FOR DELETE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND sender_id = auth.uid()  -- Solo el remitente puede eliminar su mensaje
      );
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

