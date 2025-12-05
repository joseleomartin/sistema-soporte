-- ============================================
-- Habilitar Realtime para Archivos Adjuntos de Tareas
-- ============================================
-- Permite actualizaciones en tiempo real cuando se agregan archivos a mensajes de tareas
-- ============================================

-- Habilitar realtime para la tabla task_attachments
DO $$
BEGIN
    -- Verificar si task_attachments ya está en la publicación
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'task_attachments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE task_attachments;
        RAISE NOTICE 'Tabla task_attachments agregada a supabase_realtime';
    ELSE
        RAISE NOTICE 'Tabla task_attachments ya está en supabase_realtime';
    END IF;
END $$;


