-- ============================================
-- NOTIFICACIONES PARA ASIGNACIÓN DE TAREAS
-- ============================================
-- Agrega notificaciones cuando se asigna una nueva tarea a un usuario
-- ============================================

-- 1. Agregar tipo 'task_assigned' al CHECK constraint de notifications
-- ============================================

-- Primero, eliminar el constraint existente
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recrear el constraint con el nuevo tipo
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('calendar_event', 'ticket_comment', 'ticket_status', 'task_assigned'));

-- 2. Agregar columna task_id si no existe (para referenciar la tarea)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'task_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
  END IF;
END $$;

-- 3. Función para crear notificación de tarea asignada
-- ============================================

CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  task_title TEXT;
  task_creator_name TEXT;
  assigned_user_id UUID;
BEGIN
  -- Obtener información de la tarea
  SELECT t.title, p.full_name
  INTO task_title, task_creator_name
  FROM tasks t
  JOIN profiles p ON p.id = t.created_by
  WHERE t.id = NEW.task_id;

  -- Determinar a quién notificar
  IF NEW.assigned_to_user IS NOT NULL THEN
    -- Asignación directa a usuario
    assigned_user_id := NEW.assigned_to_user;
    
    -- Crear notificación
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      task_id,
      metadata,
      read
    ) VALUES (
      assigned_user_id,
      'task_assigned',
      'Nueva tarea asignada',
      'Se te ha asignado la tarea "' || COALESCE(task_title, 'Sin título') || '"' ||
      CASE 
        WHEN task_creator_name IS NOT NULL THEN ' por ' || task_creator_name
        ELSE ''
      END || '.',
      NEW.task_id,
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
      metadata,
      read
    )
    SELECT 
      ud.user_id,
      'task_assigned',
      'Nueva tarea asignada a tu departamento',
      'Se ha asignado la tarea "' || COALESCE(task_title, 'Sin título') || '"' ||
      ' a tu departamento' ||
      CASE 
        WHEN task_creator_name IS NOT NULL THEN ' por ' || task_creator_name
        ELSE ''
      END || '.',
      NEW.task_id,
      jsonb_build_object(
        'task_id', NEW.task_id,
        'department_id', NEW.assigned_to_department,
        'assigned_by', NEW.assigned_by,
        'assigned_at', NEW.assigned_at
      ),
      false
    FROM user_departments ud
    WHERE ud.department_id = NEW.assigned_to_department;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear trigger para detectar nuevas asignaciones
-- ============================================

DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON task_assignments;
CREATE TRIGGER trigger_notify_task_assigned
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assigned();

-- 5. Habilitar Realtime para notifications (si no está ya habilitado)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que el constraint incluye 'task_assigned'
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'notifications_type_check';

-- Verificar que la columna task_id existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name = 'task_id';

-- Verificar que el trigger existe
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname = 'trigger_notify_task_assigned';

-- ============================================
-- FIN
-- ============================================

-- ✅ Sistema de notificaciones para tareas configurado correctamente


