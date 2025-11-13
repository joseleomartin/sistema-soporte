-- ============================================
-- FUNCIÓN SEGURA PARA ELIMINAR SUBFOROS
-- ============================================
-- Objetivo:
--   - Permitir que administradores y soporte eliminen subforos
--   - Garantizar que la eliminación borre mensajes, permisos y archivos asociados (ON DELETE CASCADE)
--   - Evitar problemas de RLS durante la eliminación en cascada

-- 1. Crear función con SECURITY DEFINER
CREATE OR REPLACE FUNCTION delete_subforum(subforum_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
BEGIN
  -- Verificar rol del usuario solicitante
  SELECT role INTO requester_role
  FROM profiles
  WHERE id = auth.uid();

  IF requester_role IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF requester_role NOT IN ('admin', 'support') THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar clientes';
  END IF;

  -- Eliminar el subforo (cascada eliminará mensajes y permisos)
  DELETE FROM subforums
  WHERE id = subforum_uuid;
END;
$$;

-- 2. Conceder permisos de ejecución a usuarios autenticados
REVOKE ALL ON FUNCTION delete_subforum(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_subforum(uuid) TO authenticated;




