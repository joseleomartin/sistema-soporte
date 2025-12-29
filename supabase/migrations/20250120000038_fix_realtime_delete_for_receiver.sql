-- ============================================
-- Corregir Realtime DELETE para que el receptor reciba eventos
-- ============================================
-- El problema: Cuando el remitente borra un mensaje, el receptor no recibe el evento DELETE
-- Solución: Configurar REPLICA IDENTITY FULL para que Realtime pueda transmitir eventos DELETE
-- ============================================

-- 1. Configurar REPLICA IDENTITY FULL para direct_messages
-- Esto permite que Realtime transmita todos los campos del registro eliminado
-- necesario para que el receptor pueda identificar y eliminar el mensaje de su lista
ALTER TABLE direct_messages REPLICA IDENTITY FULL;

-- 2. Verificar que la tabla esté en la publicación de realtime
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

-- 3. Verificar que RLS esté habilitado
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- 4. Verificar que las políticas de SELECT permitan que el receptor vea los mensajes
-- (Esto es necesario para que Realtime pueda transmitir eventos DELETE)
-- La política "Users can view direct messages from own tenant" ya debería existir
-- y permite que tanto sender_id como receiver_id vean el mensaje

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- REPLICA IDENTITY FULL puede tener un impacto en el rendimiento porque
-- almacena todos los campos del registro en el log de replicación.
-- Sin embargo, es necesario para que Realtime pueda transmitir eventos DELETE
-- cuando el receptor necesita recibir información sobre el mensaje eliminado.
-- ============================================

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ REPLICA IDENTITY FULL configurado para direct_messages
-- ✅ Realtime verificado
-- ✅ RLS habilitado
-- 
-- Ahora cuando el remitente borre un mensaje, el receptor debería recibir
-- el evento DELETE a través de Realtime y el mensaje desaparecerá automáticamente
-- ============================================

