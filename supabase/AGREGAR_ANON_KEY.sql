-- ============================================
-- CONFIGURAR ANON KEY PARA EMAILS
-- ============================================
-- Este script agrega el anon key necesario para que el trigger funcione
-- ============================================

-- IMPORTANTE: Reemplaza 'TU_ANON_KEY_AQUI' con tu anon key real
-- Lo encuentras en: Supabase Dashboard > Settings > API > anon/public key
-- ============================================

-- Agregar o actualizar el anon key
INSERT INTO app_settings (key, value, description)
VALUES (
  'supabase_anon_key',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlldmJndXRudW9pdmN1cW5tcnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTI0NTQsImV4cCI6MjA3ODQ2ODQ1NH0.COkMSMvFvpCM2q9FC0fYukS-mCzLacqilH9q1aHAQR4',
  'Anon key de Supabase para autenticación con Edge Functions'
)
ON CONFLICT (key) DO UPDATE 
SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Verificar que se guardó correctamente
SELECT 
  '✅ Anon key configurado' as status,
  CASE 
    WHEN value != '' AND LENGTH(value) > 100
    THEN '✅ Correcto - Key configurado'
    ELSE '❌ Error - Key no válido'
  END as verificacion,
  LENGTH(value) as key_length,
  LEFT(value, 20) || '...' as key_preview
FROM app_settings
WHERE key = 'supabase_anon_key';

-- ============================================
-- INSTRUCCIONES:
-- ============================================
-- 1. Ve a Supabase Dashboard > Settings > API
-- 2. Copia el valor de "anon public" key
-- 3. Reemplaza 'TU_ANON_KEY_AQUI' en este script con ese valor
-- 4. Ejecuta el script actualizado
-- ============================================

