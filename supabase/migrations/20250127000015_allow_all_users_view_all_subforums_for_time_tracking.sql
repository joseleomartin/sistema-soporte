-- ============================================
-- Permitir que todos los usuarios vean todos los subforums del tenant
-- para el módulo de carga de horas
-- ============================================
-- Esta migración modifica la política RLS de subforums para que todos
-- los usuarios autenticados del tenant puedan ver todos los subforums
-- del tenant, permitiendo que cualquier usuario pueda cargar horas
-- para cualquier cliente.
-- ============================================

-- Eliminar la política existente que filtra por permisos
DROP POLICY IF EXISTS "Users can view subforums from own tenant" ON subforums;

-- Crear nueva política que permite a todos los usuarios del tenant ver todos los subforums
CREATE POLICY "Users can view subforums from own tenant"
  ON subforums FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
  );
