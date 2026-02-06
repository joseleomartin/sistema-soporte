-- ============================================
-- Sistema de Gestión de Vencimientos
-- ============================================
-- Similar a tasks pero específico para vencimientos
-- ============================================

-- Tabla principal de vencimientos gestionados
CREATE TABLE IF NOT EXISTS vencimientos_gestion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    client_name TEXT NOT NULL,
    client_cuit TEXT,
    vencimiento_tipo TEXT NOT NULL, -- Tipo: IVA, Monotributo, etc.
    periodo TEXT NOT NULL, -- Ej: "Enero 2026"
    fecha_vencimiento DATE NOT NULL,
    fecha_vencimiento_original TEXT, -- Fecha original del Excel (ej: "20-feb")
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_created_by ON vencimientos_gestion(created_by);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_tenant_id ON vencimientos_gestion(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_status ON vencimientos_gestion(status);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_priority ON vencimientos_gestion(priority);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_fecha_vencimiento ON vencimientos_gestion(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_client_cuit ON vencimientos_gestion(client_cuit);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_vencimiento_tipo ON vencimientos_gestion(vencimiento_tipo);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_created_at ON vencimientos_gestion(created_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_vencimientos_gestion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vencimientos_gestion_updated_at_trigger ON vencimientos_gestion;
CREATE TRIGGER vencimientos_gestion_updated_at_trigger
    BEFORE UPDATE ON vencimientos_gestion
    FOR EACH ROW
    EXECUTE FUNCTION update_vencimientos_gestion_updated_at();

-- Trigger para actualizar completed_at
CREATE OR REPLACE FUNCTION update_vencimientos_gestion_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_vencimientos_gestion_completed_at ON vencimientos_gestion;
CREATE TRIGGER trigger_update_vencimientos_gestion_completed_at
  BEFORE UPDATE ON vencimientos_gestion
  FOR EACH ROW
  EXECUTE FUNCTION update_vencimientos_gestion_completed_at();

-- ============================================
-- TABLA: vencimientos_gestion_assignments
-- ============================================
CREATE TABLE IF NOT EXISTS vencimientos_gestion_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vencimiento_id UUID NOT NULL REFERENCES vencimientos_gestion(id) ON DELETE CASCADE,
    assigned_to_user UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_to_department UUID REFERENCES departments(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_vencimientos_assignment_type CHECK (
        (assigned_to_user IS NOT NULL) OR (assigned_to_department IS NOT NULL)
    ),
    UNIQUE(vencimiento_id, assigned_to_user, assigned_to_department)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_assignments_vencimiento_id ON vencimientos_gestion_assignments(vencimiento_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_assignments_assigned_to_user ON vencimientos_gestion_assignments(assigned_to_user);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_assignments_assigned_to_department ON vencimientos_gestion_assignments(assigned_to_department);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_assignments_tenant_id ON vencimientos_gestion_assignments(tenant_id);

-- ============================================
-- TABLA: vencimientos_gestion_messages
-- ============================================
CREATE TABLE IF NOT EXISTS vencimientos_gestion_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vencimiento_id UUID NOT NULL REFERENCES vencimientos_gestion(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_messages_vencimiento_id ON vencimientos_gestion_messages(vencimiento_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_messages_user_id ON vencimientos_gestion_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_messages_tenant_id ON vencimientos_gestion_messages(tenant_id);

-- ============================================
-- POLÍTICAS RLS: vencimientos_gestion
-- ============================================
ALTER TABLE vencimientos_gestion ENABLE ROW LEVEL SECURITY;

-- Ver vencimientos de su tenant
CREATE POLICY "Users can view own tenant vencimientos_gestion"
  ON vencimientos_gestion FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Crear vencimientos en su tenant
CREATE POLICY "Users can create own tenant vencimientos_gestion"
  ON vencimientos_gestion FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Actualizar vencimientos de su tenant (solo admins pueden modificar campos importantes)
CREATE POLICY "Users can update own tenant vencimientos_gestion"
  ON vencimientos_gestion FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Eliminar vencimientos de su tenant (solo admins)
CREATE POLICY "Admins can delete own tenant vencimientos_gestion"
  ON vencimientos_gestion FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- POLÍTICAS RLS: vencimientos_gestion_assignments
-- ============================================
ALTER TABLE vencimientos_gestion_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant vencimientos_gestion_assignments"
  ON vencimientos_gestion_assignments FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create own tenant vencimientos_gestion_assignments"
  ON vencimientos_gestion_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tenant vencimientos_gestion_assignments"
  ON vencimientos_gestion_assignments FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own tenant vencimientos_gestion_assignments"
  ON vencimientos_gestion_assignments FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================
-- POLÍTICAS RLS: vencimientos_gestion_messages
-- ============================================
ALTER TABLE vencimientos_gestion_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant vencimientos_gestion_messages"
  ON vencimientos_gestion_messages FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create own tenant vencimientos_gestion_messages"
  ON vencimientos_gestion_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tenant vencimientos_gestion_messages"
  ON vencimientos_gestion_messages FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can delete own tenant vencimientos_gestion_messages"
  ON vencimientos_gestion_messages FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );
