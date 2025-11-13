-- ================================================
-- FIX: Permitir que usuarios vean TODAS las asignaciones
-- de las tareas a las que están asignados
-- ================================================

-- Crear función auxiliar que consulta task_assignments sin restricciones RLS
-- usando SECURITY DEFINER para evitar recursión
CREATE OR REPLACE FUNCTION user_can_view_task_assignments(p_task_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verificar si es admin
    IF EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = p_user_id
        AND profiles.role = 'admin'
    ) THEN
        RETURN true;
    END IF;

    -- Verificar si el usuario está asignado directamente a esta tarea
    IF EXISTS (
        SELECT 1 FROM task_assignments
        WHERE task_id = p_task_id
        AND assigned_to_user = p_user_id
    ) THEN
        RETURN true;
    END IF;

    -- Verificar si el usuario está asignado por departamento
    IF EXISTS (
        SELECT 1 FROM task_assignments ta
        JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
        WHERE ta.task_id = p_task_id
        AND ud.user_id = p_user_id
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Usuarios pueden ver sus asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Usuarios pueden ver asignaciones de sus tareas" ON task_assignments;
DROP POLICY IF EXISTS "Users can view their assignments" ON task_assignments;

-- Nueva política: Los usuarios pueden ver TODAS las asignaciones
-- de las tareas a las que están asignados (directamente o por departamento)
CREATE POLICY "Usuarios pueden ver asignaciones de sus tareas"
    ON task_assignments FOR SELECT
    USING (
        -- Usar la función SECURITY DEFINER para evitar recursión
        user_can_view_task_assignments(task_id, auth.uid())
    );

