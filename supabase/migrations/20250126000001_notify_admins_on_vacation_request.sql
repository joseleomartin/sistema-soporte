-- ============================================
-- NOTIFICACIONES PARA SOLICITUDES DE VACACIONES
-- ============================================
-- Objetivo:
--  - Enviar una notificación y email a todos los administradores
--    cuando un usuario solicita vacaciones o licencias.
--  - Integrar el nuevo tipo 'vacation_request' al CHECK de notifications.
-- ============================================

-- 1) Actualizar el CHECK constraint de notifications para incluir 'vacation_request'
-- ============================================

-- Eliminar el constraint existente si existe
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Crear el nuevo constraint con todos los tipos válidos conocidos
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'calendar_event', 
  'ticket_comment', 
  'ticket_status',
  'task_assigned',
  'task_mention',
  'forum_mention',
  'direct_message',
  'birthday',
  'ticket_created',
  'social_post',
  'time_entry_reminder',
  'professional_news',
  'vacation_request'  -- Nuevo tipo
));

-- 2) Agregar columna vacation_id si no existe (para referenciar la solicitud)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'vacation_id'
  ) THEN
    ALTER TABLE notifications 
    ADD COLUMN vacation_id UUID REFERENCES vacations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_vacation_id ON notifications(vacation_id);
  END IF;
END $$;

-- 3) Función para crear notificaciones cuando se solicita una vacación
-- ============================================

CREATE OR REPLACE FUNCTION notify_admins_on_vacation_request()
RETURNS TRIGGER AS $$
DECLARE
  requester_name TEXT;
  requester_email TEXT;
  vacation_type_text TEXT;
  admin_user RECORD;
  notification_title TEXT;
  notification_message TEXT;
  start_date_formatted TEXT;
  end_date_formatted TEXT;
BEGIN
  -- Solo procesar si es una solicitud pendiente (no aprobada directamente por admin)
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Obtener información del usuario que solicita la vacación
  SELECT full_name, email INTO requester_name, requester_email
  FROM profiles
  WHERE id = NEW.user_id;

  -- Si no se encuentra el usuario, usar valores por defecto
  requester_name := COALESCE(requester_name, 'Un usuario');
  requester_email := COALESCE(requester_email, '');

  -- Formatear el tipo de solicitud
  vacation_type_text := CASE NEW.type
    WHEN 'vacation' THEN 'vacaciones'
    WHEN 'license' THEN 'licencia'
    ELSE 'solicitud'
  END;

  -- Formatear fechas
  start_date_formatted := TO_CHAR(NEW.start_date, 'DD/MM/YYYY');
  end_date_formatted := TO_CHAR(NEW.end_date, 'DD/MM/YYYY');

  -- Construir el título y mensaje de la notificación
  notification_title := 'Nueva solicitud de ' || vacation_type_text;
  notification_message := requester_name || ' ha solicitado ' || vacation_type_text || 
    ' desde el ' || start_date_formatted || ' hasta el ' || end_date_formatted || 
    ' (' || NEW.days_count || ' día' || CASE WHEN NEW.days_count != 1 THEN 's' ELSE '' END || ')';
  
  -- Agregar razón si existe
  IF NEW.reason IS NOT NULL AND NEW.reason != '' THEN
    notification_message := notification_message || E'\n\nRazón: ' || NEW.reason;
  END IF;

  -- Enviar notificación a todos los administradores del mismo tenant
  FOR admin_user IN
    SELECT id, email, full_name
    FROM profiles
    WHERE role = 'admin'
      AND tenant_id = NEW.tenant_id
      AND email IS NOT NULL
      AND email != ''
  LOOP
    -- Crear notificación para cada administrador
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      vacation_id,
      tenant_id,
      metadata,
      read
    )
    VALUES (
      admin_user.id,
      'vacation_request',
      notification_title,
      notification_message,
      NEW.id,
      NEW.tenant_id,
      jsonb_build_object(
        'vacation_id', NEW.id,
        'requester_id', NEW.user_id,
        'requester_name', requester_name,
        'requester_email', requester_email,
        'type', NEW.type,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'days_count', NEW.days_count,
        'reason', NEW.reason
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Trigger para ejecutar la función después de insertar una solicitud de vacaciones
-- ============================================

DROP TRIGGER IF EXISTS trigger_notify_admins_on_vacation_request ON vacations;
CREATE TRIGGER trigger_notify_admins_on_vacation_request
  AFTER INSERT ON vacations
  FOR EACH ROW
  WHEN (NEW.status = 'pending')  -- Solo para solicitudes pendientes
  EXECUTE FUNCTION notify_admins_on_vacation_request();

-- ============================================
-- NOTAS
-- ============================================
-- 1. Esta función crea notificaciones para todos los administradores del mismo tenant
-- 2. El trigger de emails (trigger_send_notification_email) se encargará automáticamente
--    de enviar los emails a los administradores
-- 3. Las notificaciones incluyen toda la información relevante de la solicitud
-- 4. Solo se notifica cuando el status es 'pending' (solicitudes nuevas)
-- ============================================
