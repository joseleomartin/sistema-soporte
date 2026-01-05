-- ==================================================================
-- MIGRACIÓN: Asegurar Recordatorios de Horas para Todas las Empresas
-- ==================================================================
-- Fecha: 2025-01-20
-- Descripción: Asegura que la función send_hours_reminder_emails()
--              envíe recordatorios a TODOS los usuarios, incluyendo
--              empresas de producción
-- ==================================================================

-- Actualizar función send_hours_reminder_emails para enviar a TODOS los usuarios
-- (sin filtrar por tipo de empresa)
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
  -- Contar usuarios totales primero (TODOS los usuarios, sin filtrar por tipo de empresa)
  SELECT COUNT(*) INTO total_users
  FROM profiles
  WHERE email IS NOT NULL 
    AND email != ''
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND tenant_id IS NOT NULL;
  
  -- Asunto del email
  email_subject := 'Recordatorio de Carga de Horas';

  -- Mensaje del email
  email_message := 'Este es un recordatorio diario para que cargues las horas trabajadas del día de hoy. No olvides registrar tu tiempo en la plataforma EmaGroup.';

  -- Iterar sobre TODOS los usuarios con email válido (incluyendo empresas de producción)
  -- Agregar delay entre cada inserción para evitar rate limiting de Resend (2 req/seg)
  FOR user_record IN 
    SELECT id, email, full_name, tenant_id
    FROM profiles
    WHERE email IS NOT NULL 
      AND email != ''
      AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' -- Validar formato de email
      AND tenant_id IS NOT NULL -- Solo usuarios con tenant_id
      -- NO FILTRAR por tipo de empresa - incluir TODOS los tenants
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
  RAISE NOTICE '📊 Total de usuarios: % (incluyendo empresas de producción)', total_users;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================================
-- NOTAS:
-- ==================================================================
-- - La función ahora envía recordatorios a TODOS los usuarios
-- - NO filtra por loadout_type del tenant (incluye empresas de producción)
-- - Para probar manualmente: SELECT send_hours_reminder_emails();
-- ==================================================================

