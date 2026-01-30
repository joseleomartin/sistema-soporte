-- ============================================
-- Recordatorio de Vacaciones Pendientes 24h Antes
-- ============================================
-- Envía notificaciones a los administradores cuando hay
-- solicitudes de vacaciones/licencias pendientes que comienzan en 24 horas
-- ============================================

-- Habilitar extensión pg_cron si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Función para enviar recordatorios de vacaciones pendientes a administradores
CREATE OR REPLACE FUNCTION send_vacation_reminder_notifications()
RETURNS void AS $$
DECLARE
  vacation_record RECORD;
  admin_user RECORD;
  notification_title TEXT;
  notification_message TEXT;
  vacation_type_text TEXT;
  start_date_formatted TEXT;
  requester_name TEXT;
  requester_email TEXT;
  reminder_count INTEGER := 0;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🔔 INICIANDO RECORDATORIOS DE VACACIONES PENDIENTES';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  -- Buscar vacaciones pendientes que comienzan en las próximas 24 horas
  -- (entre ahora y 24 horas desde ahora)
  FOR vacation_record IN
    SELECT 
      v.id,
      v.user_id,
      v.tenant_id,
      v.type,
      v.start_date,
      v.end_date,
      v.days_count,
      v.reason,
      p.full_name as requester_name,
      p.email as requester_email
    FROM vacations v
    JOIN profiles p ON p.id = v.user_id
    WHERE v.status = 'pending'
      AND v.start_date >= CURRENT_DATE
      AND v.start_date <= CURRENT_DATE + INTERVAL '1 day'
      AND v.tenant_id IS NOT NULL
  LOOP
    -- Formatear el tipo de solicitud
    vacation_type_text := CASE vacation_record.type
      WHEN 'vacation' THEN 'vacaciones'
      WHEN 'license' THEN 'licencia'
      ELSE 'solicitud'
    END;

    -- Formatear fecha de inicio
    start_date_formatted := TO_CHAR(vacation_record.start_date, 'DD/MM/YYYY');

    -- Construir el título y mensaje de la notificación
    notification_title := '⚠️ Recordatorio: Solicitud de ' || vacation_type_text || ' pendiente';
    notification_message := 'La solicitud de ' || vacation_type_text || ' de ' || 
      COALESCE(vacation_record.requester_name, 'un usuario') || 
      ' comienza mañana (' || start_date_formatted || '). ' ||
      'La solicitud está pendiente de aprobación.';
    
    -- Agregar información adicional
    notification_message := notification_message || E'\n\n' ||
      '• Fecha de inicio: ' || start_date_formatted || E'\n' ||
      '• Fecha de fin: ' || TO_CHAR(vacation_record.end_date, 'DD/MM/YYYY') || E'\n' ||
      '• Duración: ' || vacation_record.days_count || ' día' || 
      CASE WHEN vacation_record.days_count != 1 THEN 's' ELSE '' END;
    
    -- Agregar razón si existe
    IF vacation_record.reason IS NOT NULL AND vacation_record.reason != '' THEN
      notification_message := notification_message || E'\n\nRazón: ' || vacation_record.reason;
    END IF;

    -- Enviar notificación a todos los administradores del mismo tenant
    FOR admin_user IN
      SELECT id, email, full_name
      FROM profiles
      WHERE role = 'admin'
        AND tenant_id = vacation_record.tenant_id
        AND email IS NOT NULL
        AND email != ''
    LOOP
      -- Verificar si ya existe una notificación de recordatorio para esta vacación y este admin
      -- (para evitar duplicados si se ejecuta múltiples veces)
      IF NOT EXISTS (
        SELECT 1 
        FROM notifications 
        WHERE user_id = admin_user.id
          AND type = 'vacation_request'
          AND vacation_id = vacation_record.id
          AND metadata->>'is_reminder' = 'true'
          AND created_at >= CURRENT_DATE
      ) THEN
        -- Crear notificación de recordatorio para cada administrador
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          vacation_id,
          tenant_id,
          metadata,
          read
        )
        VALUES (
          admin_user.id,
          'vacation_request',
          notification_title,
          notification_message,
          vacation_record.id,
          vacation_record.tenant_id,
          jsonb_build_object(
            'vacation_id', vacation_record.id,
            'requester_id', vacation_record.user_id,
            'requester_name', vacation_record.requester_name,
            'requester_email', vacation_record.requester_email,
            'type', vacation_record.type,
            'start_date', vacation_record.start_date,
            'end_date', vacation_record.end_date,
            'days_count', vacation_record.days_count,
            'reason', vacation_record.reason,
            'is_reminder', true,
            'reminder_type', '24h_before'
          ),
          false
        );

        reminder_count := reminder_count + 1;
        RAISE NOTICE '✅ Recordatorio creado para admin: % - Solicitud de % de %', 
          admin_user.full_name, vacation_type_text, vacation_record.requester_name;
      ELSE
        RAISE NOTICE 'ℹ️  Ya existe un recordatorio para admin: % - Solicitud de % de % (omitiendo)', 
          admin_user.full_name, vacation_type_text, vacation_record.requester_name;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Proceso completado. Recordatorios creados: %', reminder_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Programar el cron job para ejecutar la función varias veces al día
-- Esto asegura que se detecten todas las solicitudes que comienzan en 24 horas
-- Ejecutar a las 9:00, 13:00 y 17:00 hora Argentina (UTC-3)
-- Formato cron: 'minuto hora día_mes mes día_semana'
DO $$
BEGIN
  -- Eliminar cron jobs existentes si existen (ignorar error si no existen)
  BEGIN
    PERFORM cron.unschedule('vacation-reminder-24h-9am');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️  El cron job 9am no existe, se creará uno nuevo';
  END;

  BEGIN
    PERFORM cron.unschedule('vacation-reminder-24h-1pm');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️  El cron job 1pm no existe, se creará uno nuevo';
  END;

  BEGIN
    PERFORM cron.unschedule('vacation-reminder-24h-5pm');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️  El cron job 5pm no existe, se creará uno nuevo';
  END;
  
  -- Crear cron jobs para ejecutar a diferentes horas del día
  -- 9:00 hora Argentina = 12:00 UTC
  PERFORM cron.schedule(
    'vacation-reminder-24h-9am',
    '0 12 * * *',
    'SELECT send_vacation_reminder_notifications();'
  );
  
  -- 13:00 hora Argentina = 16:00 UTC
  PERFORM cron.schedule(
    'vacation-reminder-24h-1pm',
    '0 16 * * *',
    'SELECT send_vacation_reminder_notifications();'
  );
  
  -- 17:00 hora Argentina = 20:00 UTC
  PERFORM cron.schedule(
    'vacation-reminder-24h-5pm',
    '0 20 * * *',
    'SELECT send_vacation_reminder_notifications();'
  );
  
  RAISE NOTICE '✅ Cron jobs configurados: Recordatorios de vacaciones pendientes';
  RAISE NOTICE '   - 9:00 hora Argentina (12:00 UTC)';
  RAISE NOTICE '   - 13:00 hora Argentina (16:00 UTC)';
  RAISE NOTICE '   - 17:00 hora Argentina (20:00 UTC)';
END $$;

-- ============================================
-- NOTAS
-- ============================================
-- 1. Esta función busca vacaciones pendientes que comienzan en las próximas 24 horas
-- 2. Crea notificaciones para todos los administradores del mismo tenant
-- 3. El trigger de emails (trigger_send_notification_email) se encargará automáticamente
--    de enviar los emails a los administradores
-- 4. Se ejecuta 3 veces al día para asegurar que se detecten todas las solicitudes
-- 5. Evita duplicados verificando si ya existe un recordatorio del mismo día
-- 6. Solo notifica sobre solicitudes pendientes (status = 'pending')
-- ============================================

-- Comentario: Para probar manualmente, ejecuta:
-- SELECT send_vacation_reminder_notifications();

-- Comentario: Para ver los cron jobs programados:
-- SELECT * FROM cron.job WHERE jobname LIKE 'vacation-reminder%';

-- Comentario: Para deshabilitar los cron jobs:
-- SELECT cron.unschedule('vacation-reminder-24h-9am');
-- SELECT cron.unschedule('vacation-reminder-24h-1pm');
-- SELECT cron.unschedule('vacation-reminder-24h-5pm');
