-- ============================================
-- MIGRACIÓN: Corregir tenant_id en tareas recurrentes
-- ============================================
-- Corrige la función create_recurring_task() para incluir tenant_id
-- ============================================

-- Actualizar función create_recurring_task() para incluir tenant_id
CREATE OR REPLACE FUNCTION create_recurring_task()
RETURNS TRIGGER AS $$
DECLARE
  next_due_date TIMESTAMPTZ;
  pattern_type TEXT;
  pattern_interval INTEGER;
  pattern_end_date TIMESTAMPTZ;
  parent_id UUID;
  existing_task_id UUID;
  target_year INTEGER;
  target_month INTEGER;
  calculated_date DATE;
  original_due_date DATE;
  original_time TIME;
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

      -- Guardar hora original de la tarea
      original_due_date := NEW.due_date::DATE;
      original_time := NEW.due_date::TIME;

      -- Calcular próxima fecha según el patrón
      IF pattern_type = 'monthly' AND NEW.recurrence_weekday IS NOT NULL AND NEW.recurrence_week_position IS NOT NULL THEN
        -- Recurrencia por día de semana específico (ej: primer jueves)
        -- Calcular el próximo mes
        target_month := EXTRACT(MONTH FROM original_due_date)::INTEGER + pattern_interval;
        target_year := EXTRACT(YEAR FROM original_due_date)::INTEGER;
        
        -- Ajustar año si el mes excede 12
        IF target_month > 12 THEN
          target_month := target_month - 12;
          target_year := target_year + 1;
        END IF;
        
        -- Calcular la fecha del día específico del mes
        calculated_date := find_weekday_in_month(
          target_year,
          target_month,
          NEW.recurrence_weekday,
          NEW.recurrence_week_position
        );
        
        -- Combinar fecha calculada con la hora original
        next_due_date := (calculated_date::TEXT || ' ' || original_time::TEXT)::TIMESTAMPTZ;
      ELSE
        -- Recurrencia normal (daily, weekly, monthly simple)
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
      END IF;
      
      -- Verificar si ya existe una tarea recurrente con la misma fecha límite calculada para este parent
      SELECT id INTO existing_task_id
      FROM tasks
      WHERE parent_task_id = parent_id
        AND id != NEW.id
        AND due_date = next_due_date
        AND is_recurring = true
      LIMIT 1;
      
      -- Si ya existe una tarea con la misma fecha límite, no crear otra
      IF existing_task_id IS NOT NULL THEN
        RAISE NOTICE 'Ya existe una tarea recurrente con la fecha límite % para parent_task_id: %. No se creará otra.', next_due_date, parent_id;
        RETURN NEW;
      END IF;
      
      -- También verificar si hay una tarea pendiente o en progreso
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

      -- Verificar que NEW.tenant_id no sea null
      IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'No se puede crear una tarea recurrente sin tenant_id. La tarea original debe tener tenant_id.';
      END IF;

      -- Crear nueva tarea recurrente (INCLUYENDO tenant_id)
      INSERT INTO tasks (
        title,
        description,
        client_name,
        due_date,
        priority,
        status,
        created_by,
        tenant_id,
        is_recurring,
        recurrence_pattern,
        recurrence_weekday,
        recurrence_week_position,
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
        NEW.tenant_id,
        true,
        NEW.recurrence_pattern,
        NEW.recurrence_weekday,
        NEW.recurrence_week_position,
        parent_id,
        NEW.task_manager_id
      )
      RETURNING id INTO existing_task_id;

      -- Copiar asignaciones de la tarea original (INCLUYENDO tenant_id)
      INSERT INTO task_assignments (
        task_id,
        assigned_to_user,
        assigned_to_department,
        assigned_by,
        tenant_id
      )
      SELECT 
        existing_task_id,
        assigned_to_user,
        assigned_to_department,
        assigned_by,
        COALESCE(ta.tenant_id, NEW.tenant_id)
      FROM task_assignments ta
      WHERE ta.task_id = NEW.id;

      RAISE NOTICE 'Tarea recurrente creada: % (parent_task_id: %)', next_due_date, parent_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Función create_recurring_task() actualizada para incluir tenant_id
-- ✅ Validación agregada para asegurar que tenant_id no sea null
-- ============================================
