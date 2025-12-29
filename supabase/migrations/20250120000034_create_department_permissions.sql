-- ============================================
-- MIGRACIÓN: Sistema de Permisos por Área
-- ============================================
-- Descripción: Permite configurar qué módulos pueden ver y qué acciones pueden realizar
--              los usuarios según su área (department)
-- ============================================

-- 1. TABLA DE PERMISOS POR ÁREA
CREATE TABLE IF NOT EXISTS department_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Módulo/Vista
  module_view text NOT NULL, -- Ej: 'fabinsa-production', 'fabinsa-stock', 'tickets', etc.
  
  -- Permisos de visualización y acciones
  can_view boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Un área solo puede tener un permiso por módulo
  UNIQUE(department_id, module_view, tenant_id)
);

-- 2. ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_department_permissions_department ON department_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_department_permissions_tenant ON department_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_department_permissions_module ON department_permissions(module_view);

-- 3. HABILITAR RLS
ALTER TABLE department_permissions ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS
-- Los usuarios pueden ver los permisos de su tenant
CREATE POLICY "Users can view department permissions from own tenant"
  ON department_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tenant_id = department_permissions.tenant_id
    )
  );

-- Solo admins pueden crear/actualizar permisos
CREATE POLICY "Only admins can manage department permissions"
  ON department_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = department_permissions.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = department_permissions.tenant_id
    )
  );

-- 5. TRIGGER PARA ACTUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_department_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_department_permissions_updated_at
  BEFORE UPDATE ON department_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_department_permissions_updated_at();

-- 6. COMENTARIOS
COMMENT ON TABLE department_permissions IS 'Permisos de módulos y acciones por área (department)';
COMMENT ON COLUMN department_permissions.module_view IS 'Identificador del módulo/vista (ej: fabinsa-production, tickets, etc.)';
COMMENT ON COLUMN department_permissions.can_view IS 'Permite ver el módulo';
COMMENT ON COLUMN department_permissions.can_create IS 'Permite crear nuevos registros';
COMMENT ON COLUMN department_permissions.can_edit IS 'Permite editar registros existentes';
COMMENT ON COLUMN department_permissions.can_delete IS 'Permite eliminar registros';

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================

