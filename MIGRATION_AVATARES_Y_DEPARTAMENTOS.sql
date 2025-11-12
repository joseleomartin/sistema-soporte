-- ============================================
-- MIGRACIÓN: Avatares y Departamentos
-- ============================================
-- Este script agrega las funcionalidades de avatares y departamentos
-- sin afectar las tablas y políticas existentes
-- ============================================

-- 1. Agregar columna de avatar a profiles (si no existe)
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- 2. Crear tabla de departamentos
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Crear tabla de asignación de usuarios a departamentos
-- ============================================
CREATE TABLE IF NOT EXISTS user_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- 4. Habilitar RLS en las nuevas tablas
-- ============================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

-- 5. Eliminar políticas existentes de departments (si existen)
-- ============================================
DROP POLICY IF EXISTS "Everyone can view departments" ON departments;
DROP POLICY IF EXISTS "Only admins can create departments" ON departments;
DROP POLICY IF EXISTS "Only admins can update departments" ON departments;
DROP POLICY IF EXISTS "Only admins can delete departments" ON departments;

-- 6. Crear políticas para departments
-- ============================================
CREATE POLICY "Everyone can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 7. Eliminar políticas existentes de user_departments (si existen)
-- ============================================
DROP POLICY IF EXISTS "Everyone can view user departments" ON user_departments;
DROP POLICY IF EXISTS "Only admins can assign departments" ON user_departments;
DROP POLICY IF EXISTS "Only admins can remove department assignments" ON user_departments;

-- 8. Crear políticas para user_departments
-- ============================================
CREATE POLICY "Everyone can view user departments"
  ON user_departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can assign departments"
  ON user_departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

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

-- 9. Crear índices para mejor rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments(department_id);

-- 10. Insertar departamentos de ejemplo
-- ============================================
INSERT INTO departments (name, description, color) VALUES
  ('Contadores', 'Departamento de contabilidad y finanzas', '#10B981'),
  ('Abogados', 'Departamento legal', '#3B82F6'),
  ('Soporte', 'Equipo de soporte técnico', '#F59E0B'),
  ('Administración', 'Administración general', '#8B5CF6')
ON CONFLICT (name) DO NOTHING;

-- 11. Crear bucket de storage para avatares (si no existe)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 12. Eliminar políticas existentes de storage (si existen)
-- ============================================
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- 13. Crear políticas de storage para avatares
-- ============================================
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 14. Habilitar Realtime para actualizaciones automáticas
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE user_departments;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================
-- ✅ Columna avatar_url agregada a profiles
-- ✅ Tabla departments creada
-- ✅ Tabla user_departments creada
-- ✅ Políticas RLS configuradas
-- ✅ Índices creados
-- ✅ Departamentos de ejemplo insertados
-- ✅ Storage bucket 'avatars' creado
-- ✅ Políticas de storage configuradas
-- ✅ Realtime habilitado para actualizaciones automáticas
-- ============================================

