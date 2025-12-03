-- ============================================
-- SCRIPT DE CONFIGURACIÓN PARA EMAILS DE NOTIFICACIONES
-- ============================================
-- Ejecuta este script en el SQL Editor de Supabase
-- ============================================

-- 1. Primero ejecuta la migración que crea la tabla app_settings:
--    supabase/migrations/20251118000004_create_app_settings_table.sql

-- 2. Configurar URL de Supabase en la tabla app_settings
-- Reemplaza 'yevbgutnuoivcuqnmrzi' con tu Project Ref
-- Lo encuentras en: Settings > API > Project URL
-- ============================================
INSERT INTO app_settings (key, value, description)
VALUES ('supabase_url', 'https://yevbgutnuoivcuqnmrzi.supabase.co', 'URL base de Supabase para Edge Functions')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Configurar Anon Key en la tabla app_settings
-- ============================================
INSERT INTO app_settings (key, value, description)
VALUES ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldmJndXRudW9pdmN1cW5tcnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTI0NTQsImV4cCI6MjA3ODQ2ODQ1NH0.COkMSMvFvpCM2q9FC0fYukS-mCzLacqilH9q1aHAQR4', 'Anon key de Supabase para autenticación')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Habilitar pg_net extension (si no está habilitada)
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 4. Verificar configuración
-- ============================================
SELECT 
  current_setting('app.settings.supabase_url', true) as supabase_url,
  current_setting('app.settings.supabase_anon_key', true) as supabase_anon_key,
  EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net') as pg_net_enabled;

-- 5. Verificar que el trigger existe
-- ============================================
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trigger_send_notification_email';

-- ============================================
-- IMPORTANTE: También configura en Supabase Dashboard
-- ============================================
-- 1. Ve a Edge Functions > resend-email > Settings > Secrets
-- 2. Agrega:
--    RESEND_API_KEY = re_EruAtU7H_EAYyUVA1cwjPQWy2wHKNx5LY
--    FROM_EMAIL = notificaciones@app.somosemagroup.com
-- ============================================

