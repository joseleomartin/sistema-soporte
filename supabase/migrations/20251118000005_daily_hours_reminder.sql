-- ============================================
-- Recordatorio Diario de Carga de Horas
-- ============================================
-- Envía un email recordatorio a todos los usuarios
-- todos los días a las 17:00 horas para cargar sus horas trabajadas
-- ============================================

-- Habilitar extensión pg_cron si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Función para enviar recordatorios de carga de horas a todos los usuarios
CREATE OR REPLACE FUNCTION send_hours_reminder_emails()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  edge_function_url TEXT;
  supabase_url TEXT;
  anon_key_val TEXT;
  payload JSONB;
  frontend_url TEXT;
  email_html TEXT;
  email_subject TEXT;
BEGIN
  -- Obtener la URL de Supabase desde app_settings
  BEGIN
    SELECT value INTO supabase_url
    FROM app_settings
    WHERE key = 'supabase_url'
    LIMIT 1;
    
    IF supabase_url IS NULL OR supabase_url = '' THEN
      supabase_url := 'https://yevbgutnuoivcuqnmrzi.supabase.co';
      RAISE NOTICE '⚠️  Usando URL por defecto. Configura app_settings para personalizar.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    supabase_url := 'https://yevbgutnuoivcuqnmrzi.supabase.co';
    RAISE NOTICE '⚠️  Tabla app_settings no encontrada. Usando URL por defecto.';
  END;

  -- Obtener anon key
  SELECT value INTO anon_key_val FROM app_settings WHERE key = 'supabase_anon_key' LIMIT 1;
  
  IF anon_key_val IS NULL OR anon_key_val = '' THEN
    RAISE EXCEPTION '❌ supabase_anon_key no está configurado en app_settings';
  END IF;

  -- Obtener FRONTEND_URL desde app_settings o usar valor por defecto
  BEGIN
    SELECT value INTO frontend_url
    FROM app_settings
    WHERE key = 'frontend_url'
    LIMIT 1;
    
    IF frontend_url IS NULL OR frontend_url = '' THEN
      frontend_url := 'https://app.somosemagroup.com';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    frontend_url := 'https://app.somosemagroup.com';
  END;

  -- Construir la URL de la Edge Function
  edge_function_url := supabase_url || '/functions/v1/resend-email';

  -- Asunto del email
  email_subject := 'EmaGroup Notificaciones: Recordatorio de Carga de Horas';

  -- HTML del email
  email_html := '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">' ||
                '<div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">' ||
                '<h1 style="color: white; margin: 0; font-size: 24px;">EmaGroup</h1>' ||
                '</div>' ||
                '<div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">' ||
                '<h2 style="color: #111827; margin-top: 0; font-size: 20px;">' || email_subject || '</h2>' ||
                '<p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">' ||
                'Este es un recordatorio diario para que cargues las horas trabajadas del día de hoy. ' ||
                'No olvides registrar tu tiempo en la plataforma EmaGroup.' ||
                '</p>' ||
                '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">' ||
                '<a href="' || frontend_url || '" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 10px 0;">Ir a Cargar Horas</a>' ||
                '<p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">Haz clic en el botón para ir directamente a la sección de carga de horas.</p>' ||
                '</div>' ||
                '</div>' ||
                '<div style="text-align: center; margin-top: 20px;">' ||
                '<p style="color: #9ca3af; font-size: 12px;">Este es un email automático, por favor no respondas.</p>' ||
                '</div>' ||
                '</div>';

  -- Iterar sobre todos los usuarios con email
  FOR user_record IN 
    SELECT id, email, full_name
    FROM profiles
    WHERE email IS NOT NULL 
      AND email != ''
      AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' -- Validar formato de email
  LOOP
    -- Construir el payload para resend-email
    payload := jsonb_build_object(
      'to', user_record.email,
      'subject', email_subject,
      'html', email_html
    );

    -- Enviar email usando pg_net
    BEGIN
      PERFORM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key_val
        )::jsonb,
        body := payload::text
      );
      
      RAISE NOTICE '✅ Email de recordatorio enviado a: % (%)', user_record.full_name, user_record.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ Error al enviar email a % (%): %', user_record.full_name, user_record.email, SQLERRM;
      -- Continuar con el siguiente usuario aunque falle uno
    END;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Proceso de recordatorios de carga de horas completado';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Programar el cron job para ejecutar la función todos los días a las 17:00 hora Argentina (UTC-3)
-- Formato cron: 'minuto hora día_mes mes día_semana'
-- '0 20 * * *' = minuto 0, hora 20 UTC (17:00 hora Argentina, UTC-3), todos los días del mes, todos los meses, todos los días de la semana
DO $$
BEGIN
  -- Eliminar el cron job si ya existe
  PERFORM cron.unschedule('daily-hours-reminder');
  
  -- Crear el cron job
  PERFORM cron.schedule(
    'daily-hours-reminder',           -- Nombre del job
    '0 20 * * *',                     -- Todos los días a las 20:00 UTC (17:00 hora Argentina)
    'SELECT send_hours_reminder_emails();'  -- Función a ejecutar
  );
  
  RAISE NOTICE '✅ Cron job configurado: Recordatorio diario de carga de horas a las 17:00 hora Argentina (20:00 UTC)';
END $$;

-- Comentario: Para probar manualmente, ejecuta:
-- SELECT send_hours_reminder_emails();

-- Comentario: Para ver los cron jobs programados:
-- SELECT * FROM cron.job;

-- Comentario: Para deshabilitar el cron job:
-- SELECT cron.unschedule('daily-hours-reminder');

