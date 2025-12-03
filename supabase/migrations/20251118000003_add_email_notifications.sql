-- ============================================
-- SISTEMA DE ENVÍO DE EMAILS PARA NOTIFICACIONES
-- ============================================
-- Cuando un usuario recibe una notificación, se envía un email
-- a su correo electrónico registrado.
-- ============================================

-- 1. Verificar si pg_net está disponible, si no, usar http extension
-- ============================================
DO $$
BEGIN
  -- Intentar habilitar pg_net si está disponible
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_net no está disponible, se usará http extension';
  END;
END $$;

-- 2. Función para enviar email cuando se crea una notificación
-- ============================================
CREATE OR REPLACE FUNCTION send_notification_email()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  edge_function_url TEXT;
  supabase_url TEXT;
  payload JSONB;
  http_response RECORD;
  anon_key_val TEXT;
BEGIN
  -- Obtener el email y nombre del usuario desde profiles
  SELECT email, full_name INTO user_email, user_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Si no hay email, no hacer nada
  IF user_email IS NULL OR user_email = '' THEN
    RAISE NOTICE 'Usuario % no tiene email, no se enviará notificación por correo', NEW.user_id;
    RETURN NEW;
  END IF;

  -- Obtener la URL de Supabase desde la tabla app_settings
  -- Si la tabla no existe, usar el valor por defecto
  BEGIN
    SELECT value INTO supabase_url
    FROM app_settings
    WHERE key = 'supabase_url'
    LIMIT 1;
    
    -- Si no está en la tabla, usar el valor por defecto
    IF supabase_url IS NULL OR supabase_url = '' THEN
      supabase_url := 'https://yevbgutnuoivcuqnmrzi.supabase.co';
      RAISE NOTICE '⚠️  Usando URL por defecto. Configura app_settings para personalizar.';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Si la tabla no existe, usar el valor por defecto
    supabase_url := 'https://yevbgutnuoivcuqnmrzi.supabase.co';
    RAISE NOTICE '⚠️  Tabla app_settings no encontrada. Usando URL por defecto.';
  END;

  -- Construir la URL de la Edge Function
  -- Usar resend-email que ya está desplegada
  edge_function_url := supabase_url || '/functions/v1/resend-email';

  -- Construir el payload para resend-email
  -- resend-email espera: { to, subject, html }
  -- Construir el HTML del email
  payload := jsonb_build_object(
    'to', user_email,
    'subject', NEW.title,
    'html', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">' ||
            '<div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">' ||
            '<h1 style="color: white; margin: 0; font-size: 24px;">EmaGroup</h1>' ||
            '</div>' ||
            '<div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">' ||
            '<h2 style="color: #111827; margin-top: 0; font-size: 20px;">' || NEW.title || '</h2>' ||
            '<p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">' || NEW.message || '</p>' ||
            '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">' ||
            '<p style="color: #6b7280; font-size: 14px; margin: 0;">Puedes ver todas tus notificaciones en la plataforma EmaGroup.</p>' ||
            '</div>' ||
            '</div>' ||
            '<div style="text-align: center; margin-top: 20px;">' ||
            '<p style="color: #9ca3af; font-size: 12px;">Este es un email automático, por favor no respondas.</p>' ||
            '</div>' ||
            '</div>'
  );

  -- Obtener anon key
  SELECT value INTO anon_key_val FROM app_settings WHERE key = 'supabase_anon_key' LIMIT 1;
  
  -- Validar anon key
  IF anon_key_val IS NULL OR anon_key_val = '' THEN
    RAISE NOTICE '❌ ERROR: supabase_anon_key no está configurado en app_settings';
    RAISE NOTICE '   Ejecuta: supabase/AGREGAR_ANON_KEY.sql';
    RETURN NEW; -- Continuar sin fallar
  END IF;

  -- Intentar enviar usando pg_net si está disponible
  -- Nota: pg_net es asíncrono, así que solo iniciamos la petición
  BEGIN
    -- Log detallado para debugging
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '📧 INICIANDO ENVÍO DE EMAIL';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '👤 Destinatario: %', user_email;
    RAISE NOTICE '🔗 URL: %', edge_function_url;
    RAISE NOTICE '🔑 Anon Key: %... (primeros 20 chars)', LEFT(anon_key_val, 20);
    RAISE NOTICE '📦 Payload size: % bytes', LENGTH(payload::text);
    
    -- Llamar a la Edge Function usando pg_net
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key_val
      )::jsonb,
      body := payload::text
    );
    
    RAISE NOTICE '✅ Petición HTTP enviada a Edge Function';
    RAISE NOTICE '📋 Revisa los logs de la Edge Function en Supabase Dashboard';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    
  EXCEPTION WHEN OTHERS THEN
    -- Si pg_net no está disponible o falla, registrar el error pero no fallar el trigger
    RAISE NOTICE '❌ ERROR al llamar a Edge Function: %', SQLERRM;
    RAISE NOTICE '❌ Detalles: %', SQLSTATE;
    RAISE NOTICE '📋 Verifica:';
    RAISE NOTICE '   1. pg_net está habilitado: CREATE EXTENSION IF NOT EXISTS pg_net;';
    RAISE NOTICE '   2. La URL es correcta: %', edge_function_url;
    RAISE NOTICE '   3. El anon_key está configurado';
    -- Continuar sin fallar para que la notificación se cree normalmente
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear trigger para enviar email cuando se inserta una notificación
-- ============================================
DROP TRIGGER IF EXISTS trigger_send_notification_email ON notifications;
CREATE TRIGGER trigger_send_notification_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.type != 'direct_message') -- Excluir mensajes directos
  EXECUTE FUNCTION send_notification_email();

-- ============================================
-- NOTAS DE CONFIGURACIÓN
-- ============================================
-- 1. Esta función usa la Edge Function 'resend-email' que debe estar desplegada
-- 2. Configurar las variables de entorno en Supabase Dashboard > Edge Functions > resend-email > Settings > Secrets:
--    - RESEND_API_KEY: Tu API key de Resend (requerido)
--    - FROM_EMAIL: Email desde el cual se enviarán (debe ser del dominio verificado en Resend)
--      Ejemplo: notificaciones@app.somosemagroup.com
-- 3. Configurar las variables de base de datos ejecutando:
--    ALTER DATABASE postgres SET app.settings.supabase_url = 'https://TU_PROJECT_REF.supabase.co';
--    ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'TU_ANON_KEY';
-- 4. Habilitar pg_net extension:
--    CREATE EXTENSION IF NOT EXISTS pg_net;
-- ============================================

