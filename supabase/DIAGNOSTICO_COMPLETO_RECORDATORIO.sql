-- ============================================
-- DIAGNÓSTICO COMPLETO: Recordatorio de Horas
-- ============================================
-- Este script verifica todos los componentes necesarios
-- ============================================

-- 1. Verificar si pg_net está habilitado
SELECT 
  extname,
  extversion,
  CASE 
    WHEN extname = 'pg_net' THEN '✅ pg_net está habilitado'
    ELSE '❌ pg_net NO está habilitado'
  END as estado
FROM pg_extension
WHERE extname = 'pg_net';

-- Si no está habilitado, ejecuta esto:
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Verificar configuración de app_settings
SELECT 
  key,
  CASE 
    WHEN key = 'supabase_anon_key' THEN LEFT(value, 20) || '...' 
    ELSE value 
  END as value_preview,
  CASE 
    WHEN value IS NULL OR value = '' THEN '❌ No configurado'
    ELSE '✅ Configurado'
  END as estado
FROM app_settings
WHERE key IN ('supabase_url', 'supabase_anon_key', 'frontend_url')
ORDER BY key;

-- 3. Verificar que la función existe
SELECT 
  proname as nombre_funcion,
  CASE 
    WHEN proname = 'send_hours_reminder_emails' THEN '✅ Función existe'
    ELSE '❌ Función no encontrada'
  END as estado
FROM pg_proc
WHERE proname = 'send_hours_reminder_emails';

-- 4. Verificar usuarios que recibirían el email
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as usuarios_con_email,
  COUNT(CASE WHEN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN 1 END) as emails_validos
FROM profiles;

-- 5. Probar pg_net directamente (test simple)
-- Esto debería crear una entrada en la tabla net.http_request_queue
-- Nota: pg_net puede no estar disponible en todos los planes de Supabase
DO $$
BEGIN
  -- Intentar hacer una petición HTTP de prueba
  PERFORM net.http_post(
    url := 'https://httpbin.org/post',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{"test": "pg_net funciona"}'
  );
  RAISE NOTICE '✅ Test de pg_net ejecutado - Revisa net.http_request_queue';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error en test de pg_net: %', SQLERRM;
  RAISE NOTICE '⚠️  Si pg_net no funciona, considera usar Database Webhooks en su lugar';
END $$;

-- 6. Verificar si hay peticiones HTTP en pg_net
-- Nota: La estructura de net.http_request_queue puede variar
-- Si hay error, significa que pg_net puede no estar funcionando correctamente
DO $$
BEGIN
  -- Intentar contar registros en la tabla
  PERFORM COUNT(*) FROM net.http_request_queue;
  RAISE NOTICE '✅ Tabla net.http_request_queue existe y tiene registros';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error accediendo a net.http_request_queue: %', SQLERRM;
  RAISE NOTICE '⚠️  Esto puede indicar que pg_net no está funcionando correctamente';
END $$;

-- 7. Verificar la URL de la Edge Function que se está usando
SELECT 
  'URL de Edge Function esperada: ' || 
  (SELECT value FROM app_settings WHERE key = 'supabase_url') || 
  '/functions/v1/resend-email' as edge_function_url;

-- ============================================
-- SOLUCIÓN SI pg_net NO FUNCIONA:
-- ============================================
-- Si pg_net no está funcionando, puedes usar una alternativa:
-- 1. Crear una función que inserte notificaciones en la tabla notifications
-- 2. El webhook existente se encargará de enviar los emails
-- ============================================

