-- ============================================
-- Función para confirmar email manualmente
-- ============================================
-- Esta función permite confirmar el email de un usuario sin necesidad del email
-- Útil cuando el servicio de email de Supabase no funciona o hay problemas

CREATE OR REPLACE FUNCTION confirm_user_email_manually(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  user_record record;
BEGIN
  -- Buscar el usuario por email
  SELECT * INTO user_record
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;

  IF user_record IS NULL THEN
    RAISE EXCEPTION 'Usuario con email % no encontrado', user_email;
  END IF;

  -- Actualizar el campo email_confirmed_at
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
  WHERE id = user_record.id;

  RAISE NOTICE '✅ Email confirmado manualmente para usuario: % (ID: %)', user_email, user_record.id;
END;
$$;

-- Comentario
COMMENT ON FUNCTION confirm_user_email_manually IS 
'Función para confirmar el email de un usuario manualmente sin necesidad del email.
Usa SECURITY DEFINER para bypassear RLS. Útil cuando hay problemas con el servicio de email.';

-- Función para confirmar todos los usuarios de un tenant
CREATE OR REPLACE FUNCTION confirm_all_emails_for_tenant(tenant_slug text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  confirmed_count integer := 0;
  user_record record;
BEGIN
  -- Confirmar emails de todos los usuarios del tenant
  FOR user_record IN
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    JOIN profiles p ON p.id = u.id
    JOIN tenants t ON p.tenant_id = t.id
    WHERE t.slug = tenant_slug
      AND u.email_confirmed_at IS NULL
  LOOP
    UPDATE auth.users
    SET 
      email_confirmed_at = NOW(),
      updated_at = NOW()
    WHERE id = user_record.id;
    
    confirmed_count := confirmed_count + 1;
    RAISE NOTICE '✅ Email confirmado para: %', user_record.email;
  END LOOP;

  RETURN confirmed_count;
END;
$$;

-- Comentario
COMMENT ON FUNCTION confirm_all_emails_for_tenant IS 
'Función para confirmar los emails de todos los usuarios de un tenant.
Retorna el número de usuarios confirmados.';



