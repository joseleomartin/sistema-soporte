-- ============================================
-- Corregir función notify_task_assigned para incluir tenant_id
-- ============================================
-- Esta migración corrige la función que crea notificaciones al asignar tareas
-- para que incluya el tenant_id requerido
-- ============================================

CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  task_creator_name TEXT;
  assigned_user_id UUID;
  task_tenant_id UUID;
BEGIN
  -- Obtener información de la tarea incluyendo tenant_id
  SELECT t.title, p.full_name, t.tenant_id
  INTO task_title, task_creator_name, task_tenant_id
  FROM tasks t
  JOIN profiles p ON p.id = t.created_by
  WHERE t.id = NEW.task_id;

  -- Verificar que tenemos tenant_id
  IF task_tenant_id IS NULL THEN
    RAISE WARNING 'No se pudo obtener tenant_id para la tarea %', NEW.task_id;
    -- Intentar obtener tenant_id del usuario asignado como fallback
    SELECT p.tenant_id INTO task_tenant_id
    FROM profiles p
    WHERE p.id = COALESCE(NEW.assigned_to_user, (
      SELECT ud.user_id 
      FROM user_departments ud 
      WHERE ud.department_id = NEW.assigned_to_department 
      LIMIT 1
    ))
    LIMIT 1;
    
    IF task_tenant_id IS NULL THEN
      RAISE EXCEPTION 'No se pudo determinar tenant_id para la notificación de tarea %', NEW.task_id;
    END IF;
  END IF;

  -- Determinar a quién notificar
  IF NEW.assigned_to_user IS NOT NULL THEN
    -- Asignación directa a usuario
    assigned_user_id := NEW.assigned_to_user;
    
    -- Crear notificación con tenant_id
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      task_id,
      tenant_id,
      metadata,
      read
    ) VALUES (
      assigned_user_id,
      'task_assigned',
      'EmaGroup Notificaciones: Nueva tarea asignada',
      'Se te ha asignado la tarea "' || COALESCE(task_title, 'Sin título') || '"' ||
      CASE 
        WHEN task_creator_name IS NOT NULL THEN ' por ' || task_creator_name
        ELSE ''
      END || '.',
      NEW.task_id,
      task_tenant_id, -- Agregar tenant_id
      jsonb_build_object(
        'task_id', NEW.task_id,
        'assigned_by', NEW.assigned_by,
        'assigned_at', NEW.assigned_at
      ),
      false
    );
  ELSIF NEW.assigned_to_department IS NOT NULL THEN
    -- Asignación a departamento: notificar a todos los usuarios del departamento
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      task_id,
      tenant_id,
      metadata,
      read
    )
    SELECT 
      ud.user_id,
      'task_assigned',
      'EmaGroup Notificaciones: Nueva tarea asignada a tu departamento',
      'Se ha asignado la tarea "' || COALESCE(task_title, 'Sin título') || '"' ||
      ' a tu departamento' ||
      CASE 
        WHEN task_creator_name IS NOT NULL THEN ' por ' || task_creator_name
        ELSE ''
      END || '.',
      NEW.task_id,
      task_tenant_id, -- Agregar tenant_id
      jsonb_build_object(
        'task_id', NEW.task_id,
        'department_id', NEW.assigned_to_department,
        'assigned_by', NEW.assigned_by,
        'assigned_at', NEW.assigned_at
      ),
      false
    FROM user_departments ud
    WHERE ud.department_id = NEW.assigned_to_department
    AND ud.tenant_id = task_tenant_id; -- Filtrar por tenant_id también
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar que la función se actualizó correctamente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_task_assigned'
  ) THEN
    RAISE NOTICE '✅ Función notify_task_assigned actualizada correctamente';
  ELSE
    RAISE WARNING '⚠️  No se pudo actualizar la función notify_task_assigned';
  END IF;
END $$;


