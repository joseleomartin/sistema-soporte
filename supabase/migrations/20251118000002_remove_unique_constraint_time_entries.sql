-- ============================================
-- Eliminar restricción única de time_entries
-- ============================================
-- Permite que un usuario pueda tener múltiples registros
-- para el mismo cliente en la misma fecha
-- ============================================

-- Eliminar la restricción única unique_user_client_date
ALTER TABLE time_entries 
DROP CONSTRAINT IF EXISTS unique_user_client_date;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Restricción única eliminada
-- ✅ Los usuarios ahora pueden tener múltiples registros
--    para el mismo cliente en la misma fecha
-- ============================================

