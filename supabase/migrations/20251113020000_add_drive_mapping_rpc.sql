-- ============================================
-- MIGRACIÓN: Función RPC para guardar mapeo de Drive
-- ============================================
-- Descripción: Función que permite a admins/support guardar mapeos de Drive
-- usando SECURITY DEFINER para evitar problemas con RLS
-- ============================================

-- Función para guardar/actualizar mapeo de Drive
CREATE OR REPLACE FUNCTION save_client_drive_mapping(
  p_subforum_id UUID,
  p_google_drive_folder_id TEXT,
  p_folder_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_mapping_id UUID;
BEGIN
  -- Verificar que el usuario es admin o support
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_user_role NOT IN ('admin', 'support') THEN
    RAISE EXCEPTION 'Solo administradores y soporte pueden configurar carpetas de Drive';
  END IF;
  
  -- Verificar que el subforum existe
  IF NOT EXISTS (SELECT 1 FROM subforums WHERE id = p_subforum_id) THEN
    RAISE EXCEPTION 'El subforo especificado no existe';
  END IF;
  
  -- Insertar o actualizar el mapeo
  INSERT INTO client_drive_mapping (
    subforum_id,
    google_drive_folder_id,
    folder_name
  )
  VALUES (
    p_subforum_id,
    p_google_drive_folder_id,
    p_folder_name
  )
  ON CONFLICT (subforum_id)
  DO UPDATE SET
    google_drive_folder_id = EXCLUDED.google_drive_folder_id,
    folder_name = EXCLUDED.folder_name,
    updated_at = NOW()
  RETURNING id INTO v_mapping_id;
  
  RETURN v_mapping_id;
END;
$$;

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION save_client_drive_mapping(UUID, TEXT, TEXT) TO authenticated;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

