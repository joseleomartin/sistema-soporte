-- ============================================
-- TEST DIRECTO DE LA EDGE FUNCTION
-- ============================================
-- Este script prueba llamar directamente a la Edge Function
-- para verificar que funciona independientemente del trigger
-- ============================================

DO $$
DECLARE
  supabase_url_val TEXT;
  anon_key_val TEXT;
  test_email TEXT;
  payload JSONB;
  http_result RECORD;
BEGIN
  -- Obtener configuración
  SELECT value INTO supabase_url_val FROM app_settings WHERE key = 'supabase_url' LIMIT 1;
  SELECT value INTO anon_key_val FROM app_settings WHERE key = 'supabase_anon_key' LIMIT 1;
  
  -- Obtener un email de prueba
  SELECT email INTO test_email FROM profiles WHERE email IS NOT NULL AND email != '' LIMIT 1;
  
  IF supabase_url_val IS NULL THEN
    supabase_url_val := 'https://yevbgutnuoivcuqnmrzi.supabase.co';
  END IF;
  
  IF anon_key_val IS NULL OR anon_key_val = '' THEN
    RAISE EXCEPTION '❌ anon_key no está configurado. Ejecuta AGREGAR_ANON_KEY.sql';
  END IF;
  
  IF test_email IS NULL THEN
    RAISE EXCEPTION '❌ No se encontró ningún usuario con email';
  END IF;
  
  -- Construir payload
  payload := jsonb_build_object(
    'to', test_email,
    'subject', 'Prueba Directa - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
    'html', '<div style="font-family: Arial, sans-serif; padding: 20px;"><h1>Prueba Directa</h1><p>Este es un test directo de la Edge Function, sin pasar por el trigger.</p></div>'
  );
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🧪 TEST DIRECTO DE EDGE FUNCTION';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📧 Enviando a: %', test_email;
  RAISE NOTICE '🔗 URL: %/functions/v1/resend-email', supabase_url_val;
  RAISE NOTICE '📦 Payload: %', payload::text;
  RAISE NOTICE '';
  
  -- Llamar directamente a la Edge Function
  SELECT * INTO http_result
  FROM net.http_post(
    url := supabase_url_val || '/functions/v1/resend-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key_val
    )::jsonb,
    body := payload::text
  );
  
  RAISE NOTICE '✅ Petición HTTP enviada';
  RAISE NOTICE '📋 Request ID: %', http_result.request_id;
  RAISE NOTICE '';
  RAISE NOTICE '📋 PRÓXIMOS PASOS:';
  RAISE NOTICE '   1. Ve a Edge Functions > resend-email > Logs';
  RAISE NOTICE '   2. Debe aparecer una petición POST';
  RAISE NOTICE '   3. Si aparece, la Edge Function funciona';
  RAISE NOTICE '   4. Si NO aparece, hay un problema con pg_net o la URL';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ ERROR: %', SQLERRM;
  RAISE NOTICE '❌ SQLSTATE: %', SQLSTATE;
  RAISE NOTICE '';
  RAISE NOTICE '🔍 POSIBLES CAUSAS:';
  RAISE NOTICE '   1. pg_net no está habilitado';
  RAISE NOTICE '   2. La URL es incorrecta';
  RAISE NOTICE '   3. El anon_key es inválido';
  RAISE NOTICE '   4. Problema de red/firewall';
END $$;

-- Verificar si pg_net puede hacer peticiones HTTP
SELECT 'Verificación de pg_net:' as info;
SELECT 
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
    THEN '✅ pg_net está habilitado'
    ELSE '❌ pg_net NO está habilitado - Ejecuta: CREATE EXTENSION IF NOT EXISTS pg_net;'
  END as estado;














