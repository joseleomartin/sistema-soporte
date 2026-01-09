-- ============================================
-- Tabla para almacenar clientes de vencimientos
-- ============================================
-- Almacena información básica de clientes para enviar vencimientos por email
-- ============================================

CREATE TABLE IF NOT EXISTS vencimientos_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  cuil text NOT NULL,
  email text NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_cuil_per_user UNIQUE (cuil, user_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_vencimientos_clientes_user_id ON vencimientos_clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_clientes_cuil ON vencimientos_clientes(cuil);
CREATE INDEX IF NOT EXISTS idx_vencimientos_clientes_email ON vencimientos_clientes(email);

-- Habilitar RLS
ALTER TABLE vencimientos_clientes ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propios clientes
CREATE POLICY "Users can view own clients"
  ON vencimientos_clientes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política: Los usuarios pueden crear sus propios clientes
CREATE POLICY "Users can create own clients"
  ON vencimientos_clientes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Política: Los usuarios pueden actualizar sus propios clientes
CREATE POLICY "Users can update own clients"
  ON vencimientos_clientes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Política: Los usuarios pueden eliminar sus propios clientes
CREATE POLICY "Users can delete own clients"
  ON vencimientos_clientes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_vencimientos_clientes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_vencimientos_clientes_updated_at
  BEFORE UPDATE ON vencimientos_clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_vencimientos_clientes_updated_at();


















