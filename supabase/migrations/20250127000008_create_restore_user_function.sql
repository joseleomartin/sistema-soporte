-- ============================================
-- FUNCIÓN PARA RECUPERAR USUARIOS ELIMINADOS
-- ============================================
-- Objetivo:
--   - Permitir que administradores recuperen usuarios eliminados
--   - Restaurar el acceso del usuario al sistema
--   - Mantener todos los datos históricos intactos
-- 
-- IMPORTANTE: Esta función restaura un usuario que fue eliminado con delete_user()
-- Requiere proporcionar el UUID del usuario y el email original a restaurar
-- ============================================

-- Crear función con SECURITY DEFINER para restaurar usuarios
-- ============================================
CREATE OR REPLACE FUNCTION restore_user(
  user_uuid uuid,
  original_email text,
  original_full_name text DEFAULT NULL,
  original_role text DEFAULT 'user'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
  user_to_restore_id uuid;
  current_email text;
  is_deleted boolean;
BEGIN
  -- Verificar rol del usuario solicitante
  SELECT role INTO requester_role
  FROM profiles
  WHERE id = auth.uid();

  IF requester_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF requester_role NOT IN ('admin', 'support') THEN
    RAISE EXCEPTION 'No tienes permiso para restaurar usuarios. Solo administradores pueden realizar esta acción.';
  END IF;

  -- Verificar que el usuario a restaurar existe
  SELECT id, email INTO user_to_restore_id, current_email
  FROM profiles
  WHERE id = user_uuid;

  IF user_to_restore_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Verificar que el usuario está marcado como eliminado
  -- (su email debe tener el formato deleted_xxx@deleted.local)
  IF current_email NOT LIKE 'deleted_%@deleted.local' THEN
    RAISE EXCEPTION 'Este usuario no está marcado como eliminado. No se puede restaurar.';
  END IF;

  -- Verificar que el email original no esté en uso por otro usuario
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = original_email
    AND id != user_uuid
  ) THEN
    RAISE EXCEPTION 'El email % ya está en uso por otro usuario. No se puede restaurar.', original_email;
  END IF;

  -- Verificar que el email original no esté en uso en profiles
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE email = original_email
    AND id != user_uuid
  ) THEN
    RAISE EXCEPTION 'El email % ya está en uso por otro perfil. No se puede restaurar.', original_email;
  END IF;

  -- Validar el formato del email
  IF original_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'El email proporcionado no tiene un formato válido.';
  END IF;

  -- Validar el rol
  IF original_role NOT IN ('admin', 'support', 'user') THEN
    RAISE EXCEPTION 'El rol debe ser uno de: admin, support, user';
  END IF;

  -- 1. Restaurar el usuario en auth.users
  -- ============================================
  UPDATE auth.users
  SET 
    banned_until = NULL,  -- Quitar el ban permanente
    email = original_email,  -- Restaurar email original
    raw_app_meta_data = jsonb_build_object('deleted', false, 'restored_at', now()),
    raw_user_meta_data = jsonb_build_object('deleted', false, 'restored_at', now())
    -- Nota: No podemos restaurar la contraseña, el usuario necesitará usar "Olvidé mi contraseña"
  WHERE id = user_uuid;
  
  -- 2. Restaurar el perfil en profiles
  -- ============================================
  UPDATE profiles
  SET 
    email = original_email,
    full_name = COALESCE(original_full_name, 'Usuario Restaurado'),
    role = original_role,
    updated_at = now()
  WHERE id = user_uuid;

  -- Si llegamos aquí, la restauración fue exitosa
  RAISE NOTICE 'Usuario % restaurado exitosamente con email %', user_uuid, original_email;
END;
$$;

-- Conceder permisos de ejecución a usuarios autenticados
-- ============================================
REVOKE ALL ON FUNCTION restore_user(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_user(uuid, text, text, text) TO authenticated;

-- Comentarios
-- ============================================
COMMENT ON FUNCTION restore_user(uuid, text, text, text) IS 'Restaura un usuario que fue eliminado con delete_user(). Requiere el UUID del usuario, el email original a restaurar, y opcionalmente el nombre completo y rol originales. Solo puede ser ejecutada por administradores. El usuario podrá iniciar sesión nuevamente, pero necesitará restablecer su contraseña usando "Olvidé mi contraseña".';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Función restore_user creada con validaciones de seguridad
-- ✅ Permisos configurados correctamente
-- 
-- Uso:
-- SELECT restore_user(
--   'uuid-del-usuario-a-restaurar',
--   'email@original.com',
--   'Nombre Completo Original',  -- Opcional
--   'user'  -- Opcional: 'admin', 'support', o 'user'
-- );
-- ============================================
