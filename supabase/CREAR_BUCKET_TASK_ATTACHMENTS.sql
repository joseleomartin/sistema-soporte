-- ============================================
-- CREAR BUCKET Y POLÍTICAS RLS PARA ARCHIVOS
-- ============================================
-- Ejecuta este script en Supabase Dashboard → SQL Editor
-- para crear el bucket task-attachments y sus políticas
-- ============================================

-- 1. Crear el bucket (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-attachments', 'task-attachments', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Habilitar RLS en storage.objects (si no está ya habilitado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 3. Crear políticas usando función con SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_storage_policies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Eliminar políticas antiguas (si existen)
  DROP POLICY IF EXISTS "Usuarios asignados pueden ver archivos" ON storage.objects;
  DROP POLICY IF EXISTS "Usuarios asignados pueden subir archivos" ON storage.objects;
  DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios archivos" ON storage.objects;

  -- Política: Ver archivos (SELECT)
  CREATE POLICY "Usuarios asignados pueden ver archivos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      -- Extraer task_id del path: task-attachments/TASK_ID/filename.ext
      (storage.foldername(name))[1]::uuid IN (
        -- Tareas asignadas directamente al usuario
        SELECT task_id FROM task_assignments
        WHERE assigned_to_user = auth.uid()
        UNION
        -- Tareas asignadas a departamentos del usuario
        SELECT ta.task_id FROM task_assignments ta
        JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
        WHERE ud.user_id = auth.uid()
      )
      OR
      -- Admins pueden ver todo
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

  -- Política: Subir archivos (INSERT)
  CREATE POLICY "Usuarios asignados pueden subir archivos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (
      -- El path debe ser: task-attachments/TASK_ID/...
      (storage.foldername(name))[1]::uuid IN (
        -- Tareas asignadas directamente al usuario
        SELECT task_id FROM task_assignments
        WHERE assigned_to_user = auth.uid()
        UNION
        -- Tareas asignadas a departamentos del usuario
        SELECT ta.task_id FROM task_assignments ta
        JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
        WHERE ud.user_id = auth.uid()
      )
      OR
      -- Admins pueden subir a cualquier tarea
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

  -- Política: Eliminar archivos (DELETE)
  CREATE POLICY "Usuarios pueden eliminar sus propios archivos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      -- Extraer task_id del path
      (storage.foldername(name))[1]::uuid IN (
        -- Tareas asignadas directamente al usuario
        SELECT task_id FROM task_assignments
        WHERE assigned_to_user = auth.uid()
        UNION
        -- Tareas asignadas a departamentos del usuario
        SELECT ta.task_id FROM task_assignments ta
        JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
        WHERE ud.user_id = auth.uid()
      )
      OR
      -- Admins pueden eliminar todo
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );
END;
$$;

-- 4. Ejecutar la función para crear las políticas
SELECT create_storage_policies();

-- 5. Limpiar: eliminar la función temporal (opcional)
-- DROP FUNCTION IF EXISTS create_storage_policies();

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que el bucket existe
SELECT 'Bucket creado:' as mensaje, * FROM storage.buckets WHERE id = 'task-attachments';

-- Verificar las políticas
SELECT 'Políticas creadas:' as mensaje, schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%asignados%';

-- ============================================
-- FIN
-- ============================================

-- ✅ Bucket task-attachments y políticas creadas correctamente
-- Si ves los resultados de las queries de verificación arriba, todo está bien

