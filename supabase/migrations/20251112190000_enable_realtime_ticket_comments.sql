-- Habilitar Realtime para ticket_comments
-- Esto permite que los comentarios se actualicen en tiempo real sin recargar la página

DO $$
BEGIN
    -- Verificar si ticket_comments ya está en la publicación de Realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'ticket_comments'
    ) THEN
        -- Agregar ticket_comments a la publicación de Realtime
        ALTER PUBLICATION supabase_realtime ADD TABLE ticket_comments;
        RAISE NOTICE '✅ Tabla ticket_comments agregada a supabase_realtime';
    ELSE
        RAISE NOTICE 'ℹ️ Tabla ticket_comments ya está en supabase_realtime';
    END IF;
END $$;

