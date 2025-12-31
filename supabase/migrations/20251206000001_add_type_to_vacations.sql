-- ============================================
-- Agregar campo type a vacations para distinguir entre vacaciones y licencias
-- ============================================
-- Permite distinguir entre 'vacation' (vacaciones) y 'license' (licencias)
-- ============================================

-- Agregar columna type con valor por defecto 'vacation' para registros existentes
ALTER TABLE vacations
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'vacation' CHECK (type IN ('vacation', 'license'));

-- Actualizar el valor por defecto para nuevos registros (sin afectar los existentes)
ALTER TABLE vacations
ALTER COLUMN type SET DEFAULT 'vacation';

-- Crear índice para mejorar rendimiento en búsquedas por tipo
CREATE INDEX IF NOT EXISTS idx_vacations_type ON vacations(type);

-- ============================================
-- Comentarios sobre el cambio
-- ============================================
-- - Todos los registros existentes tendrán type = 'vacation' por defecto
-- - Los nuevos registros también tendrán type = 'vacation' por defecto
-- - Los usuarios deberán seleccionar explícitamente si es 'vacation' o 'license'
-- ============================================









