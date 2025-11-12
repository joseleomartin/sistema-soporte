-- ============================================
-- VERIFICAR Y HABILITAR REALTIME PARA NOTIFICACIONES
-- ============================================

-- 1. Verificar que la tabla notifications existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        RAISE EXCEPTION 'La tabla notifications no existe. Ejecuta primero 20251112070000_create_notifications_system.sql';
    END IF;
END $$;

-- 2. Habilitar Realtime para la tabla notifications
DO $$
BEGIN
    -- Intentar agregar la tabla a la publicación
    -- Si ya existe, PostgreSQL ignorará el error
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        RAISE NOTICE 'Tabla notifications agregada a supabase_realtime';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'Tabla notifications ya está en supabase_realtime';
    END;
END $$;

-- 3. Verificar que los triggers están activos
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname IN (
        'trigger_notify_ticket_comment',
        'trigger_notify_ticket_status_change',
        'trigger_notify_calendar_event'
    );
    
    IF trigger_count < 3 THEN
        RAISE WARNING 'Faltan triggers de notificaciones. Encontrados: %. Esperados: 3', trigger_count;
    ELSE
        RAISE NOTICE 'Todos los triggers de notificaciones están activos';
    END IF;
END $$;

-- 4. Verificar políticas RLS
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'notifications';
    
    IF policy_count < 3 THEN
        RAISE WARNING 'Faltan políticas RLS para notifications. Encontradas: %. Esperadas: 3+', policy_count;
    ELSE
        RAISE NOTICE 'Políticas RLS para notifications están configuradas';
    END IF;
END $$;

-- 5. Crear índice para mejorar rendimiento de Realtime
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON notifications(user_id, created_at DESC);

-- 6. Verificar que Realtime está habilitado
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN tablename = ANY(
            SELECT tablename 
            FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime'
        ) THEN '✅ Habilitado'
        ELSE '❌ No habilitado'
    END as realtime_status
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'notifications';

-- 7. Mostrar información de la tabla
SELECT 
    'notifications' as tabla,
    COUNT(*) as total_notificaciones,
    COUNT(*) FILTER (WHERE read = false) as no_leidas,
    COUNT(DISTINCT user_id) as usuarios_con_notificaciones
FROM notifications;

