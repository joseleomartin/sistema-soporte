-- ============================================
-- Sistema de Presencia de Usuarios
-- ============================================
-- Rastrea el estado de conexión de los usuarios en tiempo real
-- ============================================

-- Crear tabla para rastrear presencia de usuarios
CREATE TABLE IF NOT EXISTS public.user_presence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    is_online BOOLEAN DEFAULT true,
    UNIQUE(user_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON public.user_presence(last_seen);
CREATE INDEX IF NOT EXISTS idx_user_presence_is_online ON public.user_presence(is_online);

-- Habilitar RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
-- Todos pueden ver el estado de presencia de otros usuarios
CREATE POLICY "Anyone can view user presence"
    ON public.user_presence
    FOR SELECT
    USING (true);

-- Los usuarios pueden insertar su propia presencia
CREATE POLICY "Users can insert their own presence"
    ON public.user_presence
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar su propia presencia
CREATE POLICY "Users can update their own presence"
    ON public.user_presence
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Los usuarios pueden eliminar su propia presencia
CREATE POLICY "Users can delete their own presence"
    ON public.user_presence
    FOR DELETE
    USING (auth.uid() = user_id);

-- Función para limpiar presencias antiguas (más de 5 minutos sin actualizar se consideran offline)
CREATE OR REPLACE FUNCTION update_user_presence_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.user_presence
    SET is_online = false
    WHERE last_seen < NOW() - INTERVAL '5 minutes'
    AND is_online = true;
END;
$$;

-- Función para registrar/actualizar presencia de un usuario
CREATE OR REPLACE FUNCTION upsert_user_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_presence (user_id, last_seen, is_online)
    VALUES (auth.uid(), NOW(), true)
    ON CONFLICT (user_id)
    DO UPDATE SET
        last_seen = NOW(),
        is_online = true;
END;
$$;

-- Habilitar Realtime para la tabla
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Configurar REPLICA IDENTITY para que Realtime pueda transmitir cambios
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

-- Comentarios
COMMENT ON TABLE public.user_presence IS 'Rastrea el estado de conexión de los usuarios en tiempo real';
COMMENT ON COLUMN public.user_presence.last_seen IS 'Última vez que el usuario envió un heartbeat';
COMMENT ON COLUMN public.user_presence.is_online IS 'Indica si el usuario está actualmente conectado (última actividad hace menos de 5 minutos)';
