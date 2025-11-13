-- ============================================
-- Permisos de Foros/Clientes por Departamentos
-- ============================================
-- Permite asignar permisos de acceso a foros completos por departamento
-- ============================================

-- 1. Crear tabla de permisos de foros por departamento
CREATE TABLE IF NOT EXISTS department_forum_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  forum_id uuid NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true,
  can_post boolean DEFAULT false,
  can_moderate boolean DEFAULT false,
  granted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(department_id, forum_id)
);

-- 2. Habilitar RLS
ALTER TABLE department_forum_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
CREATE POLICY "Everyone can view department forum permissions"
  ON department_forum_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage department forum permissions"
  ON department_forum_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 4. Crear índices
CREATE INDEX IF NOT EXISTS idx_dept_forum_permissions_dept ON department_forum_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_forum_permissions_forum ON department_forum_permissions(forum_id);

-- 5. Actualizar política de subforums para incluir permisos por departamento
-- Eliminar política existente
DROP POLICY IF EXISTS "Users can view subforums they have access to" ON subforums;

-- Crear nueva política que incluye departamentos
CREATE POLICY "Users can view subforums they have access to"
  ON subforums FOR SELECT
  TO authenticated
  USING (
    -- Admin y support ven todo
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
    OR
    -- Usuario tiene permiso directo
    EXISTS (
      SELECT 1 FROM subforum_permissions
      WHERE subforum_permissions.subforum_id = subforums.id
      AND subforum_permissions.user_id = auth.uid()
    )
    OR
    -- Usuario pertenece a un departamento con permiso al foro
    EXISTS (
      SELECT 1 FROM user_departments ud
      INNER JOIN department_forum_permissions dfp 
        ON dfp.department_id = ud.department_id
      WHERE ud.user_id = auth.uid()
      AND dfp.forum_id = subforums.forum_id
      AND dfp.can_view = true
    )
  );

-- 6. Actualizar política de forum_messages para incluir permisos por departamento
DROP POLICY IF EXISTS "Users can view messages in accessible subforums" ON forum_messages;

CREATE POLICY "Users can view messages in accessible subforums"
  ON forum_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subforums
      WHERE subforums.id = forum_messages.subforum_id
      AND (
        -- Admin y support ven todo
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'support')
        )
        OR
        -- Usuario tiene permiso directo
        EXISTS (
          SELECT 1 FROM subforum_permissions
          WHERE subforum_permissions.subforum_id = subforums.id
          AND subforum_permissions.user_id = auth.uid()
        )
        OR
        -- Usuario pertenece a un departamento con permiso
        EXISTS (
          SELECT 1 FROM user_departments ud
          INNER JOIN department_forum_permissions dfp 
            ON dfp.department_id = ud.department_id
          WHERE ud.user_id = auth.uid()
          AND dfp.forum_id = subforums.forum_id
          AND dfp.can_view = true
        )
      )
    )
  );

-- 7. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE department_forum_permissions;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Tabla department_forum_permissions creada
-- ✅ Políticas RLS configuradas
-- ✅ Índices creados
-- ✅ Políticas de subforums y forum_messages actualizadas
-- ✅ Realtime habilitado
-- 
-- Ahora los administradores pueden asignar permisos de foros completos
-- a departamentos, y todos los usuarios del departamento tendrán acceso
-- ============================================




