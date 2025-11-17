-- ============================================
-- MEJORAS AL SISTEMA DE TAREAS
-- ============================================
-- Agrega campos para timer, administrador, tareas recurrentes
-- y hace client_name opcional
-- ============================================

-- 1. Agregar completed_at para timer de tareas
-- ============================================

ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Trigger para actualizar completed_at cuando se completa la tarea
CREATE OR REPLACE FUNCTION update_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_task_completed_at ON tasks;
CREATE TRIGGER trigger_update_task_completed_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_completed_at();

-- 2. Hacer client_name opcional
-- ============================================

ALTER TABLE tasks 
  ALTER COLUMN client_name DROP NOT NULL;

-- 3. Agregar task_manager_id (administrador de tarea)
-- ============================================

ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS task_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_task_manager_id ON tasks(task_manager_id);

-- 4. Agregar campos para tareas recurrentes
-- ============================================

ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB DEFAULT '{}'::jsonb;
-- Formato: {type: 'daily'|'weekly'|'monthly', interval: number, end_date: date|null}

ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
-- Para agrupar tareas recurrentes (la tarea original es el parent)

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);

-- 5. Función para crear tareas recurrentes
-- ============================================

CREATE OR REPLACE FUNCTION create_recurring_task()
RETURNS TRIGGER AS $$
DECLARE
  next_due_date TIMESTAMPTZ;
  pattern_type TEXT;
  pattern_interval INTEGER;
  pattern_end_date TIMESTAMPTZ;
  parent_id UUID;
  existing_task_id UUID;
BEGIN
  -- Solo procesar si la tarea cambió a 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Verificar si es recurrente
    IF NEW.is_recurring = true AND NEW.recurrence_pattern IS NOT NULL THEN
      -- Determinar el parent_task_id (la tarea original de la serie)
      parent_id := COALESCE(NEW.parent_task_id, NEW.id);
      
      -- Extraer información del patrón
      pattern_type := NEW.recurrence_pattern->>'type';
      pattern_interval := (NEW.recurrence_pattern->>'interval')::INTEGER;
      pattern_end_date := CASE 
        WHEN NEW.recurrence_pattern->>'end_date' IS NOT NULL 
        THEN (NEW.recurrence_pattern->>'end_date')::TIMESTAMPTZ 
        ELSE NULL 
      END;

      -- Calcular próxima fecha según el patrón
      CASE pattern_type
        WHEN 'daily' THEN
          next_due_date := NEW.due_date + (pattern_interval || ' days')::INTERVAL;
        WHEN 'weekly' THEN
          next_due_date := NEW.due_date + (pattern_interval || ' weeks')::INTERVAL;
        WHEN 'monthly' THEN
          next_due_date := NEW.due_date + (pattern_interval || ' months')::INTERVAL;
        ELSE
          -- Patrón no reconocido, no crear tarea
          RETURN NEW;
      END CASE;
      
      -- Verificar si ya existe una tarea recurrente con la misma fecha límite calculada para este parent
      -- Esto evita crear tareas duplicadas cuando se cambia el estado de completed a otro y luego de vuelta a completed
      -- Verificamos tanto por parent_task_id como por la fecha límite calculada
      SELECT id INTO existing_task_id
      FROM tasks
      WHERE parent_task_id = parent_id
        AND id != NEW.id  -- Excluir la tarea actual
        AND due_date = next_due_date  -- Misma fecha límite calculada
        AND is_recurring = true
      LIMIT 1;
      
      -- Si ya existe una tarea con la misma fecha límite, no crear otra
      IF existing_task_id IS NOT NULL THEN
        RAISE NOTICE 'Ya existe una tarea recurrente con la fecha límite % para parent_task_id: %. No se creará otra.', next_due_date, parent_id;
        RETURN NEW;
      END IF;
      
      -- También verificar si hay una tarea pendiente o en progreso (por si acaso)
      SELECT id INTO existing_task_id
      FROM tasks
      WHERE parent_task_id = parent_id
        AND id != NEW.id
        AND status IN ('pending', 'in_progress')
        AND is_recurring = true
      LIMIT 1;
      
      IF existing_task_id IS NOT NULL THEN
        RAISE NOTICE 'Ya existe una tarea recurrente pendiente para parent_task_id: %. No se creará otra.', parent_id;
        RETURN NEW;
      END IF;

      -- Verificar si hay fecha de fin y si la próxima fecha la excede
      IF pattern_end_date IS NOT NULL AND next_due_date > pattern_end_date THEN
        -- Ya pasó la fecha de fin, no crear más tareas
        RETURN NEW;
      END IF;

      -- Crear nueva tarea recurrente
      INSERT INTO tasks (
        title,
        description,
        client_name,
        due_date,
        priority,
        status,
        created_by,
        is_recurring,
        recurrence_pattern,
        parent_task_id,
        task_manager_id
      )
      VALUES (
        NEW.title,
        NEW.description,
        NEW.client_name,
        next_due_date,
        NEW.priority,
        'pending',
        NEW.created_by,
        true,
        NEW.recurrence_pattern,
        parent_id,
        NEW.task_manager_id
      )
      RETURNING id INTO existing_task_id;

      -- Copiar asignaciones de la tarea original
      INSERT INTO task_assignments (
        task_id,
        assigned_to_user,
        assigned_to_department,
        assigned_by
      )
      SELECT 
        existing_task_id,
        assigned_to_user,
        assigned_to_department,
        assigned_by
      FROM task_assignments
      WHERE task_id = NEW.id;

      RAISE NOTICE 'Tarea recurrente creada: % (parent_task_id: %)', next_due_date, parent_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear tareas recurrentes
DROP TRIGGER IF EXISTS trigger_create_recurring_task ON tasks;
CREATE TRIGGER trigger_create_recurring_task
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION create_recurring_task();

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ completed_at agregado con trigger automático
-- ✅ client_name ahora es opcional
-- ✅ task_manager_id agregado
-- ✅ Campos de tareas recurrentes agregados
-- ✅ Función y trigger para tareas recurrentes creados
-- ============================================

