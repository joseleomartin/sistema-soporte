-- ============================================
-- Verificar Realtime para DELETE en direct_messages
-- ============================================
-- Asegura que los eventos DELETE se transmitan correctamente
-- ============================================

-- 1. Verificar que la tabla esté en la publicación de realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
    RAISE NOTICE 'Tabla direct_messages agregada a supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabla direct_messages ya está en supabase_realtime';
  END IF;
END $$;

-- 2. Verificar que RLS esté habilitado
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- 3. Verificar que la política de DELETE existe y es correcta
-- (Ya debería existir por la migración 20250120000036_fix_message_edit_permissions.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'direct_messages' 
    AND policyname = 'Users can delete own direct messages in own tenant'
  ) THEN
    RAISE NOTICE 'La política de DELETE para direct_messages no existe. Debe ejecutar la migración 20250120000036_fix_message_edit_permissions.sql primero.';
  ELSE
    RAISE NOTICE 'Política de DELETE para direct_messages verificada correctamente';
  END IF;
END $$;

-- 4. Verificar que la tabla tenga REPLICA IDENTITY configurada para DELETE
-- Esto es necesario para que Realtime pueda transmitir eventos DELETE
DO $$
BEGIN
  -- Verificar si la tabla tiene REPLICA IDENTITY configurada
  IF EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'direct_messages' 
    AND relreplident = 'd'  -- 'd' = default (solo primary key)
  ) THEN
    -- Configurar REPLICA IDENTITY para usar la primary key (esto ya debería estar por defecto)
    -- Pero lo verificamos explícitamente
    RAISE NOTICE 'REPLICA IDENTITY ya está configurada correctamente para direct_messages';
  ELSE
    -- Intentar configurar REPLICA IDENTITY usando la primary key
    ALTER TABLE direct_messages REPLICA IDENTITY DEFAULT;
    RAISE NOTICE 'REPLICA IDENTITY configurada para direct_messages';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Realtime verificado para direct_messages
-- ✅ RLS habilitado
-- ✅ Política de DELETE verificada
-- ✅ REPLICA IDENTITY configurada
-- 
-- Los eventos DELETE deberían transmitirse correctamente ahora
-- ============================================

