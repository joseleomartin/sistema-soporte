-- ============================================
-- MIGRACIÓN: Corregir tareas existentes sin tenant_id
-- ============================================
-- Actualiza las tareas que no tienen tenant_id asignándoles el tenant_id
-- del perfil del usuario que las creó (created_by)
-- También corrige task_assignments sin tenant_id
-- ============================================

-- Actualizar tareas sin tenant_id usando el tenant_id del creador
UPDATE tasks
SET tenant_id = (
  SELECT p.tenant_id 
  FROM profiles p 
  WHERE p.id = tasks.created_by 
  LIMIT 1
)
WHERE tenant_id IS NULL
  AND created_by IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.id = tasks.created_by 
    AND p.tenant_id IS NOT NULL
  );

-- Actualizar task_assignments sin tenant_id usando el tenant_id de la tarea
UPDATE task_assignments
SET tenant_id = (
  SELECT t.tenant_id 
  FROM tasks t 
  WHERE t.id = task_assignments.task_id 
  LIMIT 1
)
WHERE tenant_id IS NULL
  AND task_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM tasks t 
    WHERE t.id = task_assignments.task_id 
    AND t.tenant_id IS NOT NULL
  );

-- Verificar si quedan tareas sin tenant_id y mostrar un warning
DO $$
DECLARE
  tasks_without_tenant INTEGER;
  assignments_without_tenant INTEGER;
BEGIN
  SELECT COUNT(*) INTO tasks_without_tenant
  FROM tasks
  WHERE tenant_id IS NULL;
  
  SELECT COUNT(*) INTO assignments_without_tenant
  FROM task_assignments
  WHERE tenant_id IS NULL;
  
  IF tasks_without_tenant > 0 THEN
    RAISE WARNING 'Quedan % tareas sin tenant_id. Estas tareas pueden tener problemas con RLS y triggers.', tasks_without_tenant;
  ELSE
    RAISE NOTICE 'Todas las tareas ahora tienen tenant_id asignado.';
  END IF;
  
  IF assignments_without_tenant > 0 THEN
    RAISE WARNING 'Quedan % asignaciones sin tenant_id. Estas asignaciones pueden tener problemas con RLS.', assignments_without_tenant;
  ELSE
    RAISE NOTICE 'Todas las asignaciones ahora tienen tenant_id asignado.';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Tareas sin tenant_id actualizadas con el tenant_id del creador
-- ✅ Warning si quedan tareas sin tenant_id
-- ============================================
