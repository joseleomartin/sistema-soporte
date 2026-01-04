-- ============================================
-- Fix FINAL: Versión simplificada y robusta del trigger
-- ============================================
-- Esta versión es más simple y maneja todos los casos de error

-- Primero, asegurémonos de que el trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear función simplificada pero robusta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_tenant_id uuid;
  new_tenant_id uuid;
  tenant_id_str text;
BEGIN
  -- Obtener tenant_id de metadata de forma segura
  tenant_id_str := NEW.raw_user_meta_data->>'tenant_id';
  
  -- Intentar usar tenant_id de metadata si existe y es válido
  IF tenant_id_str IS NOT NULL 
     AND tenant_id_str != '' 
     AND tenant_id_str != 'null' 
     AND tenant_id_str != 'undefined' 
     AND length(tenant_id_str) = 36 THEN
    BEGIN
      new_tenant_id := tenant_id_str::uuid;
      
      -- Verificar que el tenant existe
      IF EXISTS (SELECT 1 FROM tenants WHERE id = new_tenant_id) THEN
        -- Usar el tenant_id de metadata
        NULL; -- Continuar con new_tenant_id
      ELSE
        -- Tenant no existe, usar el por defecto
        new_tenant_id := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla la conversión, usar el por defecto
      new_tenant_id := NULL;
    END;
  ELSE
    new_tenant_id := NULL;
  END IF;
  
  -- Si no hay tenant_id válido, usar el por defecto
  IF new_tenant_id IS NULL THEN
    SELECT id INTO default_tenant_id 
    FROM tenants 
    WHERE slug = 'emagroup' 
    LIMIT 1;
    
    -- Si no existe el tenant por defecto, crearlo
    IF default_tenant_id IS NULL THEN
      INSERT INTO tenants (name, slug, settings)
      VALUES ('EmaGroup', 'emagroup', '{}'::jsonb)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO default_tenant_id;
      
      -- Si aún no existe, leerlo
      IF default_tenant_id IS NULL THEN
        SELECT id INTO default_tenant_id 
        FROM tenants 
        WHERE slug = 'emagroup' 
        LIMIT 1;
      END IF;
    END IF;
    
    new_tenant_id := default_tenant_id;
  END IF;
  
  -- Validar que tenemos un tenant_id
  IF new_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar tenant_id para usuario %. Metadata tenant_id: %', 
      NEW.id, COALESCE(tenant_id_str, 'NULL');
  END IF;
  
  -- Insertar el perfil
  -- NOTA: SECURITY DEFINER bypassea RLS, pero usamos SET search_path para seguridad
  INSERT INTO profiles (id, email, full_name, role, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Usuario'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')::text,
    new_tenant_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = COALESCE(EXCLUDED.role, profiles.role),
    tenant_id = COALESCE(EXCLUDED.tenant_id, profiles.tenant_id);
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Re-lanzar con contexto completo
  RAISE EXCEPTION 'Error en handle_new_user para usuario % (email: %): %. tenant_id_str: %', 
    NEW.id, 
    COALESCE(NEW.email, 'NULL'),
    SQLERRM,
    COALESCE(tenant_id_str, 'NULL');
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentario
COMMENT ON FUNCTION public.handle_new_user IS 
'Trigger que crea automáticamente un perfil cuando se crea un nuevo usuario.
Maneja tenant_id desde metadata o asigna el tenant por defecto (emagroup).
Versión simplificada y robusta.';



