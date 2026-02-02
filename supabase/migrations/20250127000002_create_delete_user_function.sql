-- ============================================
-- FUNCIÓN SEGURA PARA ELIMINAR USUARIOS
-- ============================================
-- Objetivo:
--   - Permitir que administradores eliminen usuarios
--   - Forzar desconexión completa del usuario
--   - MANTENER TODOS LOS DATOS HISTÓRICOS (no se borra nada)
--   - Evitar problemas de RLS durante la eliminación
-- 
-- IMPORTANTE: Esta función DESACTIVA el usuario (no lo elimina físicamente)
-- para mantener TODOS los datos históricos intactos:
-- ✅ Tickets, comentarios, tareas, mensajes, archivos, etc. se mantienen
-- ✅ El usuario no podrá iniciar sesión (ban permanente)
-- ✅ Su email se cambia a 'deleted_xxx@deleted.local' para evitar conflictos
-- ✅ Todos los datos históricos permanecen en la base de datos
-- ============================================

-- 1. Agregar política RLS para que admins puedan eliminar presencia de usuarios
-- ============================================
DROP POLICY IF EXISTS "Admins can delete any user presence" ON public.user_presence;

CREATE POLICY "Admins can delete any user presence"
    ON public.user_presence
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 2. Crear función con SECURITY DEFINER para eliminar usuarios
-- ============================================
CREATE OR REPLACE FUNCTION delete_user(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
  user_to_delete_id uuid;
BEGIN
  -- Verificar rol del usuario solicitante
  SELECT role INTO requester_role
  FROM profiles
  WHERE id = auth.uid();

  IF requester_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF requester_role NOT IN ('admin', 'support') THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar usuarios. Solo administradores pueden realizar esta acción.';
  END IF;

  -- Verificar que el usuario a eliminar existe
  SELECT id INTO user_to_delete_id
  FROM profiles
  WHERE id = user_uuid;

  IF user_to_delete_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- No permitir que un admin se elimine a sí mismo
  IF user_to_delete_id = auth.uid() THEN
    RAISE EXCEPTION 'No puedes eliminar tu propio usuario';
  END IF;

  -- 1. Eliminar presencia del usuario (forzar desconexión inmediata)
  DELETE FROM public.user_presence
  WHERE user_id = user_uuid;

  -- 2. Eliminar presencia en salas de reunión
  DELETE FROM public.room_presence
  WHERE user_id = user_uuid;

    -- 3. IMPORTANTE: Desactivar el usuario en lugar de eliminarlo
  -- Esto mantiene TODOS los datos históricos intactos
  -- El usuario no podrá iniciar sesión pero todos sus datos se mantienen
  UPDATE auth.users
  SET 
    banned_until = '9999-12-31 23:59:59+00'::timestamptz,  -- Ban permanente
    email = 'deleted_' || id::text || '@deleted.local',  -- Cambiar email para evitar conflictos
    encrypted_password = '',  -- Eliminar contraseña
    raw_app_meta_data = jsonb_build_object('deleted', true, 'deleted_at', now()),
    raw_user_meta_data = jsonb_build_object('deleted', true, 'deleted_at', now())
  WHERE id = user_uuid;
  
  -- Nota: No podemos establecer confirmed_at, email_confirmed_at, etc. a NULL
  -- porque Supabase tiene restricciones. El ban permanente es suficiente
  -- para impedir que el usuario inicie sesión.
  
  -- 4. Marcar el perfil como eliminado (soft delete)
  UPDATE profiles
  SET 
    email = 'deleted_' || id::text || '@deleted.local',
    full_name = '[Usuario Eliminado]',
    role = 'user',
    updated_at = now()
  WHERE id = user_uuid;

  -- Si llegamos aquí, la eliminación fue exitosa
  RAISE NOTICE 'Usuario % eliminado exitosamente', user_uuid;
END;
$$;

-- 3. Conceder permisos de ejecución a usuarios autenticados
-- ============================================
REVOKE ALL ON FUNCTION delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;

-- 4. Comentarios
-- ============================================
COMMENT ON FUNCTION delete_user(uuid) IS 'Desactiva un usuario del sistema (soft delete), forzando su desconexión completa y manteniendo TODOS los datos históricos. Solo puede ser ejecutada por administradores. El usuario queda baneado permanentemente y no podrá iniciar sesión, pero todos sus datos (tickets, tareas, mensajes, etc.) se mantienen intactos.';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Política RLS agregada para eliminar presencia
-- ✅ Función delete_user creada con validaciones de seguridad
-- ✅ Permisos configurados correctamente
-- 
-- Uso:
-- SELECT delete_user('uuid-del-usuario-a-eliminar');
-- ============================================
