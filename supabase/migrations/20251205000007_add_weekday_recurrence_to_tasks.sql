-- ============================================
-- AGREGAR SOPORTE PARA RECURRENCIA POR DÍA DE SEMANA EN TAREAS
-- ============================================
-- Permite crear tareas recurrentes que se repiten en días específicos del mes
-- (ej: primer jueves de cada mes)
-- ============================================

-- 1. Agregar columnas para recurrencia por día de semana
-- ============================================
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS recurrence_weekday INTEGER CHECK (recurrence_weekday >= 0 AND recurrence_weekday <= 6); 
-- 0 = domingo, 1 = lunes, ..., 6 = sábado

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS recurrence_week_position INTEGER CHECK (recurrence_week_position >= -1 AND recurrence_week_position <= 4); 
-- -1 = último, 1 = primero, 2 = segundo, 3 = tercer, 4 = cuarto

-- 2. Crear índices para mejorar rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_weekday ON tasks(recurrence_weekday);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_week_position ON tasks(recurrence_week_position);

-- 3. Función auxiliar para encontrar el día específico del mes (ej: primer jueves)
-- ============================================
-- Reutilizamos la función que ya creamos para eventos del calendario
-- Si no existe, la creamos aquí también
CREATE OR REPLACE FUNCTION find_weekday_in_month(year_val INTEGER, month_val INTEGER, weekday INTEGER, week_position INTEGER)
RETURNS DATE AS $$
DECLARE
  first_day DATE;
  first_weekday INTEGER;
  days_to_add INTEGER;
  target_date DATE;
  last_day DATE;
BEGIN
  -- Primer día del mes
  first_day := DATE_TRUNC('month', MAKE_DATE(year_val, month_val, 1))::DATE;
  first_weekday := EXTRACT(DOW FROM first_day)::INTEGER;
  
  -- Calcular días a agregar para llegar al primer día de la semana deseado
  days_to_add := (weekday - first_weekday + 7) % 7;
  
  IF week_position = -1 THEN
    -- Último día de la semana del mes
    last_day := (DATE_TRUNC('month', first_day) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    target_date := last_day;
    
    -- Retroceder hasta encontrar el día de la semana correcto
    WHILE EXTRACT(DOW FROM target_date)::INTEGER != weekday LOOP
      target_date := target_date - INTERVAL '1 day';
    END LOOP;
  ELSE
    -- Primer, segundo, tercer o cuarto día de la semana
    target_date := first_day + (days_to_add || ' days')::INTERVAL;
    
    -- Agregar semanas según la posición (1 = primera semana, 2 = segunda, etc.)
    IF week_position > 1 THEN
      target_date := target_date + ((week_position - 1) || ' weeks')::INTERVAL;
    END IF;
    
    -- Verificar que no exceda el mes
    IF EXTRACT(MONTH FROM target_date) != month_val THEN
      -- Si excede, usar el último día de la semana del mes
      last_day := (DATE_TRUNC('month', first_day) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
      target_date := last_day;
      WHILE EXTRACT(DOW FROM target_date)::INTEGER != weekday LOOP
        target_date := target_date - INTERVAL '1 day';
      END LOOP;
    END IF;
  END IF;
  
  RETURN target_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Actualizar función create_recurring_task() para soportar días de semana específicos
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
        true,
        NEW.recurrence_pattern,
        NEW.recurrence_weekday,
        NEW.recurrence_week_position,
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

-- 5. Comentarios
-- ============================================
COMMENT ON COLUMN tasks.recurrence_weekday IS 'Día de la semana para recurrencia mensual (0 = domingo, 1 = lunes, ..., 6 = sábado)';
COMMENT ON COLUMN tasks.recurrence_week_position IS 'Posición en el mes para recurrencia mensual (-1 = último, 1 = primero, 2 = segundo, 3 = tercer, 4 = cuarto)';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Campos recurrence_weekday y recurrence_week_position agregados
-- ✅ Función find_weekday_in_month() creada/actualizada
-- ✅ Función create_recurring_task() actualizada para soportar días de semana
-- ✅ Índices creados para mejorar rendimiento
-- ============================================


