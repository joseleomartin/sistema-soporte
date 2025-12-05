-- ==================================================================
-- MIGRACIÓN: Permitir tareas personales
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Permite que los usuarios creen tareas personales para sí mismos
-- ==================================================================

-- 1. Agregar campo is_personal a tasks
-- ==================================================================
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_is_personal ON tasks(is_personal);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_personal ON tasks(created_by, is_personal);

-- 2. Actualizar políticas RLS para tasks
-- ==================================================================

-- Reemplazar política de administradores para excluir tareas personales de otros usuarios
DROP POLICY IF EXISTS "Administradores tienen acceso completo a tareas" ON tasks;

-- Administradores: SELECT - Solo pueden ver tareas de equipo o sus propias tareas personales
CREATE POLICY "Administradores pueden ver tareas de equipo y sus personales"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND (
      is_personal = false  -- Tareas de equipo: todas visibles
      OR
      (is_personal = true AND created_by = auth.uid())  -- Solo sus propias tareas personales
    )
  );

-- Administradores: INSERT - Pueden crear cualquier tipo de tarea
CREATE POLICY "Administradores pueden crear tareas"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Administradores: UPDATE - Solo pueden actualizar tareas de equipo o sus propias tareas personales
CREATE POLICY "Administradores pueden actualizar tareas de equipo y sus personales"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND (
      is_personal = false  -- Tareas de equipo: todas editables
      OR
      (is_personal = true AND created_by = auth.uid())  -- Solo sus propias tareas personales
    )
  );

-- Administradores: DELETE - Solo pueden eliminar tareas de equipo o sus propias tareas personales
CREATE POLICY "Administradores pueden eliminar tareas de equipo y sus personales"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND (
      is_personal = false  -- Tareas de equipo: todas eliminables
      OR
      (is_personal = true AND created_by = auth.uid())  -- Solo sus propias tareas personales
    )
  );

-- Permitir a todos los usuarios crear tareas personales
DROP POLICY IF EXISTS "Usuarios pueden crear tareas personales" ON tasks;
CREATE POLICY "Usuarios pueden crear tareas personales"
  ON tasks FOR INSERT
  WITH CHECK (
    -- Solo pueden crear tareas personales
    is_personal = true
    AND created_by = auth.uid()
  );

-- Permitir a los usuarios ver sus propias tareas personales
DROP POLICY IF EXISTS "Usuarios pueden ver sus tareas personales" ON tasks;
CREATE POLICY "Usuarios pueden ver sus tareas personales"
  ON tasks FOR SELECT
  USING (
    is_personal = true
    AND created_by = auth.uid()
  );

-- Permitir a los usuarios actualizar completamente sus tareas personales
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus tareas personales" ON tasks;
CREATE POLICY "Usuarios pueden actualizar sus tareas personales"
  ON tasks FOR UPDATE
  USING (
    is_personal = true
    AND created_by = auth.uid()
  );

-- Permitir a los usuarios eliminar sus tareas personales
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus tareas personales" ON tasks;
CREATE POLICY "Usuarios pueden eliminar sus tareas personales"
  ON tasks FOR DELETE
  USING (
    is_personal = true
    AND created_by = auth.uid()
  );

-- 3. Actualizar función de validación de campos
-- ==================================================================
-- Modificar la función para permitir a los creadores editar sus tareas personales

CREATE OR REPLACE FUNCTION prevent_task_field_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es admin, solo puede modificar tareas de equipo o sus propias tareas personales
    IF EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    ) THEN
        -- Si es una tarea personal de otro usuario, no permitir modificación
        IF OLD.is_personal = true AND OLD.created_by != auth.uid() THEN
            RAISE EXCEPTION 'Los administradores no pueden modificar tareas personales de otros usuarios';
        END IF;
        RETURN NEW;
    END IF;

    -- Si es una tarea personal y el usuario es el creador, permite todo
    IF NEW.is_personal = true AND NEW.created_by = auth.uid() THEN
        -- Validar que no está intentando cambiar is_personal a false
        IF OLD.is_personal = true AND NEW.is_personal = false THEN
            RAISE EXCEPTION 'No puedes convertir una tarea personal en una tarea de equipo';
        END IF;
        RETURN NEW;
    END IF;

    -- Si no es admin ni creador de tarea personal, solo puede cambiar el status
    IF (NEW.title IS DISTINCT FROM OLD.title OR
        NEW.description IS DISTINCT FROM OLD.description OR
        NEW.client_name IS DISTINCT FROM OLD.client_name OR
        NEW.due_date IS DISTINCT FROM OLD.due_date OR
        NEW.priority IS DISTINCT FROM OLD.priority OR
        NEW.created_by IS DISTINCT FROM OLD.created_by OR
        NEW.is_personal IS DISTINCT FROM OLD.is_personal) THEN
        RAISE EXCEPTION 'Solo los administradores y creadores de tareas personales pueden modificar estos campos. Los usuarios asignados solo pueden cambiar el estado.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger automático para asignar tareas personales al creador
-- ==================================================================
CREATE OR REPLACE FUNCTION auto_assign_personal_task()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es una tarea personal, crear automáticamente la asignación al creador
    IF NEW.is_personal = true THEN
        INSERT INTO task_assignments (task_id, assigned_to_user, assigned_by)
        VALUES (NEW.id, NEW.created_by, NEW.created_by);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_assign_personal_task ON tasks;
CREATE TRIGGER trigger_auto_assign_personal_task
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_personal_task();

-- 5. Comentarios para documentación
-- ==================================================================
COMMENT ON COLUMN tasks.is_personal IS 'Indica si la tarea es personal (solo para el creador) o de equipo';
COMMENT ON POLICY "Usuarios pueden crear tareas personales" ON tasks IS 'Permite a cualquier usuario crear tareas personales para sí mismo';
COMMENT ON POLICY "Usuarios pueden ver sus tareas personales" ON tasks IS 'Permite a los usuarios ver sus propias tareas personales';
COMMENT ON POLICY "Usuarios pueden actualizar sus tareas personales" ON tasks IS 'Permite a los usuarios actualizar completamente sus tareas personales';
COMMENT ON POLICY "Usuarios pueden eliminar sus tareas personales" ON tasks IS 'Permite a los usuarios eliminar sus tareas personales';

