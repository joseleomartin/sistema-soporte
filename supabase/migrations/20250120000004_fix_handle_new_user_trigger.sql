-- ============================================
-- Fix: Mejorar trigger handle_new_user para registro de empresas
-- ============================================

-- Actualizar el trigger para manejar mejor el tenant_id en metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_tenant_id uuid;
  new_tenant_id uuid;
  tenant_id_str text;
  error_message text;
BEGIN
  -- Intentar obtener tenant_id de metadata
  tenant_id_str := NEW.raw_user_meta_data->>'tenant_id';
  
  -- Si hay tenant_id en metadata, intentar convertirlo a UUID
  IF tenant_id_str IS NOT NULL AND tenant_id_str != '' AND tenant_id_str != 'null' THEN
    BEGIN
      new_tenant_id := tenant_id_str::uuid;
      
      -- Verificar que el tenant_id existe
      IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = new_tenant_id) THEN
        -- Si el tenant no existe, usar el por defecto
        new_tenant_id := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Si falla la conversión, usar el tenant por defecto
      new_tenant_id := NULL;
    END;
  ELSE
    new_tenant_id := NULL;
  END IF;
  
  -- Si no hay tenant_id válido en metadata, usar el tenant por defecto (EmaGroup)
  IF new_tenant_id IS NULL THEN
    SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'emagroup' LIMIT 1;
    
    -- Si no existe el tenant por defecto, intentar crear uno
    IF default_tenant_id IS NULL THEN
      -- Intentar crear el tenant por defecto
      INSERT INTO tenants (name, slug, settings)
      VALUES ('EmaGroup', 'emagroup', '{}'::jsonb)
      ON CONFLICT (slug) DO NOTHING
      RETURNING id INTO default_tenant_id;
      
      -- Si aún no existe, lanzar error
      IF default_tenant_id IS NULL THEN
        SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'emagroup' LIMIT 1;
        IF default_tenant_id IS NULL THEN
          RAISE EXCEPTION 'No se encontró el tenant por defecto (emagroup) y no se pudo crear';
        END IF;
      END IF;
    END IF;
    
    new_tenant_id := default_tenant_id;
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
    error_message := SQLERRM;
    -- Re-lanzar el error con más contexto
    RAISE EXCEPTION 'Error al insertar perfil para usuario %: %', NEW.id, error_message;
  END;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log del error y re-lanzarlo con contexto
  error_message := SQLERRM;
  RAISE EXCEPTION 'Error en handle_new_user para usuario %: % (tenant_id_str: %)', 
    NEW.id, error_message, COALESCE(tenant_id_str, 'NULL');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

