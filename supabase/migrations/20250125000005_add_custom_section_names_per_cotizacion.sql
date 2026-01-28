-- ==================================================================
-- MIGRACIÓN: Agregar nombres personalizados de secciones por cotización
-- ==================================================================
-- Fecha: 2025-01-25
-- Descripción: Crea una tabla para almacenar nombres personalizados de secciones
--              por cotización, permitiendo que cada cotización tenga sus propios
--              nombres de secciones sin afectar a otras cotizaciones.
-- ==================================================================

-- Crear tabla para nombres personalizados de secciones por cotización
CREATE TABLE IF NOT EXISTS cotizador_secciones_cotizacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  seccion_id uuid NOT NULL REFERENCES cotizador_secciones(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  custom_name text,
  custom_subtotal_label text,
  custom_markup_label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cotizacion_id, seccion_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cotizador_secciones_cotizacion_cotizacion ON cotizador_secciones_cotizacion(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_secciones_cotizacion_seccion ON cotizador_secciones_cotizacion(seccion_id);
CREATE INDEX IF NOT EXISTS idx_cotizador_secciones_cotizacion_tenant ON cotizador_secciones_cotizacion(tenant_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS cotizador_secciones_cotizacion_updated_at ON cotizador_secciones_cotizacion;
CREATE TRIGGER cotizador_secciones_cotizacion_updated_at
  BEFORE UPDATE ON cotizador_secciones_cotizacion
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE cotizador_secciones_cotizacion ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view cotizador_secciones_cotizacion from their tenant"
  ON cotizador_secciones_cotizacion FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert cotizador_secciones_cotizacion for their tenant"
  ON cotizador_secciones_cotizacion FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update cotizador_secciones_cotizacion from their tenant"
  ON cotizador_secciones_cotizacion FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete cotizador_secciones_cotizacion from their tenant"
  ON cotizador_secciones_cotizacion FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

COMMENT ON TABLE cotizador_secciones_cotizacion IS 'Almacena nombres personalizados de secciones por cotización';
COMMENT ON COLUMN cotizador_secciones_cotizacion.custom_name IS 'Nombre personalizado de la sección para esta cotización específica';
COMMENT ON COLUMN cotizador_secciones_cotizacion.custom_subtotal_label IS 'Etiqueta personalizada para la fila de subtotal de esta sección en esta cotización';
COMMENT ON COLUMN cotizador_secciones_cotizacion.custom_markup_label IS 'Etiqueta personalizada para la fila de markup de esta sección en esta cotización';
