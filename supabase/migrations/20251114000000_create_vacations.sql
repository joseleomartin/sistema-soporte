-- ============================================
-- Sistema de Vacaciones
-- ============================================
-- Tabla para gestionar las vacaciones de los usuarios
-- ============================================

CREATE TABLE IF NOT EXISTS vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_vacations_user_id ON vacations(user_id);
CREATE INDEX IF NOT EXISTS idx_vacations_start_date ON vacations(start_date);
CREATE INDEX IF NOT EXISTS idx_vacations_end_date ON vacations(end_date);
CREATE INDEX IF NOT EXISTS idx_vacations_status ON vacations(status);

-- Habilitar RLS
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propias vacaciones
CREATE POLICY "Users can view own vacations"
  ON vacations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política: Los usuarios pueden crear sus propias vacaciones
CREATE POLICY "Users can create own vacations"
  ON vacations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Política: Los usuarios pueden editar sus propias vacaciones pendientes
CREATE POLICY "Users can update own pending vacations"
  ON vacations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

-- Política: Los usuarios pueden eliminar sus propias vacaciones pendientes
CREATE POLICY "Users can delete own pending vacations"
  ON vacations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

-- Política: Admin y support pueden ver todas las vacaciones
CREATE POLICY "Admins can view all vacations"
  ON vacations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Política: Admin y support pueden aprobar/rechazar vacaciones
CREATE POLICY "Admins can approve vacations"
  ON vacations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Política: Admin y support pueden eliminar cualquier vacación
CREATE POLICY "Admins can delete any vacation"
  ON vacations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Función para calcular días de vacaciones automáticamente
CREATE OR REPLACE FUNCTION calculate_vacation_days()
RETURNS TRIGGER AS $$
BEGIN
  NEW.days_count := (NEW.end_date - NEW.start_date) + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular días automáticamente
CREATE TRIGGER calculate_vacation_days_trigger
  BEFORE INSERT OR UPDATE ON vacations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_vacation_days();







