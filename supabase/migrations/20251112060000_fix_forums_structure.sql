-- ============================================
-- Corregir Estructura de Forums y Agregar Permisos por Departamento
-- ============================================

-- 1. Crear tabla forums (padre) si no existe
CREATE TABLE IF NOT EXISTS forums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Habilitar RLS en forums
ALTER TABLE forums ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para forums
CREATE POLICY "Everyone can view forums"
  ON forums FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and support can create forums"
  ON forums FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

CREATE POLICY "Admins and support can update forums"
  ON forums FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- 4. Agregar columna forum_id a subforums si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subforums' AND column_name = 'forum_id'
  ) THEN
    -- Primero crear un forum por defecto
    INSERT INTO forums (name, description, created_by)
    SELECT 'General', 'Foro general', id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;

    -- Agregar columna forum_id
    ALTER TABLE subforums ADD COLUMN forum_id uuid REFERENCES forums(id) ON DELETE CASCADE;

    -- Asignar todos los subforums existentes al forum por defecto
    UPDATE subforums
    SET forum_id = (SELECT id FROM forums LIMIT 1)
    WHERE forum_id IS NULL;

    -- Hacer la columna NOT NULL después de llenarla
    ALTER TABLE subforums ALTER COLUMN forum_id SET NOT NULL;
  END IF;
END $$;

-- 5. Crear tabla de permisos de foros por departamento
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

-- 6. Habilitar RLS
ALTER TABLE department_forum_permissions ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para department_forum_permissions
DROP POLICY IF EXISTS "Everyone can view department forum permissions" ON department_forum_permissions;
DROP POLICY IF EXISTS "Only admins can manage department forum permissions" ON department_forum_permissions;

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

-- 8. Crear índices
CREATE INDEX IF NOT EXISTS idx_dept_forum_permissions_dept ON department_forum_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_forum_permissions_forum ON department_forum_permissions(forum_id);
CREATE INDEX IF NOT EXISTS idx_subforums_forum_id ON subforums(forum_id);

-- 9. Actualizar política de subforums para incluir permisos por departamento
DROP POLICY IF EXISTS "Users can view subforums they have access to" ON subforums;

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

-- 10. Actualizar política de forum_messages para incluir permisos por departamento
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

-- 11. Habilitar Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE department_forum_permissions;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'La tabla department_forum_permissions ya está en supabase_realtime';
  END;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Tabla forums creada
-- ✅ Columna forum_id agregada a subforums
-- ✅ Tabla department_forum_permissions creada
-- ✅ Políticas RLS configuradas
-- ✅ Índices creados
-- ✅ Políticas de subforums y forum_messages actualizadas
-- ✅ Realtime habilitado
-- 
-- Ahora los administradores pueden:
-- 1. Asignar eventos de calendario a departamentos completos
-- 2. Gestionar permisos de clientes por departamentos
-- ============================================

