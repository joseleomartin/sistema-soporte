-- ============================================
-- Sistema de Suscripciones por Empresa
-- ============================================
-- Implementa suscripciones con prueba gratuita de 7 días
-- Límite de 10 usuarios durante la prueba
-- Suscripción mensual basada en cantidad de usuarios después de la prueba
-- ============================================

-- 0. FUNCIÓN HELPER PARA updated_at (si no existe)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. TABLA DE SUSCRIPCIONES
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
  plan_type text DEFAULT 'trial' CHECK (plan_type IN ('trial', 'basic', 'premium', 'enterprise')),
  
  -- Período de prueba gratuita
  trial_start_date timestamptz DEFAULT now(),
  trial_end_date timestamptz,
  
  -- Período de suscripción pagada
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  
  -- Límites y precios
  max_users integer NOT NULL DEFAULT 10,
  current_users_count integer DEFAULT 0,
  price_per_month numeric(10, 2) DEFAULT 0,
  
  -- Información de pago (para integración futura)
  payment_method text,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  last_payment_date timestamptz,
  next_payment_date timestamptz,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end_date ON subscriptions(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_end_date ON subscriptions(subscription_end_date);

-- 2. HABILITAR ROW LEVEL SECURITY
-- ============================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para suscripciones
DROP POLICY IF EXISTS "Users can view subscription from own tenant" ON subscriptions;
CREATE POLICY "Users can view subscription from own tenant"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Admins can update subscription from own tenant" ON subscriptions;
CREATE POLICY "Admins can update subscription from own tenant"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = subscriptions.tenant_id
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = subscriptions.tenant_id
    )
  );

-- 3. FUNCIÓN PARA INICIALIZAR PRUEBA GRATUITA
-- ============================================
CREATE OR REPLACE FUNCTION initialize_trial_subscription(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id uuid;
  v_trial_end_date timestamptz;
BEGIN
  -- Calcular fecha de fin de prueba (7 días desde ahora)
  v_trial_end_date := now() + INTERVAL '7 days';
  
  -- Crear suscripción con prueba gratuita
  INSERT INTO subscriptions (
    tenant_id,
    status,
    plan_type,
    trial_start_date,
    trial_end_date,
    max_users,
    current_users_count,
    price_per_month
  )
  VALUES (
    p_tenant_id,
    'trial',
    'trial',
    now(),
    v_trial_end_date,
    10, -- Límite de 10 usuarios durante la prueba
    0,  -- Iniciar con 0 usuarios (se actualizará con trigger)
    0   -- Precio 0 durante la prueba
  )
  RETURNING id INTO v_subscription_id;
  
  RETURN v_subscription_id;
END;
$$;

COMMENT ON FUNCTION initialize_trial_subscription IS 
'Inicializa una suscripción con prueba gratuita de 7 días y límite de 10 usuarios';

-- 4. FUNCIÓN PARA ACTUALIZAR CONTADOR DE USUARIOS
-- ============================================
CREATE OR REPLACE FUNCTION update_subscription_user_count(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_count integer;
BEGIN
  -- Contar usuarios activos del tenant
  SELECT COUNT(*) INTO v_user_count
  FROM profiles
  WHERE tenant_id = p_tenant_id;
  
  -- Actualizar contador en suscripción
  UPDATE subscriptions
  SET current_users_count = v_user_count,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION update_subscription_user_count IS 
'Actualiza el contador de usuarios activos en la suscripción';

-- 5. FUNCIÓN PARA VERIFICAR LÍMITES DE USUARIOS
-- ============================================
CREATE OR REPLACE FUNCTION check_user_limit(p_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_user_count integer;
  v_is_trial boolean;
  v_trial_expired boolean;
BEGIN
  -- Obtener suscripción del tenant
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
  
  -- Si no hay suscripción, permitir (para compatibilidad con tenants existentes)
  IF v_subscription IS NULL THEN
    RETURN true;
  END IF;
  
  -- Verificar si está en período de prueba
  v_is_trial := (v_subscription.status = 'trial');
  v_trial_expired := (v_is_trial AND now() > v_subscription.trial_end_date);
  
  -- Si la prueba expiró y no hay suscripción activa, rechazar
  IF v_trial_expired AND v_subscription.status != 'active' THEN
    RAISE EXCEPTION 'La prueba gratuita ha expirado. Por favor, activa una suscripción para continuar usando el sistema.';
  END IF;
  
  -- Contar usuarios actuales
  SELECT COUNT(*) INTO v_user_count
  FROM profiles
  WHERE tenant_id = p_tenant_id;
  
  -- Verificar límite
  IF v_user_count >= v_subscription.max_users THEN
    IF v_is_trial THEN
      RAISE EXCEPTION 'Has alcanzado el límite de % usuarios durante la prueba gratuita. Para agregar más usuarios, activa una suscripción.', v_subscription.max_users;
    ELSE
      RAISE EXCEPTION 'Has alcanzado el límite de % usuarios de tu plan actual. Por favor, actualiza tu suscripción para agregar más usuarios.', v_subscription.max_users;
    END IF;
  END IF;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION check_user_limit IS 
'Verifica si el tenant puede agregar más usuarios según su suscripción';

-- 6. FUNCIÓN PARA OBTENER ESTADO DE SUSCRIPCIÓN
-- ============================================
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
    'price_per_month', v_subscription.price_per_month,
    'subscription_start_date', v_subscription.subscription_start_date,
    'subscription_end_date', v_subscription.subscription_end_date,
    'payment_status', v_subscription.payment_status
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_subscription_status IS 
'Retorna el estado completo de la suscripción del tenant';

-- 7. FUNCIÓN PARA CALCULAR PRECIO SEGÚN CANTIDAD DE USUARIOS
-- ============================================
CREATE OR REPLACE FUNCTION calculate_subscription_price(p_user_count integer)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_price numeric;
BEGIN
  -- Precios por cantidad de usuarios (mensual)
  -- Puedes ajustar estos valores según tus necesidades
  IF p_user_count <= 10 THEN
    v_price := 29.99; -- Hasta 10 usuarios
  ELSIF p_user_count <= 25 THEN
    v_price := 59.99; -- Hasta 25 usuarios
  ELSIF p_user_count <= 50 THEN
    v_price := 99.99; -- Hasta 50 usuarios
  ELSIF p_user_count <= 100 THEN
    v_price := 149.99; -- Hasta 100 usuarios
  ELSE
    v_price := 199.99 + ((p_user_count - 100) * 1.50); -- Más de 100: base + $1.50 por usuario adicional
  END IF;
  
  RETURN v_price;
END;
$$;

COMMENT ON FUNCTION calculate_subscription_price IS 
'Calcula el precio mensual de la suscripción según la cantidad de usuarios';

-- 8. FUNCIÓN PARA ACTIVAR SUSCRIPCIÓN PAGADA
-- ============================================
CREATE OR REPLACE FUNCTION activate_paid_subscription(
  p_tenant_id uuid,
  p_user_count integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription subscriptions%ROWTYPE;
  v_actual_user_count integer;
  v_price numeric;
  v_subscription_end_date timestamptz;
  v_max_users integer;
  v_plan_type text;
BEGIN
  -- Obtener suscripción actual
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE tenant_id = p_tenant_id
  LIMIT 1;
  
  IF v_subscription IS NULL THEN
    RAISE EXCEPTION 'No se encontró suscripción para este tenant';
  END IF;
  
  -- Obtener cantidad real de usuarios si no se proporciona
  IF p_user_count IS NULL THEN
    SELECT COUNT(*) INTO v_actual_user_count
    FROM profiles
    WHERE tenant_id = p_tenant_id;
  ELSE
    v_actual_user_count := p_user_count;
  END IF;
  
  -- Calcular precio según cantidad de usuarios
  v_price := calculate_subscription_price(v_actual_user_count);
  
  -- Determinar el límite máximo según el plan
  -- El límite debe ser el máximo del plan correspondiente, no la cantidad actual
  -- Si tienen 10 o menos usuarios, pueden tener hasta 10 (plan básico)
  -- Si tienen más de 10, el límite aumenta según el plan
  IF v_actual_user_count <= 10 THEN
    v_max_users := 10;
    v_plan_type := 'basic';
  ELSIF v_actual_user_count <= 25 THEN
    v_max_users := 25;
    v_plan_type := 'premium';
  ELSIF v_actual_user_count <= 50 THEN
    v_max_users := 50;
    v_plan_type := 'premium';
  ELSIF v_actual_user_count <= 100 THEN
    v_max_users := 100;
    v_plan_type := 'enterprise';
  ELSE
    -- Para más de 100, el límite es la cantidad actual + margen
    v_max_users := v_actual_user_count + 10; -- Margen de 10 usuarios adicionales
    v_plan_type := 'enterprise';
  END IF;
  
  -- Calcular fecha de fin de suscripción (1 mes desde ahora)
  v_subscription_end_date := now() + INTERVAL '1 month';
  
  -- Actualizar suscripción
  UPDATE subscriptions
  SET 
    status = 'active',
    plan_type = v_plan_type,
    subscription_start_date = now(),
    subscription_end_date = v_subscription_end_date,
    max_users = v_max_users,
    current_users_count = v_actual_user_count,
    price_per_month = v_price,
    payment_status = 'paid',
    last_payment_date = now(),
    next_payment_date = v_subscription_end_date,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;
END;
$$;

COMMENT ON FUNCTION activate_paid_subscription IS 
'Activa una suscripción pagada para el tenant';

-- 9. TRIGGER PARA ACTUALIZAR CONTADOR AL CREAR/ELIMINAR USUARIOS
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_subscription_user_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si es INSERT, actualizar contador
  IF TG_OP = 'INSERT' THEN
    PERFORM update_subscription_user_count(NEW.tenant_id);
    RETURN NEW;
  END IF;
  
  -- Si es DELETE, actualizar contador
  IF TG_OP = 'DELETE' THEN
    PERFORM update_subscription_user_count(OLD.tenant_id);
    RETURN OLD;
  END IF;
  
  -- Si es UPDATE y cambió el tenant_id, actualizar ambos
  IF TG_OP = 'UPDATE' THEN
    IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      PERFORM update_subscription_user_count(OLD.tenant_id);
      PERFORM update_subscription_user_count(NEW.tenant_id);
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Crear trigger en profiles
DROP TRIGGER IF EXISTS update_subscription_user_count_trigger ON profiles;
CREATE TRIGGER update_subscription_user_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_subscription_user_count();

-- 10. TRIGGER PARA VALIDAR LÍMITES AL CREAR USUARIOS
-- ============================================
CREATE OR REPLACE FUNCTION trigger_check_user_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar límite antes de insertar
  IF TG_OP = 'INSERT' THEN
    PERFORM check_user_limit(NEW.tenant_id);
  END IF;
  
  -- Verificar límite al actualizar tenant_id
  IF TG_OP = 'UPDATE' AND OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    PERFORM check_user_limit(NEW.tenant_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear trigger en profiles (antes de insertar)
DROP TRIGGER IF EXISTS check_user_limit_trigger ON profiles;
CREATE TRIGGER check_user_limit_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_user_limit();

-- 11. ACTUALIZAR FUNCIÓN create_tenant_for_registration
-- ============================================
CREATE OR REPLACE FUNCTION create_tenant_for_registration(
  tenant_name text,
  tenant_slug text,
  tenant_settings jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_tenant_id uuid;
  subscription_id uuid;
BEGIN
  -- Verificar que el slug sea único
  IF EXISTS (SELECT 1 FROM tenants WHERE slug = tenant_slug) THEN
    RAISE EXCEPTION 'El slug "%" ya está en uso', tenant_slug;
  END IF;
  
  -- Crear el tenant
  INSERT INTO tenants (name, slug, settings)
  VALUES (tenant_name, tenant_slug, tenant_settings)
  RETURNING id INTO new_tenant_id;
  
  -- Inicializar suscripción con prueba gratuita
  SELECT initialize_trial_subscription(new_tenant_id) INTO subscription_id;
  
  RETURN new_tenant_id;
END;
$$;

-- 12. TRIGGER PARA ACTUALIZAR updated_at EN SUBSCRIPTIONS
-- ============================================
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 13. ACTUALIZAR CONTADORES PARA TENANTS EXISTENTES
-- ============================================
-- Crear suscripciones para tenants que no tienen una
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN 
    SELECT id FROM tenants
    WHERE id NOT IN (SELECT tenant_id FROM subscriptions WHERE tenant_id IS NOT NULL)
  LOOP
    PERFORM initialize_trial_subscription(tenant_record.id);
    PERFORM update_subscription_user_count(tenant_record.id);
  END LOOP;
END $$;

-- 14. COMENTARIOS
-- ============================================
COMMENT ON TABLE subscriptions IS 'Suscripciones de empresas con prueba gratuita y planes pagos';
COMMENT ON COLUMN subscriptions.status IS 'Estado: trial (prueba), active (activa), expired (expirada), cancelled (cancelada)';
COMMENT ON COLUMN subscriptions.max_users IS 'Límite máximo de usuarios permitidos';
COMMENT ON COLUMN subscriptions.current_users_count IS 'Cantidad actual de usuarios (actualizado automáticamente)';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

