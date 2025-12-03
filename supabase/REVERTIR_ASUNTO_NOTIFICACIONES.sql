-- ============================================
-- REVERTIR ASUNTO DE NOTIFICACIONES EN LA PLATAFORMA
-- ============================================
-- Quita "EmaGroup Notificaciones:" de los títulos de notificaciones
-- El prefijo solo aparecerá en el email, no en la app
-- ============================================

-- 1. REVERTIR: notify_ticket_comment() - Comentarios en tickets
-- ============================================
CREATE OR REPLACE FUNCTION notify_ticket_comment()
RETURNS TRIGGER AS $$
DECLARE
  ticket_creator uuid;
  ticket_assigned_to uuid;
  ticket_title text;
  commenter_name text;
BEGIN
  -- Obtener datos básicos del ticket
  SELECT created_by, assigned_to, title
  INTO ticket_creator, ticket_assigned_to, ticket_title
  FROM tickets
  WHERE id = NEW.ticket_id;

  -- Obtener nombre del comentarista usando user_id
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Notificar al creador del ticket (si no es quien comentó)
  IF ticket_creator IS NOT NULL AND ticket_creator <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, ticket_id, metadata)
    VALUES (
      ticket_creator,
      'ticket_comment',
      'Nuevo comentario en tu ticket',
      commenter_name || ' ha respondido en "' || ticket_title || '"',
      NEW.ticket_id,
      jsonb_build_object(
        'commenter_id', NEW.user_id,
        'commenter_name', commenter_name,
        'comment_id', NEW.id
      )
    );
  END IF;

  -- Notificar al asignado (si existe y no es el creador ni el comentarista)
  IF ticket_assigned_to IS NOT NULL 
     AND ticket_assigned_to <> NEW.user_id
     AND ticket_assigned_to <> ticket_creator THEN
    INSERT INTO notifications (user_id, type, title, message, ticket_id, metadata)
    VALUES (
      ticket_assigned_to,
      'ticket_comment',
      'Nuevo comentario en ticket asignado',
      commenter_name || ' ha respondido en "' || ticket_title || '"',
      NEW.ticket_id,
      jsonb_build_object(
        'commenter_id', NEW.user_id,
        'commenter_name', commenter_name,
        'comment_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. REVERTIR: notify_ticket_status_change() - Cambios de estado en tickets
-- ============================================
CREATE OR REPLACE FUNCTION notify_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
  ticket_title text;
  status_text text;
BEGIN
  -- Solo notificar si el estado cambió
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Obtener el título del ticket
    SELECT title INTO ticket_title FROM tickets WHERE id = NEW.id;
    
    -- Traducir el estado
    status_text := CASE NEW.status
      WHEN 'open' THEN 'abierto'
      WHEN 'in_progress' THEN 'en progreso'
      WHEN 'resolved' THEN 'resuelto'
      WHEN 'closed' THEN 'cerrado'
      ELSE NEW.status
    END;
    
    -- Notificar al creador del ticket
    INSERT INTO notifications (user_id, type, title, message, ticket_id, metadata)
    VALUES (
      NEW.created_by,
      'ticket_status',
      'Estado del ticket actualizado',
      'El ticket "' || ticket_title || '" ha cambiado a ' || status_text,
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'updated_by', NEW.updated_by
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REVERTIR: notify_calendar_event() - Eventos de calendario
-- ============================================
CREATE OR REPLACE FUNCTION notify_calendar_event()
RETURNS TRIGGER AS $$
DECLARE
  creator_name text;
BEGIN
  -- Si no hay usuario asignado, no crear notificación
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- Evitar notificar al creador si se lo asignó a sí mismo
  IF NEW.assigned_to = NEW.created_by THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre del creador
  SELECT full_name INTO creator_name
  FROM profiles
  WHERE id = NEW.created_by;

  -- Crear notificación para el usuario asignado
  INSERT INTO notifications (user_id, type, title, message, event_id, metadata)
  VALUES (
    NEW.assigned_to,
    'calendar_event',
    'Nuevo evento asignado',
    COALESCE(creator_name, 'Un administrador') || ' te ha asignado el evento "' || NEW.title || '"',
    NEW.id,
    jsonb_build_object(
      'start_date', NEW.start_date,
      'end_date', NEW.end_date,
      'all_day', NEW.all_day,
      'color', NEW.color,
      'event_type', NEW.event_type,
      'creator_id', NEW.created_by,
      'creator_name', creator_name
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. REVERTIR: notify_task_assigned() - Asignación de tareas
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
  LEFT JOIN profiles p ON p.id = t.created_by
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

-- 5. REVERTIR: create_task_mention_notifications() - Menciones en tareas
-- ============================================
CREATE OR REPLACE FUNCTION create_task_mention_notifications(
  p_task_id UUID,
  p_mentioned_user_ids UUID[],
  p_mentioner_id UUID,
  p_message_preview TEXT
)
RETURNS void AS $$
DECLARE
  task_title TEXT;
  mentioner_name TEXT;
  mentioned_user_id UUID;
BEGIN
  -- Obtener título de la tarea
  SELECT title INTO task_title
  FROM tasks
  WHERE id = p_task_id;

  -- Obtener nombre del usuario que mencionó
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = p_mentioner_id;

  -- Crear notificación para cada usuario mencionado
  FOREACH mentioned_user_id IN ARRAY p_mentioned_user_ids
  LOOP
    -- No notificar al usuario que mencionó
    IF mentioned_user_id != p_mentioner_id THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        task_id,
        metadata
      )
      VALUES (
        mentioned_user_id,
        'task_mention',
        'Fuiste mencionado en el chat de ' || COALESCE(task_title, 'la tarea'),
        mentioner_name || ' te mencionó: ' || p_message_preview,
        p_task_id,
        jsonb_build_object(
          'mentioner_id', p_mentioner_id,
          'mentioner_name', mentioner_name,
          'task_title', task_title
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. REVERTIR: create_forum_mention_notifications() - Menciones en foros
-- ============================================
CREATE OR REPLACE FUNCTION create_forum_mention_notifications(
  p_subforum_id UUID,
  p_mentioned_user_ids UUID[],
  p_mentioner_id UUID,
  p_message_preview TEXT
)
RETURNS void AS $$
DECLARE
  subforum_name TEXT;
  subforum_client_name TEXT;
  mentioner_name TEXT;
  mentioned_user_id UUID;
BEGIN
  -- Obtener información del subforo (client_name está en la tabla subforums directamente)
  SELECT s.name, s.client_name
  INTO subforum_name, subforum_client_name
  FROM subforums s
  WHERE s.id = p_subforum_id;

  -- Obtener nombre del usuario que mencionó
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = p_mentioner_id;

  -- Crear notificación para cada usuario mencionado
  FOREACH mentioned_user_id IN ARRAY p_mentioned_user_ids
  LOOP
    -- No notificar al usuario que mencionó
    IF mentioned_user_id != p_mentioner_id THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        subforum_id,
        metadata
      )
      VALUES (
        mentioned_user_id,
        'forum_mention',
        'Fuiste mencionado en el chat de ' || COALESCE(subforum_client_name, subforum_name),
        mentioner_name || ' te mencionó: ' || p_message_preview,
        p_subforum_id,
        jsonb_build_object(
          'mentioner_id', p_mentioner_id,
          'mentioner_name', mentioner_name,
          'subforum_name', subforum_name,
          'subforum_client_name', subforum_client_name
        )
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ✅ TODAS LAS FUNCIONES REVERTIDAS
-- ============================================
-- Los títulos de notificaciones ya NO incluyen "EmaGroup Notificaciones:"
-- El prefijo solo aparecerá en el asunto del email (manejado por la Edge Function)
-- ============================================

