-- ============================================
-- Agregar campo visible_modules a profiles
-- ============================================
-- Este campo almacena qué módulos están visibles para cada usuario
-- ============================================

-- Agregar columna visible_modules como JSONB
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS visible_modules jsonb DEFAULT '{}'::jsonb;

-- Crear índice para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_profiles_visible_modules ON profiles USING gin(visible_modules);

-- Comentario en la columna
COMMENT ON COLUMN profiles.visible_modules IS 'Módulos visibles para el usuario. Formato: {"dashboard": true, "meetings": true, "departments": true, ...}';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

