-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: tenants (Empresas/Organizaciones)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table: profiles (Perfiles de usuario vinculados a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table: paystubs (Metadatos de recibos de sueldo)
CREATE TABLE IF NOT EXISTS public.paystubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    period DATE NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table: billing_log (Registro de facturación)
CREATE TABLE IF NOT EXISTS public.billing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    paystub_id UUID NOT NULL REFERENCES public.paystubs(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 1000.00,
    period DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')) DEFAULT 'pending',
    mercadopago_payment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paystubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_log ENABLE ROW LEVEL SECURITY;

-- Function: Get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies: tenants
-- Los usuarios solo pueden ver su propio tenant
CREATE POLICY "Users can view their own tenant"
    ON public.tenants
    FOR SELECT
    USING (
        id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- RLS Policies: profiles
-- Los usuarios pueden ver su propio perfil y empleados de su tenant (si son admin)
CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Admins can view employees in their tenant"
    ON public.profiles
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id()
        AND (public.get_user_role() = 'admin' OR id = auth.uid())
    );

-- Los admins pueden insertar nuevos perfiles de empleados
CREATE POLICY "Admins can insert employee profiles"
    ON public.profiles
    FOR INSERT
    WITH CHECK (
        public.get_user_role() = 'admin'
        AND tenant_id = public.get_user_tenant_id()
        AND role = 'employee'
    );

-- RLS Policies: paystubs
-- Los empleados pueden ver solo sus propios recibos
CREATE POLICY "Employees can view their own paystubs"
    ON public.paystubs
    FOR SELECT
    USING (
        employee_id = auth.uid()
        OR (
            tenant_id = public.get_user_tenant_id()
            AND public.get_user_role() = 'admin'
        )
    );

-- Los empleados pueden insertar sus propios recibos
CREATE POLICY "Employees can insert their own paystubs"
    ON public.paystubs
    FOR INSERT
    WITH CHECK (
        employee_id = auth.uid()
        AND tenant_id = public.get_user_tenant_id()
    );

-- Los empleados pueden descargar sus propios recibos (esto se maneja en Storage policies)
-- Los admins pueden ver todos los recibos de su tenant (ya cubierto en SELECT)

-- RLS Policies: billing_log
-- Solo los admins pueden ver la facturación de su tenant
CREATE POLICY "Admins can view billing for their tenant"
    ON public.billing_log
    FOR SELECT
    USING (
        tenant_id = public.get_user_tenant_id()
        AND public.get_user_role() = 'admin'
    );

-- Permitir inserción automática cuando se crea un paystub (se hace con Service Role)
-- Los webhooks de Mercado Pago actualizarán el status usando Service Role

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_paystubs_tenant_id ON public.paystubs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_paystubs_employee_id ON public.paystubs(employee_id);
CREATE INDEX IF NOT EXISTS idx_paystubs_period ON public.paystubs(period);
CREATE INDEX IF NOT EXISTS idx_billing_log_tenant_id ON public.billing_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_log_period ON public.billing_log(period);
CREATE INDEX IF NOT EXISTS idx_billing_log_status ON public.billing_log(status);

-- Function: Auto-create billing_log when paystub is inserted
-- Esta función será llamada desde el Server Action con Service Role
-- Para mantener la lógica, la incluimos aquí como referencia
-- La implementación real estará en el Server Action uploadPaystub

COMMENT ON TABLE public.tenants IS 'Empresas/Organizaciones que usan la plataforma';
COMMENT ON TABLE public.profiles IS 'Perfiles de usuario con roles (admin/employee)';
COMMENT ON TABLE public.paystubs IS 'Metadatos de recibos de sueldo subidos por empleados';
COMMENT ON TABLE public.billing_log IS 'Registro de facturación por recibo cargado ($1.000 ARS por unidad)';
