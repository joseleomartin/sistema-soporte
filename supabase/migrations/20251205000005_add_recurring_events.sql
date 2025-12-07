-- ============================================
-- AGREGAR SOPORTE PARA EVENTOS RECURRENTES
-- ============================================
-- Permite crear eventos que se repiten mensualmente
-- ============================================

-- 1. Agregar columnas para eventos recurrentes
-- ============================================
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('monthly', 'weekly', 'daily', 'yearly'));

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ;

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS recurrence_count INTEGER;

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE;

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS recurrence_original_date TIMESTAMPTZ;

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS recurrence_weekday INTEGER CHECK (recurrence_weekday >= 0 AND recurrence_weekday <= 6); -- 0 = domingo, 1 = lunes, ..., 6 = sábado

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS recurrence_week_position INTEGER CHECK (recurrence_week_position >= -1 AND recurrence_week_position <= 4); -- -1 = último, 1 = primero, 2 = segundo, 3 = tercer, 4 = cuarto

-- 2. Crear índices para mejorar rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_calendar_events_is_recurring ON calendar_events(is_recurring);
CREATE INDEX IF NOT EXISTS idx_calendar_events_parent_event_id ON calendar_events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence_pattern ON calendar_events(recurrence_pattern);

-- 3. Función auxiliar para obtener el día de la semana (0 = domingo, 1 = lunes, ..., 6 = sábado)
-- ============================================
CREATE OR REPLACE FUNCTION get_weekday(date_val DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(DOW FROM date_val)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Función auxiliar para encontrar el día específico del mes (ej: primer jueves)
-- ============================================
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

-- 5. Función para generar eventos recurrentes mensuales
-- ============================================
CREATE OR REPLACE FUNCTION generate_recurring_events()
RETURNS void AS $$
DECLARE
  parent_event RECORD;
  end_date DATE;
  event_date DATE;
  new_start_date TIMESTAMPTZ;
  new_end_date TIMESTAMPTZ;
  months_added INTEGER := 0;
  max_months INTEGER := 24; -- Generar hasta 24 meses adelante
  day_of_month INTEGER;
  target_month DATE;
  target_year INTEGER;
  target_month_num INTEGER;
  calculated_date DATE;
BEGIN
  -- Obtener eventos recurrentes que necesitan generar instancias futuras
  FOR parent_event IN
    SELECT 
      id,
      title,
      description,
      start_date,
      end_date,
      all_day,
      color,
      created_by,
      assigned_to,
      event_type,
      recurrence_pattern,
      recurrence_end_date,
      recurrence_count,
      recurrence_original_date,
      recurrence_weekday,
      recurrence_week_position
    FROM calendar_events
    WHERE is_recurring = true
      AND parent_event_id IS NULL -- Solo eventos padre
      AND recurrence_pattern = 'monthly'
  LOOP
    -- Determinar fecha de fin
    IF parent_event.recurrence_end_date IS NOT NULL THEN
      end_date := parent_event.recurrence_end_date::DATE;
    ELSIF parent_event.recurrence_count IS NOT NULL THEN
      -- Calcular fecha de fin basada en el número de ocurrencias
      event_date := COALESCE(parent_event.recurrence_original_date::DATE, parent_event.start_date::DATE);
      end_date := (event_date + ((parent_event.recurrence_count - 1) || ' months')::INTERVAL)::DATE;
    ELSE
      -- Por defecto, generar hasta 24 meses
      event_date := COALESCE(parent_event.recurrence_original_date::DATE, parent_event.start_date::DATE);
      end_date := (event_date + (max_months || ' months')::INTERVAL)::DATE;
    END IF;

    -- Obtener la fecha original del evento
    event_date := COALESCE(parent_event.recurrence_original_date::DATE, parent_event.start_date::DATE);
    
    -- Generar eventos mensuales hasta la fecha de fin
    months_added := 1; -- Empezar desde el mes siguiente
    
    WHILE months_added <= max_months
    LOOP
      -- Calcular el mes objetivo
      target_month := (event_date + (months_added || ' months')::INTERVAL)::DATE;
      target_year := EXTRACT(YEAR FROM target_month)::INTEGER;
      target_month_num := EXTRACT(MONTH FROM target_month)::INTEGER;
      
      -- Si excede la fecha de fin, salir
      IF target_month > end_date THEN
        EXIT;
      END IF;

      -- Si hay configuración de día de la semana (ej: primer jueves)
      IF parent_event.recurrence_weekday IS NOT NULL AND parent_event.recurrence_week_position IS NOT NULL THEN
        calculated_date := find_weekday_in_month(
          target_year,
          target_month_num,
          parent_event.recurrence_weekday,
          parent_event.recurrence_week_position
        );
      ELSE
        -- Modo original: mismo día del mes
        day_of_month := EXTRACT(DAY FROM event_date)::INTEGER;
        
        -- Ajustar el día si el mes objetivo tiene menos días (ej: 31 de enero -> 28/29 de febrero)
        IF EXTRACT(DAY FROM target_month) < day_of_month THEN
          -- Usar el último día del mes
          calculated_date := (DATE_TRUNC('month', target_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
        ELSE
          -- Asegurar que el día sea correcto
          calculated_date := DATE_TRUNC('month', target_month) + (day_of_month - 1 || ' days')::INTERVAL;
        END IF;
      END IF;

      new_start_date := calculated_date::TIMESTAMPTZ;
      
      -- Ajustar la hora si el evento original tenía hora
      IF NOT parent_event.all_day THEN
        new_start_date := DATE_TRUNC('day', new_start_date) + 
          (EXTRACT(HOUR FROM parent_event.start_date) || ' hours')::INTERVAL +
          (EXTRACT(MINUTE FROM parent_event.start_date) || ' minutes')::INTERVAL;
      END IF;

      -- Calcular fecha de fin si existe
      IF parent_event.end_date IS NOT NULL THEN
        new_end_date := calculated_date::TIMESTAMPTZ;
        IF NOT parent_event.all_day THEN
          new_end_date := DATE_TRUNC('day', new_end_date) + 
            (EXTRACT(HOUR FROM parent_event.end_date) || ' hours')::INTERVAL +
            (EXTRACT(MINUTE FROM parent_event.end_date) || ' minutes')::INTERVAL;
        ELSE
          new_end_date := (calculated_date + INTERVAL '1 day' - INTERVAL '1 second')::TIMESTAMPTZ;
        END IF;
      ELSE
        new_end_date := NULL;
      END IF;

      -- Verificar si el evento ya existe (evitar duplicados)
      IF NOT EXISTS (
        SELECT 1 FROM calendar_events
        WHERE parent_event_id = parent_event.id
          AND DATE_TRUNC('day', start_date) = DATE_TRUNC('day', new_start_date)
          AND COALESCE(assigned_to, '00000000-0000-0000-0000-000000000000'::uuid) = 
              COALESCE(parent_event.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid)
      ) THEN
        -- Crear el evento recurrente
        INSERT INTO calendar_events (
          title,
          description,
          start_date,
          end_date,
          all_day,
          color,
          created_by,
          assigned_to,
          event_type,
          is_recurring,
          recurrence_pattern,
          parent_event_id,
          recurrence_original_date,
          recurrence_weekday,
          recurrence_week_position
        ) VALUES (
          parent_event.title,
          parent_event.description,
          new_start_date,
          new_end_date,
          parent_event.all_day,
          parent_event.color,
          parent_event.created_by,
          parent_event.assigned_to,
          parent_event.event_type,
          true,
          parent_event.recurrence_pattern,
          parent_event.id,
          parent_event.recurrence_original_date,
          parent_event.recurrence_weekday,
          parent_event.recurrence_week_position
        );
      END IF;
      
      months_added := months_added + 1;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Comentarios
-- ============================================
COMMENT ON COLUMN calendar_events.is_recurring IS 'Indica si el evento es recurrente';
COMMENT ON COLUMN calendar_events.recurrence_pattern IS 'Patrón de recurrencia: monthly, weekly, daily, yearly';
COMMENT ON COLUMN calendar_events.recurrence_end_date IS 'Fecha de fin de la recurrencia';
COMMENT ON COLUMN calendar_events.recurrence_count IS 'Número de ocurrencias (alternativa a recurrence_end_date)';
COMMENT ON COLUMN calendar_events.parent_event_id IS 'ID del evento padre (null para el evento original)';
COMMENT ON COLUMN calendar_events.recurrence_original_date IS 'Fecha original del evento padre';
COMMENT ON COLUMN calendar_events.recurrence_weekday IS 'Día de la semana (0 = domingo, 1 = lunes, ..., 6 = sábado)';
COMMENT ON COLUMN calendar_events.recurrence_week_position IS 'Posición en el mes (-1 = último, 1 = primero, 2 = segundo, 3 = tercer, 4 = cuarto)';

COMMENT ON FUNCTION generate_recurring_events() IS 
'Genera eventos recurrentes mensuales basados en eventos padre. Debe ejecutarse periódicamente (ej: diariamente).';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Campos de recurrencia agregados
-- ✅ Función generate_recurring_events() creada
-- ✅ Índices creados para mejorar rendimiento
-- ============================================
-- 
-- NOTA: Para generar eventos recurrentes automáticamente, ejecutar:
-- SELECT generate_recurring_events();
-- 
-- O configurar un cron job para ejecutarlo diariamente:
-- SELECT cron.schedule('generate-recurring-events', '0 1 * * *', 'SELECT generate_recurring_events();');
-- ============================================

