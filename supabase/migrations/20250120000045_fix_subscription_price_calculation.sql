-- ============================================
-- Fix: Calcular price_per_month basado en cantidad actual de usuarios
-- ============================================
-- El precio debe calcularse dinámicamente según la cantidad de usuarios actuales
-- en lugar de usar el valor almacenado en la tabla (que puede ser 0 o NULL en trial)

CREATE OR REPLACE FUNCTION get_subscription_status(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_user_count integer;
  v_result jsonb;
  v_is_trial boolean;
  v_trial_expired boolean;
  v_days_remaining integer;
  v_calculated_price numeric;
BEGIN
  -- Obtener suscripción
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
  
  -- Si no hay suscripción, retornar null
  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription', false
    );
  END IF;
  
  -- Contar usuarios actuales
  SELECT COUNT(*) INTO v_user_count
  FROM profiles
  WHERE tenant_id = p_tenant_id;
  
  -- Verificar estado de prueba
  v_is_trial := (v_subscription.status = 'trial');
  v_trial_expired := (v_is_trial AND now() > v_subscription.trial_end_date);
  
  -- Calcular días restantes
  IF v_is_trial AND NOT v_trial_expired THEN
    v_days_remaining := EXTRACT(DAY FROM (v_subscription.trial_end_date - now()))::integer;
  ELSE
    v_days_remaining := 0;
  END IF;
  
  -- Calcular precio basado en cantidad actual de usuarios
  -- Si la suscripción está activa y tiene un precio almacenado, usamos ese
  -- De lo contrario, calculamos el precio basado en la cantidad actual de usuarios
  IF v_subscription.status = 'active' AND v_subscription.price_per_month > 0 THEN
    v_calculated_price := v_subscription.price_per_month;
  ELSE
    -- Calcular precio estimado basado en cantidad actual de usuarios
    v_calculated_price := calculate_subscription_price(v_user_count);
  END IF;
  
  -- Construir resultado
  v_result := jsonb_build_object(
    'has_subscription', true,
    'status', v_subscription.status,
    'plan_type', v_subscription.plan_type,
    'is_trial', v_is_trial,
    'trial_expired', v_trial_expired,
    'trial_start_date', v_subscription.trial_start_date,
    'trial_end_date', v_subscription.trial_end_date,
    'trial_days_remaining', v_days_remaining,
    'max_users', v_subscription.max_users,
    'current_users', v_user_count,
    'users_remaining', GREATEST(0, v_subscription.max_users - v_user_count),
    'price_per_month', v_calculated_price,
    'subscription_start_date', v_subscription.subscription_start_date,
    'subscription_end_date', v_subscription.subscription_end_date,
    'payment_status', v_subscription.payment_status
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_subscription_status IS 
'Retorna el estado completo de la suscripción del tenant. Calcula el precio basado en la cantidad actual de usuarios.';

