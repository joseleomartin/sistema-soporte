-- ============================================
-- Corregir TODAS las funciones de notificaciones para incluir tenant_id
-- ============================================
-- Esta migración corrige todas las funciones que crean notificaciones
-- para que incluyan el tenant_id requerido
-- ============================================

-- 1. Corregir función notify_calendar_event
-- ============================================
CREATE OR REPLACE FUNCTION notify_calendar_event()
RETURNS TRIGGER AS $$
DECLARE
  creator_name text;
  event_tenant_id uuid;
BEGIN
  -- Si no hay usuario asignado, no crear notificación
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- Evitar notificar al creador si se lo asignó a sí mismo
  IF NEW.assigned_to = NEW.created_by THEN
    RETURN NEW;
  END IF;

  -- Obtener tenant_id del evento
  event_tenant_id := NEW.tenant_id;
  
  -- Si no se pudo obtener tenant_id del evento, obtenerlo del perfil del creador
  IF event_tenant_id IS NULL THEN
    SELECT tenant_id INTO event_tenant_id
    FROM profiles
    WHERE id = NEW.created_by
    LIMIT 1;
  END IF;

  -- Verificar que tenemos tenant_id
  IF event_tenant_id IS NULL THEN
    RAISE WARNING 'No se pudo obtener tenant_id para el evento %', NEW.id;
    RETURN NEW; -- Salir sin crear notificaciones si no hay tenant_id
  END IF;

  -- Obtener nombre del creador
  SELECT full_name INTO creator_name
  FROM profiles
  WHERE id = NEW.created_by;

  -- Crear notificación para el usuario asignado
  INSERT INTO notifications (user_id, type, title, message, event_id, tenant_id, metadata)
  VALUES (
    NEW.assigned_to,
    'calendar_event',
    'EmaGroup Notificaciones: Nuevo evento asignado',
    COALESCE(creator_name, 'Un administrador') || ' te ha asignado el evento "' || NEW.title || '"',
    NEW.id,
    event_tenant_id, -- Agregar tenant_id
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

-- 2. Corregir función notify_professional_news
-- ============================================
CREATE OR REPLACE FUNCTION notify_professional_news()
RETURNS TRIGGER AS $$
DECLARE
  creator_name TEXT;
  target_user RECORD;
  news_tenant_id uuid;
BEGIN
  -- Obtener tenant_id de la novedad profesional
  news_tenant_id := NEW.tenant_id;
  
  -- Si no se pudo obtener tenant_id, obtenerlo del perfil del creador
  IF news_tenant_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT tenant_id INTO news_tenant_id
    FROM profiles
    WHERE id = NEW.created_by
    LIMIT 1;
  END IF;

  -- Verificar que tenemos tenant_id
  IF news_tenant_id IS NULL THEN
    RAISE WARNING 'No se pudo obtener tenant_id para la novedad profesional %', NEW.id;
    RETURN NEW; -- Salir sin crear notificaciones si no hay tenant_id
  END IF;

  -- Obtener nombre del creador (si existe)
  IF NEW.created_by IS NOT NULL THEN
    SELECT full_name INTO creator_name
    FROM profiles
    WHERE id = NEW.created_by;
  END IF;

  -- Enviar notificación solo a usuarios del mismo tenant
  FOR target_user IN
    SELECT id
    FROM profiles
    WHERE tenant_id = news_tenant_id
  LOOP
    -- Si hay creador, evitar notificarle a sí mismo
    IF NEW.created_by IS NOT NULL AND target_user.id = NEW.created_by THEN
      CONTINUE;
    END IF;

    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      tenant_id, -- Agregar tenant_id
      metadata,
      read
    )
    VALUES (
      target_user.id,
      'professional_news',
      'Nueva novedad profesional',
      COALESCE(creator_name, 'Un administrador') || ' publicó: ' || COALESCE(NEW.title, 'Nueva novedad profesional'),
      news_tenant_id, -- Agregar tenant_id
      jsonb_build_object(
        'news_id', NEW.id,
        'url', NEW.url,
        'title', NEW.title
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Corregir función notify_social_post
-- ============================================
CREATE OR REPLACE FUNCTION notify_social_post()
RETURNS TRIGGER AS $$
DECLARE
  post_author_name TEXT;
  all_users RECORD;
  post_tenant_id uuid;
BEGIN
  -- Obtener tenant_id del post
  post_tenant_id := NEW.tenant_id;
  
  -- Si no se pudo obtener tenant_id del post, obtenerlo del perfil del autor
  IF post_tenant_id IS NULL THEN
    SELECT tenant_id INTO post_tenant_id
    FROM profiles
    WHERE id = NEW.user_id
    LIMIT 1;
  END IF;

  -- Verificar que tenemos tenant_id
  IF post_tenant_id IS NULL THEN
    RAISE WARNING 'No se pudo obtener tenant_id para el post %', NEW.id;
    RETURN NEW; -- Salir sin crear notificaciones si no hay tenant_id
  END IF;

  -- Obtener nombre del autor del post
  SELECT full_name INTO post_author_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Crear notificación solo para usuarios del mismo tenant (excepto el autor)
  FOR all_users IN
    SELECT id
    FROM profiles
    WHERE id != NEW.user_id
      AND tenant_id = post_tenant_id
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      social_post_id,
      tenant_id, -- Agregar tenant_id
      metadata,
      read
    ) VALUES (
      all_users.id,
      'social_post',
      'Nueva publicación en Social',
      post_author_name || ' ha publicado en Social',
      NEW.id,
      post_tenant_id, -- Agregar tenant_id
      jsonb_build_object(
        'post_author_id', NEW.user_id,
        'post_author_name', post_author_name,
        'post_content_preview', LEFT(COALESCE(NEW.content, ''), 100)
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Corregir función create_birthday_notifications
-- ============================================
CREATE OR REPLACE FUNCTION create_birthday_notifications()
RETURNS void AS $$
DECLARE
  birthday_user RECORD;
  all_users RECORD;
  today_month INT;
  today_day INT;
  birthday_tenant_id uuid;
BEGIN
  -- Obtener mes y día actual
  today_month := EXTRACT(MONTH FROM CURRENT_DATE);
  today_day := EXTRACT(DAY FROM CURRENT_DATE);
  
  -- Buscar usuarios que cumplen años hoy
  FOR birthday_user IN
    SELECT 
      id,
      full_name,
      birthday,
      tenant_id
    FROM profiles
    WHERE birthday IS NOT NULL
      AND EXTRACT(MONTH FROM birthday) = today_month
      AND EXTRACT(DAY FROM birthday) = today_day
  LOOP
    birthday_tenant_id := birthday_user.tenant_id;
    
    -- Verificar que tenemos tenant_id
    IF birthday_tenant_id IS NULL THEN
      RAISE WARNING 'No se pudo obtener tenant_id para el usuario de cumpleaños %', birthday_user.id;
      CONTINUE; -- Saltar este usuario si no tiene tenant_id
    END IF;

    -- Crear notificación solo para usuarios del mismo tenant (excepto el que cumple años)
    FOR all_users IN
      SELECT id
      FROM profiles
      WHERE id != birthday_user.id
        AND tenant_id = birthday_tenant_id
    LOOP
      -- Verificar que no exista ya una notificación de cumpleaños para este usuario hoy
      IF NOT EXISTS (
        SELECT 1
        FROM notifications
        WHERE user_id = all_users.id
          AND type = 'birthday'
          AND metadata->>'birthday_user_id' = birthday_user.id::text
          AND DATE(created_at) = CURRENT_DATE
      ) THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          tenant_id, -- Agregar tenant_id
          metadata,
          read
        ) VALUES (
          all_users.id,
          'birthday',
          '¡Es el cumpleaños de ' || birthday_user.full_name || '! 🎉',
          'Hoy es el cumpleaños de ' || birthday_user.full_name || '. ¡Déjale un mensaje en la sección Social!',
          birthday_tenant_id, -- Agregar tenant_id
          jsonb_build_object(
            'birthday_user_id', birthday_user.id,
            'birthday_user_name', birthday_user.full_name,
            'birthday_date', birthday_user.birthday
          ),
          false
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Corregir función create_task_mention_notifications
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
  task_tenant_id uuid;
BEGIN
  -- Obtener título de la tarea y tenant_id
  SELECT title, tenant_id INTO task_title, task_tenant_id
  FROM tasks
  WHERE id = p_task_id;
  
  -- Si no se pudo obtener tenant_id de la tarea, obtenerlo del perfil del mencionador
  IF task_tenant_id IS NULL THEN
    SELECT tenant_id INTO task_tenant_id
    FROM profiles
    WHERE id = p_mentioner_id
    LIMIT 1;
  END IF;

  -- Verificar que tenemos tenant_id
  IF task_tenant_id IS NULL THEN
    RAISE WARNING 'No se pudo obtener tenant_id para la tarea %', p_task_id;
    RETURN; -- Salir sin crear notificaciones si no hay tenant_id
  END IF;

  -- Obtener nombre del usuario que mencionó
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = p_mentioner_id;

  -- Crear notificación para cada usuario mencionado
  FOREACH mentioned_user_id IN ARRAY p_mentioned_user_ids
  LOOP
    -- No notificar al usuario que mencionó
    IF mentioned_user_id != p_mentioner_id THEN
      -- Verificar que el usuario mencionado pertenece al mismo tenant
      IF EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = mentioned_user_id 
        AND tenant_id = task_tenant_id
      ) THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          task_id,
          tenant_id, -- Agregar tenant_id
          metadata
        )
        VALUES (
          mentioned_user_id,
          'task_mention',
          'EmaGroup Notificaciones: Fuiste mencionado en el chat de ' || COALESCE(task_title, 'la tarea'),
          mentioner_name || ' te mencionó: ' || p_message_preview,
          p_task_id,
          task_tenant_id, -- Agregar tenant_id
          jsonb_build_object(
            'mentioner_id', p_mentioner_id,
            'mentioner_name', mentioner_name,
            'task_title', task_title
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Corregir función create_forum_mention_notifications
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
  subforum_tenant_id uuid;
BEGIN
  -- Obtener información del subforo y tenant_id
  SELECT s.name, s.client_name, s.tenant_id
  INTO subforum_name, subforum_client_name, subforum_tenant_id
  FROM subforums s
  WHERE s.id = p_subforum_id;
  
  -- Si no se pudo obtener tenant_id del subforo, obtenerlo del perfil del mencionador
  IF subforum_tenant_id IS NULL THEN
    SELECT tenant_id INTO subforum_tenant_id
    FROM profiles
    WHERE id = p_mentioner_id
    LIMIT 1;
  END IF;

  -- Verificar que tenemos tenant_id
  IF subforum_tenant_id IS NULL THEN
    RAISE WARNING 'No se pudo obtener tenant_id para el subforo %', p_subforum_id;
    RETURN; -- Salir sin crear notificaciones si no hay tenant_id
  END IF;

  -- Obtener nombre del usuario que mencionó
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = p_mentioner_id;

  -- Crear notificación para cada usuario mencionado
  FOREACH mentioned_user_id IN ARRAY p_mentioned_user_ids
  LOOP
    -- No notificar al usuario que mencionó
    IF mentioned_user_id != p_mentioner_id THEN
      -- Verificar que el usuario mencionado pertenece al mismo tenant
      IF EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = mentioned_user_id 
        AND tenant_id = subforum_tenant_id
      ) THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          subforum_id,
          tenant_id, -- Agregar tenant_id
          metadata
        )
        VALUES (
          mentioned_user_id,
          'forum_mention',
          'Fuiste mencionado en el chat de ' || COALESCE(subforum_client_name, subforum_name),
          mentioner_name || ' te mencionó: ' || p_message_preview,
          p_subforum_id,
          subforum_tenant_id, -- Agregar tenant_id
          jsonb_build_object(
            'mentioner_id', p_mentioner_id,
            'mentioner_name', mentioner_name,
            'subforum_name', subforum_name,
            'subforum_client_name', subforum_client_name
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Corregir función notify_ticket_status_change
-- ============================================
CREATE OR REPLACE FUNCTION notify_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
  ticket_title text;
  status_text text;
  ticket_tenant_id uuid;
BEGIN
  -- Solo notificar si el estado cambió
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Obtener el título del ticket y tenant_id
    SELECT title, tenant_id INTO ticket_title, ticket_tenant_id
    FROM tickets 
    WHERE id = NEW.id;
    
    -- Si no se pudo obtener tenant_id del ticket, obtenerlo del perfil del creador
    IF ticket_tenant_id IS NULL THEN
      SELECT tenant_id INTO ticket_tenant_id
      FROM profiles
      WHERE id = NEW.created_by
      LIMIT 1;
    END IF;

    -- Verificar que tenemos tenant_id
    IF ticket_tenant_id IS NULL THEN
      RAISE WARNING 'No se pudo obtener tenant_id para el ticket %', NEW.id;
      RETURN NEW; -- Salir sin crear notificaciones si no hay tenant_id
    END IF;
    
    -- Traducir el estado
    status_text := CASE NEW.status
      WHEN 'open' THEN 'abierto'
      WHEN 'in_progress' THEN 'en progreso'
      WHEN 'resolved' THEN 'resuelto'
      WHEN 'closed' THEN 'cerrado'
      ELSE NEW.status
    END;
    
    -- Notificar al creador del ticket (solo si pertenece al mismo tenant)
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = NEW.created_by 
      AND tenant_id = ticket_tenant_id
    ) THEN
      INSERT INTO notifications (user_id, type, title, message, ticket_id, tenant_id, metadata)
      VALUES (
        NEW.created_by,
        'ticket_status',
        'EmaGroup Notificaciones: Estado del ticket actualizado',
        'Tu ticket "' || ticket_title || '" ahora está ' || status_text,
        NEW.id,
        ticket_tenant_id, -- Agregar tenant_id
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Corregir función create_comment_notification
-- ============================================
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  ticket_creator_id uuid;
  ticket_title text;
  commenter_name text;
  commenter_role text;
  ticket_tenant_id uuid;
  commenter_user_id uuid;
BEGIN
  -- Obtener user_id del comentario (puede ser user_id o created_by dependiendo de la estructura)
  commenter_user_id := COALESCE(NEW.user_id, NEW.created_by);
  
  -- Get ticket creator, title, and tenant_id
  SELECT created_by, title, tenant_id INTO ticket_creator_id, ticket_title, ticket_tenant_id
  FROM tickets WHERE id = NEW.ticket_id;
  
  -- Si no se pudo obtener tenant_id del ticket, obtenerlo del perfil del creador
  IF ticket_tenant_id IS NULL THEN
    SELECT tenant_id INTO ticket_tenant_id
    FROM profiles
    WHERE id = ticket_creator_id
    LIMIT 1;
  END IF;

  -- Verificar que tenemos tenant_id
  IF ticket_tenant_id IS NULL THEN
    RAISE WARNING 'No se pudo obtener tenant_id para el ticket %', NEW.ticket_id;
    RETURN NEW; -- Salir sin crear notificaciones si no hay tenant_id
  END IF;
  
  -- Get commenter info (usar user_id en lugar de created_by)
  SELECT full_name, role INTO commenter_name, commenter_role
  FROM profiles WHERE id = commenter_user_id;
  
  -- Notify ticket creator if they're not the one commenting
  IF ticket_creator_id != commenter_user_id THEN
    -- Verificar que el creador pertenece al mismo tenant
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = ticket_creator_id 
      AND tenant_id = ticket_tenant_id
    ) THEN
      INSERT INTO notifications (user_id, ticket_id, comment_id, type, message, tenant_id)
      VALUES (
        ticket_creator_id,
        NEW.ticket_id,
        NEW.id,
        'ticket_comment',
        commenter_name || ' comentó en tu ticket: "' || ticket_title || '"',
        ticket_tenant_id -- Agregar tenant_id
      );
    END IF;
  END IF;
  
  -- If commenter is a regular user, notify all support and admin from the same tenant
  IF commenter_role = 'user' THEN
    INSERT INTO notifications (user_id, ticket_id, comment_id, type, message, tenant_id)
    SELECT 
      p.id,
      NEW.ticket_id,
      NEW.id,
      'ticket_comment',
      commenter_name || ' comentó en el ticket: "' || ticket_title || '"',
      ticket_tenant_id -- Agregar tenant_id
    FROM profiles p
    WHERE p.role IN ('admin', 'support')
      AND p.id != commenter_user_id
      AND p.tenant_id = ticket_tenant_id; -- Filtrar por tenant_id
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar que las funciones se actualizaron correctamente
DO $$
BEGIN
  RAISE NOTICE '✅ Todas las funciones de notificaciones han sido actualizadas para incluir tenant_id';
END $$;

