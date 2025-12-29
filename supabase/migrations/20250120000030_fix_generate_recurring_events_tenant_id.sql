-- ==================================================================
-- MIGRACIÓN: Corregir generate_recurring_events para incluir tenant_id
-- ==================================================================
-- Fecha: 2025-01-20
-- Descripción: Corrige la función generate_recurring_events() para incluir
--              tenant_id al insertar eventos recurrentes
-- ==================================================================

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
  event_tenant_id uuid;
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
      recurrence_week_position,
      tenant_id
    FROM calendar_events
    WHERE is_recurring = true
      AND parent_event_id IS NULL -- Solo eventos padre
      AND recurrence_pattern = 'monthly'
  LOOP
    -- Obtener tenant_id del evento padre
    event_tenant_id := parent_event.tenant_id;
    
    -- Si no se pudo obtener tenant_id, obtenerlo del perfil del creador
    IF event_tenant_id IS NULL THEN
      SELECT tenant_id INTO event_tenant_id
      FROM profiles
      WHERE id = parent_event.created_by
      LIMIT 1;
    END IF;

    -- Verificar que tenemos tenant_id
    IF event_tenant_id IS NULL THEN
      RAISE WARNING 'No se pudo obtener tenant_id para el evento padre %', parent_event.id;
      CONTINUE; -- Saltar este evento si no hay tenant_id
    END IF;

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
          AND tenant_id = event_tenant_id
      ) THEN
        -- Crear el evento recurrente con tenant_id
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
          recurrence_week_position,
          tenant_id
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
          parent_event.recurrence_week_position,
          event_tenant_id
        );
      END IF;
      
      months_added := months_added + 1;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================================
-- NOTAS:
-- ==================================================================
-- - La función ahora incluye tenant_id al insertar eventos recurrentes
-- - Obtiene tenant_id del evento padre o del perfil del creador
-- - Valida que tenant_id exista antes de insertar
-- - Incluye tenant_id en la verificación de duplicados
-- ==================================================================

