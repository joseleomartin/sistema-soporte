-- ============================================
-- MIGRACIÓN: Tabla client_drive_mapping
-- ============================================
-- Descripción: Tabla para mapear clientes (subforums) con carpetas de Google Drive
-- ============================================

-- Crear tabla client_drive_mapping
CREATE TABLE IF NOT EXISTS client_drive_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subforum_id UUID NOT NULL REFERENCES subforums(id) ON DELETE CASCADE,
  google_drive_folder_id TEXT NOT NULL,
  folder_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subforum_id)
);

-- Habilitar RLS
ALTER TABLE client_drive_mapping ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios pueden ver mapeos de clientes a los que tienen acceso
CREATE POLICY "Users can view drive mappings for accessible clients"
  ON client_drive_mapping FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subforums
      WHERE subforums.id = client_drive_mapping.subforum_id
      AND (
        EXISTS (
          SELECT 1 FROM subforum_permissions
          WHERE subforum_permissions.subforum_id = subforums.id
          AND subforum_permissions.user_id = auth.uid()
          AND subforum_permissions.can_view = true
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'support')
        )
      )
    )
  );

-- Política: Solo admins/support pueden crear/actualizar mapeos
CREATE POLICY "Admins and support can manage drive mappings"
  ON client_drive_mapping FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_client_drive_mapping_subforum
  ON client_drive_mapping(subforum_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_client_drive_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_client_drive_mapping_updated_at
  BEFORE UPDATE ON client_drive_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_client_drive_mapping_updated_at();

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

