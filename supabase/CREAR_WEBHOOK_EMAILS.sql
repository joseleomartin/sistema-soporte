-- ============================================
-- CREAR WEBHOOK PARA EMAILS (ALTERNATIVA A pg_net)
-- ============================================
-- Si pg_net no funciona, usar Database Webhooks de Supabase
-- ============================================

-- NOTA: Este script debe ejecutarse manualmente en Supabase Dashboard
-- porque la creación de webhooks requiere la interfaz web
-- ============================================

-- ============================================
-- INSTRUCCIONES PARA CREAR EL WEBHOOK:
-- ============================================
-- 1. Ve a Supabase Dashboard > Database > Webhooks
-- 2. Haz clic en "Create a new webhook"
-- 3. Configura:
--    - Name: "Send notification emails"
--    - Table: notifications
--    - Events: INSERT
--    - HTTP Request:
--      - URL: https://yevbgutnuoivcuqnmrzi.supabase.co/functions/v1/resend-email
--      - HTTP Method: POST
--      - HTTP Headers:
--        - Content-Type: application/json
--        - Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldmJndXRudW9pdmN1cW5tcnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTI0NTQsImV4cCI6MjA3ODQ2ODQ1NH0.COkMSMvFvpCM2q9FC0fYukS-mCzLacqilH9q1aHAQR4
--      - Request Body Type: JSON
--      - Request Body: 
--        {
--          "to": "{{record.email}}",
--          "subject": "{{record.title}}",
--          "html": "<div><h2>{{record.title}}</h2><p>{{record.message}}</p></div>"
--        }
-- 4. Guarda el webhook
-- ============================================

-- Alternativa: Crear función que prepare el payload correcto
-- ============================================
CREATE OR REPLACE FUNCTION prepare_email_payload(notification_record notifications)
RETURNS JSONB AS $$
DECLARE
  user_email TEXT;
  html_content TEXT;
BEGIN
  -- Obtener email del usuario
  SELECT email INTO user_email
  FROM profiles
  WHERE id = notification_record.user_id;
  
  IF user_email IS NULL OR user_email = '' THEN
    RETURN NULL; -- No enviar email si no hay email
  END IF;
  
  -- Construir HTML
  html_content := '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">' ||
                  '<div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">' ||
                  '<h1 style="color: white; margin: 0; font-size: 24px;">EmaGroup</h1>' ||
                  '</div>' ||
                  '<div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">' ||
                  '<h2 style="color: #111827; margin-top: 0; font-size: 20px;">' || notification_record.title || '</h2>' ||
                  '<p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">' || notification_record.message || '</p>' ||
                  '<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">' ||
                  '<p style="color: #6b7280; font-size: 14px; margin: 0;">Puedes ver todas tus notificaciones en la plataforma EmaGroup.</p>' ||
                  '</div>' ||
                  '</div>' ||
                  '<div style="text-align: center; margin-top: 20px;">' ||
                  '<p style="color: #9ca3af; font-size: 12px;">Este es un email automático, por favor no respondas.</p>' ||
                  '</div>' ||
                  '</div>';
  
  -- Retornar payload
  RETURN jsonb_build_object(
    'to', user_email,
    'subject', notification_record.title,
    'html', html_content
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CONFIGURACIÓN DEL WEBHOOK EN SUPABASE DASHBOARD:
-- ============================================
-- Request Body (usar esta función):
-- {
--   "to": "{{(SELECT email FROM profiles WHERE id = record.user_id LIMIT 1)}}",
--   "subject": "{{record.title}}",
--   "html": "{{prepare_email_payload(record)}}"
-- }
-- 
-- O más simple, usar directamente:
-- {
--   "to": "{{record.user_id}}",
--   "subject": "{{record.title}}",
--   "html": "<div><h2>{{record.title}}</h2><p>{{record.message}}</p></div>"
-- }
-- ============================================


