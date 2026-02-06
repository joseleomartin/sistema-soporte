-- ============================================
-- Corregir trigger de tareas personales para incluir tenant_id
-- ============================================
-- El trigger auto_assign_personal_task() no estaba incluyendo tenant_id
-- al crear asignaciones automáticas, causando errores de constraint
-- ============================================

CREATE OR REPLACE FUNCTION auto_assign_personal_task()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es una tarea personal, crear automáticamente la asignación al creador
    IF NEW.is_personal = true THEN
        INSERT INTO task_assignments (task_id, assigned_to_user, assigned_by, tenant_id)
        VALUES (NEW.id, NEW.created_by, NEW.created_by, NEW.tenant_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger ya existe, solo necesitamos actualizar la función
-- No es necesario recrear el trigger

COMMENT ON FUNCTION auto_assign_personal_task() IS 
  'Función actualizada para incluir tenant_id al auto-asignar tareas personales';
