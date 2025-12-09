-- ==================================================================
-- Tabla para almacenar precios a cobrar por cliente y período
-- ==================================================================
-- Fecha: 2025-12-05
-- Descripción: Permite guardar y mantener los precios a cobrar
--              configurados para cada cliente en períodos específicos
-- ==================================================================

CREATE TABLE IF NOT EXISTS client_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES subforums(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  price_to_charge decimal(12,2) NOT NULL DEFAULT 0 CHECK (price_to_charge >= 0),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_client_period UNIQUE(client_id, start_date, end_date),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_client_prices_client_id ON client_prices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_prices_dates ON client_prices(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_client_prices_user_id ON client_prices(user_id);
CREATE INDEX IF NOT EXISTS idx_client_prices_client_dates ON client_prices(client_id, start_date, end_date);

-- Habilitar RLS
ALTER TABLE client_prices ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden ver todos los precios
CREATE POLICY "Admins can view all client prices"
  ON client_prices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden crear precios
CREATE POLICY "Admins can create client prices"
  ON client_prices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden actualizar precios
CREATE POLICY "Admins can update client prices"
  ON client_prices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden eliminar precios
CREATE POLICY "Admins can delete client prices"
  ON client_prices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_client_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_client_prices_updated_at_trigger
  BEFORE UPDATE ON client_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_client_prices_updated_at();

-- Comentarios
COMMENT ON TABLE client_prices IS 'Almacena los precios a cobrar configurados para cada cliente en períodos específicos';
COMMENT ON COLUMN client_prices.client_id IS 'ID del cliente (subforum)';
COMMENT ON COLUMN client_prices.start_date IS 'Fecha de inicio del período';
COMMENT ON COLUMN client_prices.end_date IS 'Fecha de fin del período';
COMMENT ON COLUMN client_prices.price_to_charge IS 'Precio a cobrar configurado para este cliente en este período';
COMMENT ON COLUMN client_prices.user_id IS 'Usuario que configuró el precio (generalmente admin)';

-- ==================================================================
-- FIN DE LA MIGRACIÓN
-- ==================================================================

