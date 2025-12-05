-- ============================================
-- CORREGIR: Recordatorio de Horas usando Webhook
-- ============================================
-- En lugar de usar pg_net (que no está funcionando),
-- insertamos notificaciones en la tabla notifications
-- y el webhook existente se encarga de enviar los emails
-- ============================================

CREATE OR REPLACE FUNCTION send_hours_reminder_emails()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  email_subject TEXT;
  email_message TEXT;
  user_count INTEGER := 0;
  total_users INTEGER;
  delay_seconds NUMERIC := 2.0; -- 2 segundos entre cada email (permite 0.5 req/seg, muy seguro para el límite de 2)
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
    SELECT id, email, full_name
    FROM profiles
    WHERE email IS NOT NULL 
      AND email != ''
      AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' -- Validar formato de email
  LOOP
    -- Insertar notificación para cada usuario
    -- El webhook existente se encargará de enviar el email
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    )
    VALUES (
      user_record.id,
      'calendar_event', -- Usamos un tipo existente que el webhook procesa
      email_subject,
      email_message,
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

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- Esta función ahora inserta notificaciones en la tabla notifications.
-- El webhook de Database Webhooks (configurado en Supabase Dashboard)
-- se encargará automáticamente de enviar los emails a través de la
-- Edge Function resend-email.
--
-- Ventajas:
-- - No depende de pg_net
-- - Usa el sistema de webhooks que ya está funcionando
-- - Más confiable y consistente
-- ============================================

