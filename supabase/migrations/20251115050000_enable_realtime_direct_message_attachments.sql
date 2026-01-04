-- ============================================
-- Habilitar Realtime para Archivos Adjuntos de Mensajes Directos
-- ============================================
-- Permite actualizaciones en tiempo real cuando se agregan archivos a mensajes
-- ============================================

-- Habilitar realtime para la tabla direct_message_attachments
ALTER PUBLICATION supabase_realtime ADD TABLE direct_message_attachments;




















