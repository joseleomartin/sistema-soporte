-- ============================================
-- Corrección de límites de usuarios en suscripciones existentes
-- ============================================
-- Corrige las suscripciones que tienen max_users incorrecto
-- Establece el límite correcto según el plan y cantidad de usuarios
-- ============================================

-- 1. FUNCIÓN PARA CORREGIR LÍMITES DE USUARIOS
-- ============================================
CREATE OR REPLACE FUNCTION fix_subscription_max_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription RECORD;
  v_user_count integer;
  v_correct_max_users integer;
  v_plan_type text;
BEGIN
  -- Iterar sobre todas las suscripciones activas
  FOR v_subscription IN 
    SELECT *
    FROM subscriptions
    WHERE status = 'active'
  LOOP
    -- Contar usuarios actuales del tenant
    SELECT COUNT(*) INTO v_user_count
    FROM profiles
    WHERE tenant_id = v_subscription.tenant_id;
    
    -- Determinar el límite correcto según la cantidad de usuarios
    IF v_user_count <= 10 THEN
      v_correct_max_users := 10;
      v_plan_type := 'basic';
    ELSIF v_user_count <= 25 THEN
      v_correct_max_users := 25;
      v_plan_type := 'premium';
    ELSIF v_user_count <= 50 THEN
      v_correct_max_users := 50;
      v_plan_type := 'premium';
    ELSIF v_user_count <= 100 THEN
      v_correct_max_users := 100;
      v_plan_type := 'enterprise';
    ELSE
      v_correct_max_users := v_user_count + 10;
      v_plan_type := 'enterprise';
    END IF;
    
    -- Solo actualizar si el límite actual es incorrecto
    -- Si el plan es 'basic' y tiene menos de 10 usuarios, debe tener max_users = 10
    -- Si el plan es 'premium' y tiene menos de 25 usuarios, debe tener max_users = 25, etc.
    IF v_subscription.max_users != v_correct_max_users THEN
      UPDATE subscriptions
      SET 
        max_users = v_correct_max_users,
        plan_type = v_plan_type,
        current_users_count = v_user_count,
        updated_at = now()
      WHERE id = v_subscription.id;
      
      RAISE NOTICE 'Corregida suscripción %: max_users actualizado de % a % (plan: %)', 
        v_subscription.id, 
        v_subscription.max_users, 
        v_correct_max_users,
        v_plan_type;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION fix_subscription_max_users IS 
'Corrige los límites de usuarios en suscripciones existentes según el plan correspondiente';

-- 2. FUNCIÓN PARA CORREGIR UNA SUSCRIPCIÓN ESPECÍFICA
-- ============================================
CREATE OR REPLACE FUNCTION fix_subscription_max_users_for_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_user_count integer;
  v_correct_max_users integer;
  v_plan_type text;
BEGIN
  -- Obtener suscripción del tenant
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
  
  IF v_subscription IS NULL THEN
    RAISE EXCEPTION 'No se encontró suscripción para este tenant';
  END IF;
  
  -- Contar usuarios actuales del tenant
  SELECT COUNT(*) INTO v_user_count
  FROM profiles
  WHERE tenant_id = p_tenant_id;
  
  -- Determinar el límite correcto según la cantidad de usuarios
  IF v_user_count <= 10 THEN
    v_correct_max_users := 10;
    v_plan_type := 'basic';
  ELSIF v_user_count <= 25 THEN
    v_correct_max_users := 25;
    v_plan_type := 'premium';
  ELSIF v_user_count <= 50 THEN
    v_correct_max_users := 50;
    v_plan_type := 'premium';
  ELSIF v_user_count <= 100 THEN
    v_correct_max_users := 100;
    v_plan_type := 'enterprise';
  ELSE
    v_correct_max_users := v_user_count + 10;
    v_plan_type := 'enterprise';
  END IF;
  
  -- Actualizar suscripción
  UPDATE subscriptions
  SET 
    max_users = v_correct_max_users,
    plan_type = v_plan_type,
    current_users_count = v_user_count,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
  
  RAISE NOTICE 'Suscripción corregida: max_users actualizado de % a % (plan: %)', 
    v_subscription.max_users, 
    v_correct_max_users,
    v_plan_type;
END;
$$;

COMMENT ON FUNCTION fix_subscription_max_users_for_tenant IS 
'Corrige el límite de usuarios para una suscripción específica según el plan correspondiente';

-- 3. EJECUTAR CORRECCIÓN PARA TODAS LAS SUSCRIPCIONES
-- ============================================
-- Esto corregirá automáticamente todas las suscripciones existentes
SELECT fix_subscription_max_users();

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

