-- ============================================
-- Agregar soporte para secciones personalizadas en EERR
-- ============================================

-- 1. TABLA DE SECCIONES PERSONALIZADAS
CREATE TABLE IF NOT EXISTS eerr_custom_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  section_type text NOT NULL CHECK (section_type IN (
    'income',      -- Sección de ingresos (antes de COGS)
    'expense',     -- Sección de gastos (después de COGS, antes de márgenes calculados)
    'other'        -- Otras secciones personalizadas
  )),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- 2. Modificar tabla eerr_items para permitir secciones personalizadas
-- Eliminar el CHECK constraint existente para permitir secciones personalizadas
ALTER TABLE eerr_items DROP CONSTRAINT IF EXISTS eerr_items_section_check;

-- Agregar columna para referenciar secciones personalizadas
ALTER TABLE eerr_items ADD COLUMN IF NOT EXISTS custom_section_id uuid REFERENCES eerr_custom_sections(id) ON DELETE CASCADE;

-- Ahora permitimos cualquier texto en section (secciones predefinidas o personalizadas)
-- Las secciones personalizadas se identificarán por tener custom_section_id no nulo

-- Índices
CREATE INDEX IF NOT EXISTS idx_eerr_custom_sections_tenant ON eerr_custom_sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eerr_custom_sections_order ON eerr_custom_sections(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_eerr_items_custom_section ON eerr_items(custom_section_id);

-- Triggers para updated_at
DROP TRIGGER IF EXISTS eerr_custom_sections_updated_at ON eerr_custom_sections;
CREATE TRIGGER eerr_custom_sections_updated_at
  BEFORE UPDATE ON eerr_custom_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE eerr_custom_sections ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para eerr_custom_sections
DROP POLICY IF EXISTS "Users can view eerr_custom_sections from their tenant" ON eerr_custom_sections;
CREATE POLICY "Users can view eerr_custom_sections from their tenant"
  ON eerr_custom_sections FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert eerr_custom_sections for their tenant" ON eerr_custom_sections;
CREATE POLICY "Users can insert eerr_custom_sections for their tenant"
  ON eerr_custom_sections FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update eerr_custom_sections from their tenant" ON eerr_custom_sections;
CREATE POLICY "Users can update eerr_custom_sections from their tenant"
  ON eerr_custom_sections FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete eerr_custom_sections from their tenant" ON eerr_custom_sections;
CREATE POLICY "Users can delete eerr_custom_sections from their tenant"
  ON eerr_custom_sections FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));
