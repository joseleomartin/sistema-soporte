-- ============================================
-- Tabla para almacenar vencimientos subidos desde Excel
-- ============================================
-- Almacena vencimientos cargados manualmente por los usuarios
-- Los datos se almacenan en formato JSONB para flexibilidad
-- ============================================

CREATE TABLE IF NOT EXISTS vencimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hoja_nombre text NOT NULL,
  datos jsonb NOT NULL, -- Almacena toda la fila como JSON flexible
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_vencimientos_tenant_id ON vencimientos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_hoja_nombre ON vencimientos(hoja_nombre);
CREATE INDEX IF NOT EXISTS idx_vencimientos_datos_gin ON vencimientos USING gin(datos);
CREATE INDEX IF NOT EXISTS idx_vencimientos_created_at ON vencimientos(created_at DESC);

-- Habilitar RLS
ALTER TABLE vencimientos ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver vencimientos de su tenant
CREATE POLICY "Users can view own tenant vencimientos"
  ON vencimientos FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política: Los usuarios pueden crear vencimientos en su tenant
CREATE POLICY "Users can create own tenant vencimientos"
  ON vencimientos FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Política: Los usuarios pueden actualizar vencimientos de su tenant
CREATE POLICY "Users can update own tenant vencimientos"
  ON vencimientos FOR UPDATE
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

-- Política: Los usuarios pueden eliminar vencimientos de su tenant
CREATE POLICY "Users can delete own tenant vencimientos"
  ON vencimientos FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_vencimientos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_vencimientos_updated_at
  BEFORE UPDATE ON vencimientos
  FOR EACH ROW
  EXECUTE FUNCTION update_vencimientos_updated_at();

-- Función para limpiar vencimientos antiguos (opcional, para mantener la BD limpia)
CREATE OR REPLACE FUNCTION limpiar_vencimientos_antiguos()
RETURNS void AS $$
BEGIN
  -- Eliminar vencimientos con más de 1 año de antigüedad
  DELETE FROM vencimientos
  WHERE created_at < now() - interval '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
