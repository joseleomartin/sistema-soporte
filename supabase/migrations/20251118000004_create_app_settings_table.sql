-- ============================================
-- TABLA DE CONFIGURACIÓN PARA EMAILS
-- ============================================
-- Esta tabla permite almacenar configuración sin necesidad de permisos de superusuario
-- ============================================

-- Crear tabla de configuración si no existe
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden ver y modificar configuración
CREATE POLICY "Admins can manage app settings"
  ON app_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insertar valores por defecto (si no existen)
INSERT INTO app_settings (key, value, description)
VALUES 
  ('supabase_url', 'https://yevbgutnuoivcuqnmrzi.supabase.co', 'URL base de Supabase para Edge Functions')
ON CONFLICT (key) DO NOTHING;

-- Nota: El anon_key debe agregarse manualmente por seguridad
-- INSERT INTO app_settings (key, value, description)
-- VALUES ('supabase_anon_key', 'TU_ANON_KEY_AQUI', 'Anon key de Supabase para autenticación');

-- ============================================
-- INSTRUCCIONES:
-- ============================================
-- 1. Ejecuta este script en el SQL Editor
-- 2. Luego ejecuta esto para agregar tu anon key (reemplaza TU_ANON_KEY):
--    INSERT INTO app_settings (key, value, description)
--    VALUES ('supabase_anon_key', 'TU_ANON_KEY', 'Anon key de Supabase')
--    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- ============================================














