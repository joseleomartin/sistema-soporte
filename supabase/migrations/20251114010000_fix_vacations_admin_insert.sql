-- ============================================
-- Fix: Permitir a administradores insertar vacaciones
-- ============================================
-- Agregar política RLS para que admins puedan asignar vacaciones directamente
-- ============================================

-- Política: Admin y support pueden crear vacaciones para cualquier usuario
CREATE POLICY "Admins can create vacations for users"
  ON vacations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );















