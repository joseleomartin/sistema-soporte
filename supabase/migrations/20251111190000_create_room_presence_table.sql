-- Crear tabla para rastrear presencia en salas de reunión
CREATE TABLE IF NOT EXISTS public.room_presence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_room_presence_room_id ON public.room_presence(room_id);
CREATE INDEX IF NOT EXISTS idx_room_presence_user_id ON public.room_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_room_presence_last_seen ON public.room_presence(last_seen);

-- Habilitar RLS
ALTER TABLE public.room_presence ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
-- Todos pueden ver quién está en las salas
CREATE POLICY "Anyone can view room presence"
    ON public.room_presence
    FOR SELECT
    USING (true);

-- Los usuarios pueden insertar su propia presencia
CREATE POLICY "Users can insert their own presence"
    ON public.room_presence
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar su propia presencia
CREATE POLICY "Users can update their own presence"
    ON public.room_presence
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Los usuarios pueden eliminar su propia presencia
CREATE POLICY "Users can delete their own presence"
    ON public.room_presence
    FOR DELETE
    USING (auth.uid() = user_id);

-- Función para limpiar presencias antiguas (más de 5 minutos sin actualizar)
CREATE OR REPLACE FUNCTION clean_old_room_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.room_presence
    WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$;

-- Comentarios
COMMENT ON TABLE public.room_presence IS 'Rastrea qué usuarios están actualmente en cada sala de reunión';
COMMENT ON COLUMN public.room_presence.last_seen IS 'Última vez que el usuario envió un heartbeat';































