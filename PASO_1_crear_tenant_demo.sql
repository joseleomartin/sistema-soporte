-- ============================================
-- PASO 1: Crear el tenant (empresa) "demo"
-- ============================================
-- Ejecuta SOLO este archivo primero

DO $$
DECLARE
  demo_tenant_id uuid;
  existing_tenant_id uuid;
BEGIN
  SELECT id INTO existing_tenant_id
  FROM tenants
  WHERE slug = 'demo'
  LIMIT 1;

  IF existing_tenant_id IS NULL THEN
    SELECT create_tenant_for_registration(
      tenant_name := 'Demo Company',
      tenant_slug := 'demo',
      tenant_settings := '{}'::jsonb
    ) INTO demo_tenant_id;
    
    RAISE NOTICE '✅ Tenant Demo Company creado con ID: %', demo_tenant_id;
  ELSE
    demo_tenant_id := existing_tenant_id;
    RAISE NOTICE 'ℹ️  Tenant Demo Company ya existe con ID: %', demo_tenant_id;
  END IF;
END $$;

