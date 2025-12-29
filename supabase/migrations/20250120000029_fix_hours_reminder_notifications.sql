-- ==================================================================
-- MIGRACIÓN: Corregir Notificaciones de Recordatorio de Carga de Horas
-- ==================================================================
-- Fecha: 2025-01-20
-- Descripción: Corrige la función send_hours_reminder_emails() para usar
--              el tipo correcto 'time_entry_reminder' e incluir tenant_id
-- ==================================================================

-- 1. Asegurar que 'time_entry_reminder' está en el CHECK constraint
-- ==================================================================
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'calendar_event', 
  'ticket_comment', 
  'ticket_status',
  'task_assigned',
  'task_mention',
  'forum_mention',
  'direct_message',
  'birthday',
  'ticket_created',
  'social_post',
  'professional_news',
  'time_entry_reminder'
));

-- 2. Corregir función send_hours_reminder_emails para usar el tipo correcto y tenant_id
-- ==================================================================
CREATE OR REPLACE FUNCTION send_hours_reminder_emails()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  email_subject TEXT;
  email_message TEXT;
  user_count INTEGER := 0;
  total_users INTEGER;
  delay_seconds NUMERIC := 2.0; -- 2 segundos entre cada email (permite 0.5 req/seg, muy seguro para el límite de 2)
  user_tenant_id uuid;
BEGIN
  -- Contar usuarios totales primero
  SELECT COUNT(*) INTO total_users
  FROM profiles
  WHERE email IS NOT NULL 
    AND email != ''
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
  
  -- Asunto del email
  email_subject := 'Recordatorio de Carga de Horas';

  -- Mensaje del email
  email_message := 'Este es un recordatorio diario para que cargues las horas trabajadas del día de hoy. No olvides registrar tu tiempo en la plataforma EmaGroup.';

  -- Iterar sobre todos los usuarios con email válido
  -- Agregar delay entre cada inserción para evitar rate limiting de Resend (2 req/seg)
  FOR user_record IN 
    SELECT id, email, full_name, tenant_id
    FROM profiles
    WHERE email IS NOT NULL 
      AND email != ''
      AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' -- Validar formato de email
      AND tenant_id IS NOT NULL -- Solo usuarios con tenant_id
  LOOP
    -- Obtener tenant_id del usuario
    user_tenant_id := user_record.tenant_id;
    
    -- Verificar que tenemos tenant_id
    IF user_tenant_id IS NULL THEN
      RAISE WARNING 'Usuario % no tiene tenant_id, saltando...', user_record.id;
      CONTINUE;
    END IF;

    -- Insertar notificación para cada usuario con el tipo correcto y tenant_id
    -- El webhook existente se encargará de enviar el email
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      tenant_id,
      metadata
    )
    VALUES (
      user_record.id,
      'time_entry_reminder', -- Tipo correcto para recordatorios de carga de horas
      email_subject,
      email_message,
      user_tenant_id, -- Incluir tenant_id para multi-tenancy
      jsonb_build_object(
        'is_hours_reminder', true,
        'reminder_type', 'daily_hours'
      )
    );
    
    user_count := user_count + 1;
    RAISE NOTICE '✅ Notificación de recordatorio creada para: % (%) [%/%]', 
      user_record.full_name, user_record.email, user_count, total_users;
    
    -- Esperar antes de crear la siguiente notificación para evitar rate limiting
    -- Usar pg_sleep para agregar delay (solo si no es el último usuario)
    IF user_count < total_users THEN
      PERFORM pg_sleep(delay_seconds);
    END IF;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Proceso de recordatorios de carga de horas completado';
  RAISE NOTICE '📧 Los emails se enviarán a través del webhook existente';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================================
-- NOTAS:
-- ==================================================================
-- - La función ahora usa el tipo 'time_entry_reminder' correctamente
-- - Incluye tenant_id para respetar multi-tenancy
-- - El webhook de Database Webhooks se encargará de enviar los emails
-- - Para probar manualmente: SELECT send_hours_reminder_emails();
-- ==================================================================

