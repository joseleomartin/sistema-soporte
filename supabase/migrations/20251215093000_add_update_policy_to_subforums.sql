-- ============================================
-- Permitir actualizar datos de clientes (subforums)
-- ============================================
-- Habilita UPDATE en subforums para admins y soporte.
-- ============================================

DO $$
BEGIN
  -- Eliminar política previa si existiera con el mismo nombre
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subforums'
      AND policyname = 'Admins and support can update subforums'
  ) THEN
    EXECUTE 'DROP POLICY "Admins and support can update subforums" ON subforums';
  END IF;
END $$;

CREATE POLICY "Admins and support can update subforums"
  ON subforums
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
    )
  );






