-- ============================================
-- ELIMINAR NOTIFICACIONES DE MENSAJES DIRECTOS
-- ============================================
-- Ejecuta este script para eliminar todas las notificaciones de mensajes directos
-- de la campanita. Las notificaciones ahora solo aparecen en la burbuja de chat.

-- 1. Eliminar todas las notificaciones de tipo 'direct_message'
DELETE FROM notifications WHERE type = 'direct_message';

-- 2. Asegurar que el trigger NO esté activo
DROP TRIGGER IF EXISTS trigger_notify_direct_message ON direct_messages;

-- 3. Verificar que se eliminaron (opcional, para confirmar)
-- SELECT COUNT(*) FROM notifications WHERE type = 'direct_message';
-- Debe devolver 0

















