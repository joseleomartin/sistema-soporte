-- ============================================
-- Habilitar Realtime para Departamentos
-- ============================================
-- Este script habilita las actualizaciones en tiempo real
-- para la tabla user_departments
-- ============================================

-- Habilitar realtime para user_departments
ALTER PUBLICATION supabase_realtime ADD TABLE user_departments;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Realtime habilitado para user_departments
-- Ahora los cambios se verán automáticamente sin necesidad de F5
-- ============================================
















