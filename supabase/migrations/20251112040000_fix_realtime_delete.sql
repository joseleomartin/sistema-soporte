-- ============================================
-- Verificar y Corregir Realtime para DELETE
-- ============================================
-- Este script asegura que los eventos DELETE se transmitan correctamente
-- ============================================

-- 1. Verificar que la tabla esté en la publicación de realtime
-- (Si ya está, no hace nada)
DO $$
BEGIN
  -- Intentar agregar la tabla a realtime (ignora si ya existe)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_departments;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'La tabla user_departments ya está en supabase_realtime';
  END;
END $$;

-- 2. Verificar políticas de DELETE
-- Asegurarse de que los admins puedan eliminar asignaciones
DROP POLICY IF EXISTS "Only admins can remove department assignments" ON user_departments;

CREATE POLICY "Only admins can remove department assignments"
  ON user_departments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 3. Verificar que RLS esté habilitado
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Realtime verificado para user_departments
-- ✅ Política de DELETE verificada
-- ✅ RLS habilitado
-- 
-- Ahora los eventos DELETE deberían funcionar correctamente
-- ============================================





















