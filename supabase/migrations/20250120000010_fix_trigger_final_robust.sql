-- ============================================
-- Fix FINAL y ROBUSTO del trigger handle_new_user
-- ============================================
-- Esta versión maneja todos los casos posibles y es más robusta

-- Eliminar trigger anterior
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear función robusta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_tenant_id uuid;
  new_tenant_id uuid;
  tenant_id_str text;
  v_email text;
  v_full_name text;
  v_role text;
BEGIN
  -- Obtener valores básicos
  v_email := COALESCE(NEW.email, '');
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(v_email, '@', 1),
    'Usuario'
  );
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user')::text;
  
  -- Obtener tenant_id de metadata de forma segura
  tenant_id_str := NEW.raw_user_meta_data->>'tenant_id';
  
  -- Intentar usar tenant_id de metadata si existe y es válido
  new_tenant_id := NULL;
  
  IF tenant_id_str IS NOT NULL 
     AND tenant_id_str != '' 
     AND tenant_id_str != 'null' 
     AND tenant_id_str != 'undefined' 
     AND length(trim(tenant_id_str)) >= 36 THEN
    BEGIN
      -- Intentar convertir a UUID
      new_tenant_id := trim(tenant_id_str)::uuid;
      
      -- Verificar que el tenant existe
      IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = new_tenant_id) THEN
        -- Tenant no existe, usar el por defecto
        new_tenant_id := NULL;
      END IF;
    EXCEPTION 
      WHEN invalid_text_representation THEN
        -- No es un UUID válido, usar el por defecto
        new_tenant_id := NULL;
      WHEN OTHERS THEN
        -- Cualquier otro error, usar el por defecto
        new_tenant_id := NULL;
    END;
  END IF;
  
  -- Si no hay tenant_id válido, usar el por defecto
  IF new_tenant_id IS NULL THEN
    -- Obtener tenant por defecto
    SELECT id INTO default_tenant_id 
    FROM tenants 
    WHERE slug = 'emagroup' 
    LIMIT 1;
    
    -- Si no existe, intentar crearlo
    IF default_tenant_id IS NULL THEN
      BEGIN
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
      EXCEPTION WHEN OTHERS THEN
        -- Si falla, intentar leerlo de nuevo
        SELECT id INTO default_tenant_id 
        FROM tenants 
        WHERE slug = 'emagroup' 
        LIMIT 1;
      END;
    END IF;
    
    -- Si aún no existe, lanzar error
    IF default_tenant_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró el tenant por defecto (emagroup). Por favor, contacta al administrador.';
    END IF;
    
    new_tenant_id := default_tenant_id;
  END IF;
  
  -- Validar que tenemos un tenant_id válido
  IF new_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar tenant_id para usuario %. tenant_id_str: %', 
      NEW.id, COALESCE(tenant_id_str, 'NULL');
  END IF;
  
  -- Insertar el perfil
  -- NOTA: SECURITY DEFINER bypassea RLS automáticamente
  BEGIN
    INSERT INTO profiles (id, email, full_name, role, tenant_id)
    VALUES (
      NEW.id,
      v_email,
      v_full_name,
      v_role,
      new_tenant_id
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(EXCLUDED.email, profiles.email),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      role = COALESCE(EXCLUDED.role, profiles.role),
      tenant_id = COALESCE(EXCLUDED.tenant_id, profiles.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    -- Re-lanzar con contexto completo
    RAISE EXCEPTION 'Error al insertar perfil para usuario % (email: %): %. tenant_id usado: %. Detalle: %', 
      NEW.id,
      v_email,
      SQLERRM,
      new_tenant_id,
      SQLSTATE;
  END;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Re-lanzar con contexto completo
  RAISE EXCEPTION 'Error en handle_new_user para usuario % (email: %): %. tenant_id_str: %. SQLSTATE: %', 
    NEW.id,
    COALESCE(NEW.email, 'NULL'),
    SQLERRM,
    COALESCE(tenant_id_str, 'NULL'),
    SQLSTATE;
END;
$$;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentario
COMMENT ON FUNCTION public.handle_new_user IS 
'Trigger que crea automáticamente un perfil cuando se crea un nuevo usuario.
Maneja tenant_id desde metadata o asigna el tenant por defecto (emagroup).
Versión final robusta con manejo completo de errores.';



