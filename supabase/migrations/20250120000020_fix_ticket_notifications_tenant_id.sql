-- ============================================
-- Corregir funciones de notificaciones de tickets para incluir tenant_id
-- ============================================
-- Esta migración corrige las funciones que crean notificaciones para tickets
-- para que incluyan el tenant_id requerido
-- ============================================

-- 1. Corregir función notify_support_on_new_ticket
-- ============================================
CREATE OR REPLACE FUNCTION notify_support_on_new_ticket()
RETURNS TRIGGER AS $$
DECLARE
  ticket_creator_name text;
  support_department_id uuid;
  support_user RECORD;
  ticket_tenant_id uuid;
BEGIN
  -- Obtener el nombre del creador del ticket
  SELECT full_name INTO ticket_creator_name
  FROM profiles
  WHERE id = NEW.created_by;
  
  -- Obtener tenant_id del ticket directamente
  ticket_tenant_id := NEW.tenant_id;
  
  -- Si no se pudo obtener tenant_id del ticket, obtenerlo del perfil del creador como fallback
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
  
  -- Obtener el ID del departamento "Soporte" del mismo tenant
  SELECT id INTO support_department_id
  FROM departments
  WHERE name = 'Soporte'
    AND tenant_id = ticket_tenant_id
  LIMIT 1;
  
  -- Si no existe el departamento Soporte, salir sin error
  IF support_department_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Crear notificación para cada usuario del área Soporte del mismo tenant
  FOR support_user IN
    SELECT DISTINCT ud.user_id
    FROM user_departments ud
    WHERE ud.department_id = support_department_id
      AND ud.user_id != NEW.created_by  -- No notificar al creador del ticket
      AND ud.tenant_id = ticket_tenant_id  -- Filtrar por tenant_id
  LOOP
    -- Verificar que el usuario existe y está activo
    IF EXISTS (SELECT 1 FROM profiles WHERE id = support_user.user_id AND tenant_id = ticket_tenant_id) THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        ticket_id,
        tenant_id, -- Agregar tenant_id
        metadata,
        read
      ) VALUES (
        support_user.user_id,
        'ticket_created',
        'Nuevo ticket de soporte',
        COALESCE(ticket_creator_name, 'Un usuario') || ' ha creado el ticket "' || NEW.title || '"',
        NEW.id,
        ticket_tenant_id, -- Agregar tenant_id
        jsonb_build_object(
          'ticket_id', NEW.id,
          'ticket_title', NEW.title,
          'ticket_category', NEW.category,
          'ticket_priority', NEW.priority,
          'creator_id', NEW.created_by,
          'creator_name', ticket_creator_name
        ),
        false
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corregir función notify_ticket_comment
-- ============================================
CREATE OR REPLACE FUNCTION notify_ticket_comment()
RETURNS TRIGGER AS $$
DECLARE
  ticket_creator uuid;
  ticket_title text;
  commenter_name text;
  ticket_tenant_id uuid;
  assigned_user_id uuid;
BEGIN
  -- Obtener el creador del ticket, el título y el tenant_id
  SELECT t.created_by, t.title, t.tenant_id INTO ticket_creator, ticket_title, ticket_tenant_id
  FROM tickets t
  WHERE t.id = NEW.ticket_id;
  
  -- Si no se pudo obtener tenant_id del ticket, obtenerlo del perfil del creador
  IF ticket_tenant_id IS NULL THEN
    SELECT tenant_id INTO ticket_tenant_id
    FROM profiles
    WHERE id = ticket_creator
    LIMIT 1;
  END IF;
  
  -- Verificar que tenemos tenant_id
  IF ticket_tenant_id IS NULL THEN
    RAISE WARNING 'No se pudo obtener tenant_id para el ticket %', NEW.ticket_id;
    RETURN NEW; -- Salir sin crear notificaciones si no hay tenant_id
  END IF;
  
  -- Obtener el nombre del comentador
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Crear notificación para el creador del ticket (si no es el mismo que comentó)
  IF ticket_creator != NEW.user_id THEN
    INSERT INTO notifications (
      user_id, 
      type, 
      title, 
      message, 
      ticket_id, 
      tenant_id, -- Agregar tenant_id
      metadata
    )
    VALUES (
      ticket_creator,
      'ticket_comment',
      'Nuevo comentario en tu ticket',
      commenter_name || ' ha comentado en "' || ticket_title || '"',
      NEW.ticket_id,
      ticket_tenant_id, -- Agregar tenant_id
      jsonb_build_object('commenter_id', NEW.user_id, 'commenter_name', commenter_name)
    );
  END IF;
  
  -- Si el ticket está asignado a alguien, notificar también
  SELECT assigned_to INTO assigned_user_id
  FROM tickets
  WHERE id = NEW.ticket_id
    AND assigned_to IS NOT NULL 
    AND assigned_to != NEW.user_id 
    AND assigned_to != ticket_creator;
    
  IF assigned_user_id IS NOT NULL THEN
    -- Verificar que el usuario asignado pertenece al mismo tenant
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = assigned_user_id 
      AND tenant_id = ticket_tenant_id
    ) THEN
      INSERT INTO notifications (
        user_id, 
        type, 
        title, 
        message, 
        ticket_id, 
        tenant_id, -- Agregar tenant_id
        metadata
      )
      VALUES (
        assigned_user_id,
        'ticket_comment',
        'Nuevo comentario en ticket asignado',
        commenter_name || ' ha comentado en "' || ticket_title || '"',
        NEW.ticket_id,
        ticket_tenant_id, -- Agregar tenant_id
        jsonb_build_object('commenter_id', NEW.user_id, 'commenter_name', commenter_name)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar que las funciones se actualizaron correctamente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_support_on_new_ticket'
  ) THEN
    RAISE NOTICE '✅ Función notify_support_on_new_ticket actualizada correctamente';
  ELSE
    RAISE WARNING '⚠️  No se pudo actualizar la función notify_support_on_new_ticket';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_ticket_comment'
  ) THEN
    RAISE NOTICE '✅ Función notify_ticket_comment actualizada correctamente';
  ELSE
    RAISE WARNING '⚠️  No se pudo actualizar la función notify_ticket_comment';
  END IF;
END $$;

