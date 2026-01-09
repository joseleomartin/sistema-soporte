-- ==================================================================
-- MIGRACIÓN: Excluir Empresas de Producción de Recordatorios de Horas
-- ==================================================================
-- Fecha: 2025-01-05
-- Descripción: Actualiza la función send_hours_reminder_emails() para
--              EXCLUIR usuarios de empresas con loadout_type = 'produccion'
-- ==================================================================

-- Actualizar función send_hours_reminder_emails para EXCLUIR empresas de producción
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
  tenant_loadout_type text;
BEGIN
  -- Contar usuarios totales (EXCLUYENDO empresas de producción)
  SELECT COUNT(*) INTO total_users
  FROM profiles p
  INNER JOIN tenants t ON p.tenant_id = t.id
  WHERE p.email IS NOT NULL 
    AND p.email != ''
    AND p.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND p.tenant_id IS NOT NULL
    AND (t.loadout_type IS NULL OR t.loadout_type != 'produccion'); -- EXCLUIR empresas de producción
  
  -- Asunto del email
  email_subject := 'Recordatorio de Carga de Horas';

  -- Mensaje del email
  email_message := 'Este es un recordatorio diario para que cargues las horas trabajadas del día de hoy. No olvides registrar tu tiempo en la plataforma EmaGroup.';

  -- Iterar sobre usuarios con email válido (EXCLUYENDO empresas de producción)
  -- Agregar delay entre cada inserción para evitar rate limiting de Resend (2 req/seg)
  FOR user_record IN 
    SELECT p.id, p.email, p.full_name, p.tenant_id, t.loadout_type
    FROM profiles p
    INNER JOIN tenants t ON p.tenant_id = t.id
    WHERE p.email IS NOT NULL 
      AND p.email != ''
      AND p.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' -- Validar formato de email
      AND p.tenant_id IS NOT NULL -- Solo usuarios con tenant_id
      AND (t.loadout_type IS NULL OR t.loadout_type != 'produccion') -- EXCLUIR empresas de producción
  LOOP
    -- Obtener tenant_id del usuario
    user_tenant_id := user_record.tenant_id;
    tenant_loadout_type := user_record.loadout_type;
    
    -- Verificar que tenemos tenant_id
    IF user_tenant_id IS NULL THEN
      RAISE WARNING 'Usuario % no tiene tenant_id, saltando...', user_record.id;
      CONTINUE;
    END IF;

    -- Verificar que no sea empresa de producción (doble verificación)
    IF tenant_loadout_type = 'produccion' THEN
      RAISE NOTICE '⏭️  Saltando usuario % de empresa de producción (loadout_type: %)', user_record.email, tenant_loadout_type;
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
  RAISE NOTICE '📊 Total de usuarios: % (EXCLUYENDO empresas de producción)', total_users;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================================
-- NOTAS:
-- ==================================================================
-- - La función ahora EXCLUYE usuarios de empresas con loadout_type = 'produccion'
-- - Solo envía recordatorios a empresas de servicios o personalizadas
-- - Para probar manualmente: SELECT send_hours_reminder_emails();
-- ==================================================================










