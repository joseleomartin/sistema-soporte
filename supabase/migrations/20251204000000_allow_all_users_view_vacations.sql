-- ============================================
-- Permitir que todos los usuarios vean vacaciones aprobadas y pendientes
-- ============================================
-- Esta política permite que todos los usuarios autenticados puedan ver
-- las vacaciones aprobadas y pendientes de todos los demás usuarios
-- para poder visualizarlas en el calendario compartido
-- ============================================

-- Política: Todos los usuarios pueden ver vacaciones aprobadas y pendientes de otros usuarios
CREATE POLICY "All users can view approved and pending vacations"
  ON vacations FOR SELECT
  TO authenticated
  USING (
    status IN ('approved', 'pending')
  );

-- Nota: Esta política se combina con las políticas existentes usando OR
-- Los usuarios seguirán pudiendo ver sus propias vacaciones (incluyendo rechazadas)
-- gracias a la política "Users can view own vacations"
-- Y ahora también podrán ver las vacaciones aprobadas y pendientes de todos

