-- ============================================
-- MIGRACIÓN: Corregir políticas RLS para client_drive_mapping
-- ============================================
-- Descripción: Separar políticas por operación (INSERT, UPDATE, DELETE) para evitar errores RLS
-- ============================================

-- Eliminar política existente que usa FOR ALL
DROP POLICY IF EXISTS "Admins and support can manage drive mappings" ON client_drive_mapping;

-- Política para INSERT: Solo admins/support pueden crear mapeos
CREATE POLICY "Admins and support can insert drive mappings"
  ON client_drive_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Política para UPDATE: Solo admins/support pueden actualizar mapeos
CREATE POLICY "Admins and support can update drive mappings"
  ON client_drive_mapping
  FOR UPDATE
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

-- Política para DELETE: Solo admins/support pueden eliminar mapeos
CREATE POLICY "Admins and support can delete drive mappings"
  ON client_drive_mapping
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

