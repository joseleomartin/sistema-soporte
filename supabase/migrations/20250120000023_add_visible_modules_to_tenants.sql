-- ============================================
-- Agregar campo visible_modules a tenants
-- ============================================
-- Este campo almacena qué módulos están visibles para todos los usuarios del tenant
-- Solo los administradores pueden configurarlo
-- ============================================

-- Agregar columna visible_modules como JSONB a tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS visible_modules jsonb DEFAULT '{}'::jsonb;

-- Crear índice para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_tenants_visible_modules ON tenants USING gin(visible_modules);

-- Comentario en la columna
COMMENT ON COLUMN tenants.visible_modules IS 'Módulos visibles para todos los usuarios del tenant. Configurado por administradores. Formato: {"dashboard": true, "meetings": true, "departments": true, ...}';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================


