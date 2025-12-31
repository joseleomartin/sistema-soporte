-- ============================================
-- Fix: Corregir trigger handle_new_user para registro de empresas
-- ============================================
-- Este fix asegura que el trigger pueda crear perfiles correctamente
-- cuando se registra una nueva empresa con tenant_id en metadata

-- Actualizar el trigger para manejar mejor el tenant_id en metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_tenant_id uuid;
  new_tenant_id uuid;
  tenant_id_str text;
  error_message text;
  error_detail text;
  error_hint text;
BEGIN
  -- Intentar obtener tenant_id de metadata
  tenant_id_str := NEW.raw_user_meta_data->>'tenant_id';
  
  -- Si hay tenant_id en metadata, intentar convertirlo a UUID
  IF tenant_id_str IS NOT NULL AND tenant_id_str != '' AND tenant_id_str != 'null' THEN
    BEGIN
      new_tenant_id := tenant_id_str::uuid;
      
      -- Verificar que el tenant_id existe en la tabla tenants
      IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = new_tenant_id) THEN
        -- Si el tenant no existe, usar el por defecto
        RAISE WARNING 'Tenant ID % no existe en la tabla tenants, usando tenant por defecto', tenant_id_str;
        new_tenant_id := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla la conversión, usar el tenant por defecto
      RAISE WARNING 'Error al convertir tenant_id "%" a UUID: %', tenant_id_str, SQLERRM;
      new_tenant_id := NULL;
    END;
  ELSE
    new_tenant_id := NULL;
  END IF;
  
  -- Si no hay tenant_id válido en metadata, usar el tenant por defecto (EmaGroup)
  IF new_tenant_id IS NULL THEN
    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'emagroup' LIMIT 1;
    
    -- Si no existe el tenant por defecto, intentar crearlo
    IF default_tenant_id IS NULL THEN
      BEGIN
        -- Intentar crear el tenant por defecto
        INSERT INTO tenants (name, slug, settings)
        VALUES ('EmaGroup', 'emagroup', '{}'::jsonb)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id INTO default_tenant_id;
        
        -- Si aún no existe después del INSERT, intentar leerlo de nuevo
        IF default_tenant_id IS NULL THEN
          SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'emagroup' LIMIT 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error al crear tenant por defecto: %', SQLERRM;
      END;
      
      -- Si aún no existe, lanzar error
      IF default_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró el tenant por defecto (emagroup) y no se pudo crear. Por favor, contacta al administrador.';
      END IF;
    END IF;
    
    new_tenant_id := default_tenant_id;
  END IF;
  
  -- Validar que tenemos un tenant_id válido antes de insertar
  IF new_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar el tenant_id para el usuario %. tenant_id_str: %', NEW.id, COALESCE(tenant_id_str, 'NULL');
  END IF;
  
  -- Insertar el perfil (el trigger usa SECURITY DEFINER, así que puede insertar sin RLS)
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, tenant_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Usuario'),
      COALESCE(NEW.raw_user_meta_data->>'role', 'user')::text,
      new_tenant_id
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = COALESCE(EXCLUDED.email, profiles.email),
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      role = COALESCE(EXCLUDED.role, profiles.role),
      tenant_id = COALESCE(EXCLUDED.tenant_id, profiles.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    -- Capturar información detallada del error
    GET STACKED DIAGNOSTICS 
      error_message = MESSAGE_TEXT,
      error_detail = PG_EXCEPTION_DETAIL,
      error_hint = PG_EXCEPTION_HINT;
    
    -- Re-lanzar el error con más contexto
    RAISE EXCEPTION 'Error al insertar perfil para usuario %: %. Detalle: %. Hint: %. tenant_id usado: %', 
      NEW.id, error_message, error_detail, error_hint, new_tenant_id;
  END;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log del error y re-lanzarlo con contexto
  GET STACKED DIAGNOSTICS 
    error_message = MESSAGE_TEXT,
    error_detail = PG_EXCEPTION_DETAIL,
    error_hint = PG_EXCEPTION_HINT;
  
  RAISE EXCEPTION 'Error en handle_new_user para usuario %: %. Detalle: %. Hint: %. tenant_id_str: %', 
    NEW.id, error_message, error_detail, error_hint, COALESCE(tenant_id_str, 'NULL');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario sobre el uso de la función
COMMENT ON FUNCTION public.handle_new_user IS 
'Trigger que crea automáticamente un perfil cuando se crea un nuevo usuario en auth.users. 
Maneja tenant_id desde metadata o asigna el tenant por defecto (emagroup).';


