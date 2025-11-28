-- ============================================
-- Sistema de Carga de Horas
-- ============================================
-- Tabla para registrar las horas trabajadas por los usuarios en cada cliente
-- ============================================

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES subforums(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  hours_worked decimal(4,2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  description text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_client_date UNIQUE(user_id, client_id, entry_date)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date ON time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_department_id ON time_entries(department_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, entry_date);

-- Habilitar RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propias horas
CREATE POLICY "Users can view own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política: Los usuarios pueden crear sus propias horas
CREATE POLICY "Users can create own time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Política: Los usuarios pueden editar sus propias horas del día actual o anteriores
CREATE POLICY "Users can update own time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Política: Los usuarios pueden eliminar sus propias horas
CREATE POLICY "Users can delete own time entries"
  ON time_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Política: Admin y support pueden ver todas las horas
CREATE POLICY "Admins can view all time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Política: Admin y support pueden crear horas para cualquier usuario
CREATE POLICY "Admins can create time entries for users"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Política: Admin y support pueden actualizar cualquier hora
CREATE POLICY "Admins can update any time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Política: Admin y support pueden eliminar cualquier hora
CREATE POLICY "Admins can delete any time entries"
  ON time_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
CREATE TRIGGER update_time_entries_updated_at_trigger
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_time_entries_updated_at();

