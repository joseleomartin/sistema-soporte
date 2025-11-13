-- Migración: Sistema de Gestión de Tareas
-- Fecha: 2025-11-12 17:00:00

-- ================================================
-- TABLA: tasks
-- ================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    client_name TEXT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at_trigger ON tasks;
CREATE TRIGGER tasks_updated_at_trigger
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at();

-- Función para restringir qué campos pueden actualizar los usuarios no-admin
CREATE OR REPLACE FUNCTION prevent_task_field_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Si es admin, permite todo
    IF EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    ) THEN
        RETURN NEW;
    END IF;

    -- Si no es admin, solo puede cambiar el status
    IF (NEW.title IS DISTINCT FROM OLD.title OR
        NEW.description IS DISTINCT FROM OLD.description OR
        NEW.client_name IS DISTINCT FROM OLD.client_name OR
        NEW.due_date IS DISTINCT FROM OLD.due_date OR
        NEW.priority IS DISTINCT FROM OLD.priority OR
        NEW.created_by IS DISTINCT FROM OLD.created_by) THEN
        RAISE EXCEPTION 'Solo los administradores pueden modificar estos campos. Los usuarios asignados solo pueden cambiar el estado.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tasks_prevent_field_updates_trigger ON tasks;
CREATE TRIGGER tasks_prevent_field_updates_trigger
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION prevent_task_field_updates();

-- ================================================
-- TABLA: task_assignments
-- ================================================
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    assigned_to_user UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_to_department UUID REFERENCES departments(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    -- Constraint: debe tener al menos uno (usuario O departamento)
    CONSTRAINT check_assignment_type CHECK (
        (assigned_to_user IS NOT NULL) OR (assigned_to_department IS NOT NULL)
    ),
    -- Evitar asignaciones duplicadas
    UNIQUE(task_id, assigned_to_user, assigned_to_department)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to_user ON task_assignments(assigned_to_user);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to_department ON task_assignments(assigned_to_department);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_by ON task_assignments(assigned_by);

-- ================================================
-- TABLA: task_messages
-- ================================================
CREATE TABLE IF NOT EXISTS task_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_task_messages_task_id ON task_messages(task_id);
CREATE INDEX IF NOT EXISTS idx_task_messages_user_id ON task_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_task_messages_created_at ON task_messages(task_id, created_at DESC);

-- ================================================
-- TABLA: task_attachments
-- ================================================
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    message_id UUID REFERENCES task_messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_message_id ON task_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- ================================================
-- POLÍTICAS RLS: tasks
-- ================================================

-- Habilitar RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas antiguas
DROP POLICY IF EXISTS "Administradores pueden ver todas las tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden crear tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden actualizar tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden eliminar tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores tienen acceso completo a tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden gestionar todas las tareas" ON tasks;

-- Administradores: CRUD completo
CREATE POLICY "Administradores tienen acceso completo a tareas"
    ON tasks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Usuarios asignados: pueden ver y actualizar estado de sus tareas
DROP POLICY IF EXISTS "Usuarios pueden ver sus tareas asignadas" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden ver tareas asignadas" ON tasks;
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON tasks;
CREATE POLICY "Usuarios pueden ver sus tareas asignadas"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM task_assignments
            WHERE task_assignments.task_id = tasks.id
            AND task_assignments.assigned_to_user = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM task_assignments
            JOIN user_departments ON user_departments.department_id = task_assignments.assigned_to_department
            WHERE task_assignments.task_id = tasks.id
            AND user_departments.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Usuarios pueden actualizar estado de sus tareas" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus tareas" ON tasks;
DROP POLICY IF EXISTS "Users can update their assigned tasks" ON tasks;
CREATE POLICY "Usuarios pueden actualizar estado de sus tareas"
    ON tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM task_assignments
            WHERE task_assignments.task_id = tasks.id
            AND task_assignments.assigned_to_user = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM task_assignments
            JOIN user_departments ON user_departments.department_id = task_assignments.assigned_to_department
            WHERE task_assignments.task_id = tasks.id
            AND user_departments.user_id = auth.uid()
        )
    );

-- ================================================
-- POLÍTICAS RLS: task_assignments
-- ================================================

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Administradores: acceso completo
DROP POLICY IF EXISTS "Administradores pueden gestionar asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Administradores pueden gestionar todas las asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON task_assignments;
CREATE POLICY "Administradores pueden gestionar asignaciones"
    ON task_assignments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Usuarios: pueden ver sus asignaciones
DROP POLICY IF EXISTS "Usuarios pueden ver sus asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Users can view their assignments" ON task_assignments;
CREATE POLICY "Usuarios pueden ver sus asignaciones"
    ON task_assignments FOR SELECT
    USING (
        assigned_to_user = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM user_departments
            WHERE user_departments.user_id = auth.uid()
            AND user_departments.department_id = task_assignments.assigned_to_department
        )
    );

-- ================================================
-- POLÍTICAS RLS: task_messages
-- ================================================

ALTER TABLE task_messages ENABLE ROW LEVEL SECURITY;

-- Usuarios asignados pueden ver mensajes de sus tareas
DROP POLICY IF EXISTS "Usuarios pueden ver mensajes de sus tareas" ON task_messages;
DROP POLICY IF EXISTS "Users can view messages in their tasks" ON task_messages;
CREATE POLICY "Usuarios pueden ver mensajes de sus tareas"
    ON task_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM task_assignments
            WHERE task_assignments.task_id = task_messages.task_id
            AND task_assignments.assigned_to_user = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM task_assignments
            JOIN user_departments ON user_departments.department_id = task_assignments.assigned_to_department
            WHERE task_assignments.task_id = task_messages.task_id
            AND user_departments.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Usuarios asignados pueden crear mensajes en sus tareas
DROP POLICY IF EXISTS "Usuarios pueden crear mensajes en sus tareas" ON task_messages;
DROP POLICY IF EXISTS "Users can create messages in their tasks" ON task_messages;
CREATE POLICY "Usuarios pueden crear mensajes en sus tareas"
    ON task_messages FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM task_assignments
                WHERE task_assignments.task_id = task_messages.task_id
                AND task_assignments.assigned_to_user = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM task_assignments
                JOIN user_departments ON user_departments.department_id = task_assignments.assigned_to_department
                WHERE task_assignments.task_id = task_messages.task_id
                AND user_departments.user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'
            )
        )
    );

-- ================================================
-- POLÍTICAS RLS: task_attachments
-- ================================================

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Usuarios asignados pueden ver archivos de sus tareas
DROP POLICY IF EXISTS "Usuarios pueden ver archivos de sus tareas" ON task_attachments;
DROP POLICY IF EXISTS "Users can view attachments in their tasks" ON task_attachments;
CREATE POLICY "Usuarios pueden ver archivos de sus tareas"
    ON task_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM task_assignments
            WHERE task_assignments.task_id = task_attachments.task_id
            AND task_assignments.assigned_to_user = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM task_assignments
            JOIN user_departments ON user_departments.department_id = task_assignments.assigned_to_department
            WHERE task_assignments.task_id = task_attachments.task_id
            AND user_departments.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Usuarios asignados pueden subir archivos a sus tareas
DROP POLICY IF EXISTS "Usuarios pueden subir archivos a sus tareas" ON task_attachments;
DROP POLICY IF EXISTS "Users can upload attachments to their tasks" ON task_attachments;
CREATE POLICY "Usuarios pueden subir archivos a sus tareas"
    ON task_attachments FOR INSERT
    WITH CHECK (
        uploaded_by = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM task_assignments
                WHERE task_assignments.task_id = task_attachments.task_id
                AND task_assignments.assigned_to_user = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM task_assignments
                JOIN user_departments ON user_departments.department_id = task_assignments.assigned_to_department
                WHERE task_assignments.task_id = task_attachments.task_id
                AND user_departments.user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM profiles
                WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'
            )
        )
    );

-- ================================================
-- CONFIGURACIÓN DE REALTIME
-- ================================================

-- Habilitar realtime para task_messages (si no está ya agregado)
DO $$
BEGIN
    -- Verificar si task_messages ya está en la publicación
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'task_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE task_messages;
        RAISE NOTICE 'Tabla task_messages agregada a supabase_realtime';
    ELSE
        RAISE NOTICE 'Tabla task_messages ya está en supabase_realtime';
    END IF;
END $$;

-- ================================================
-- COMENTARIOS EN LAS TABLAS
-- ================================================

COMMENT ON TABLE tasks IS 'Tabla principal de tareas del sistema';
COMMENT ON TABLE task_assignments IS 'Asignaciones de tareas a usuarios o departamentos';
COMMENT ON TABLE task_messages IS 'Mensajes del chat de tareas';
COMMENT ON TABLE task_attachments IS 'Archivos adjuntos en tareas';

-- ================================================
-- FIN DE LA MIGRACIÓN
-- ================================================

