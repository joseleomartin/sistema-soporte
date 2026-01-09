/*
  # Crear tabla de eventos de calendario

  1. Nueva Tabla
    - `calendar_events` - Eventos del calendario
      - `id` (uuid, primary key)
      - `title` (text) - Título del evento
      - `description` (text, nullable) - Descripción del evento
      - `start_date` (timestamptz) - Fecha y hora de inicio
      - `end_date` (timestamptz, nullable) - Fecha y hora de fin
      - `all_day` (boolean) - Si es evento de todo el día
      - `color` (text) - Color del evento (hex)
      - `created_by` (uuid, foreign key) - Quién creó el evento
      - `assigned_to` (uuid, foreign key, nullable) - A quién está asignado (null = evento personal)
      - `event_type` (text) - Tipo: 'personal', 'assigned', 'meeting'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
  2. Security
    - Enable RLS
    - Usuarios pueden ver sus eventos personales y eventos asignados a ellos
    - Admin y support pueden ver y crear eventos para cualquier usuario
    - Usuarios solo pueden editar/eliminar sus propios eventos personales
    - Admin y support pueden editar/eliminar cualquier evento
*/

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  all_day boolean DEFAULT false,
  color text DEFAULT '#3B82F6',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'personal' CHECK (event_type IN ('personal', 'assigned', 'meeting')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to ON calendar_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios pueden ver sus eventos personales
CREATE POLICY "Users can view own personal events"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() AND assigned_to IS NULL
  );

-- Policy: Usuarios pueden ver eventos asignados a ellos
CREATE POLICY "Users can view events assigned to them"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
  );

-- Policy: Admin y support pueden ver todos los eventos
CREATE POLICY "Admin and support can view all events"
  ON calendar_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Policy: Usuarios pueden crear eventos personales
CREATE POLICY "Users can create personal events"
  ON calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND assigned_to IS NULL
  );

-- Policy: Admin y support pueden crear eventos para cualquier usuario
CREATE POLICY "Admin and support can create events for users"
  ON calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Policy: Usuarios pueden actualizar sus propios eventos personales
CREATE POLICY "Users can update own personal events"
  ON calendar_events
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() AND assigned_to IS NULL
  )
  WITH CHECK (
    created_by = auth.uid() AND assigned_to IS NULL
  );

-- Policy: Admin y support pueden actualizar cualquier evento
CREATE POLICY "Admin and support can update all events"
  ON calendar_events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Policy: Usuarios pueden eliminar sus propios eventos personales
CREATE POLICY "Users can delete own personal events"
  ON calendar_events
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() AND assigned_to IS NULL
  );

-- Policy: Admin y support pueden eliminar cualquier evento
CREATE POLICY "Admin and support can delete all events"
  ON calendar_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();































