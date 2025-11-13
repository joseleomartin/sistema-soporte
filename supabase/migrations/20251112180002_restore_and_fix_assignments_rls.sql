-- ================================================
-- RESTAURAR Y FIX: Políticas RLS para task_assignments
-- Primero restauramos la funcionalidad básica, luego permitimos ver todas las asignaciones
-- ================================================

-- Eliminar función anterior si existe (por si acaso)
DROP FUNCTION IF EXISTS user_can_view_task_assignments(uuid, uuid);
DROP FUNCTION IF EXISTS is_user_assigned_to_task(uuid, uuid);

-- Eliminar todas las políticas existentes para empezar limpio
DROP POLICY IF EXISTS "Usuarios pueden ver sus asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Usuarios pueden ver asignaciones de sus tareas" ON task_assignments;
DROP POLICY IF EXISTS "Users can view their assignments" ON task_assignments;
DROP POLICY IF EXISTS "Administradores pueden gestionar asignaciones" ON task_assignments;

-- 1. Primero, restaurar política de administradores
CREATE POLICY "Administradores pueden gestionar asignaciones"
    ON task_assignments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 2. Política para usuarios: pueden ver TODAS las asignaciones de las tareas a las que están asignados
-- Esta política permite ver todas las asignaciones si el usuario está asignado a la tarea
CREATE POLICY "Usuarios pueden ver asignaciones de sus tareas"
    ON task_assignments FOR SELECT
    USING (
        -- Si el usuario está asignado directamente a esta tarea
        assigned_to_user = auth.uid()
        OR
        -- Si el usuario está en un departamento asignado a esta tarea
        EXISTS (
            SELECT 1 FROM user_departments
            WHERE user_departments.user_id = auth.uid()
            AND user_departments.department_id = task_assignments.assigned_to_department
        )
        OR
        -- Si el usuario está asignado a la tarea (directamente o por dept), puede ver TODAS las asignaciones
        -- Verificamos si existe alguna asignación de esta tarea donde el usuario esté involucrado
        EXISTS (
            SELECT 1 FROM task_assignments ta_check
            WHERE ta_check.task_id = task_assignments.task_id
            AND (
                ta_check.assigned_to_user = auth.uid()
                OR
                EXISTS (
                    SELECT 1 FROM user_departments ud_check
                    WHERE ud_check.user_id = auth.uid()
                    AND ud_check.department_id = ta_check.assigned_to_department
                )
            )
        )
    );


