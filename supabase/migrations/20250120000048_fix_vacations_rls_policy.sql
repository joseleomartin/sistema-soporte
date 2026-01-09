-- ============================================
-- Fix: Corregir política RLS de vacations para permitir inserción
-- ============================================
-- El problema es que la política RLS está verificando tenant_id = get_user_tenant_id()
-- pero puede haber un problema con la función o con cómo se inserta el tenant_id
-- ============================================

-- 1. Eliminar la política problemática
DROP POLICY IF EXISTS "Users can create vacations in own tenant" ON vacations;

-- 2. Crear una política más permisiva que verifique el tenant_id del perfil del usuario
CREATE POLICY "Users can create vacations in own tenant"
  ON vacations FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Verificar que el tenant_id insertado coincide con el tenant_id del perfil del usuario
    tenant_id = (
      SELECT tenant_id 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
    AND user_id = auth.uid()
  );

-- 3. También verificar que la función get_user_tenant_id() existe y funciona correctamente
-- Si no existe, la política anterior debería funcionar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_tenant_id'
  ) THEN
    RAISE NOTICE '✅ Función get_user_tenant_id() existe';
  ELSE
    RAISE WARNING '⚠️  Función get_user_tenant_id() no existe. La política usa SELECT directo de profiles.';
  END IF;
END $$;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================










