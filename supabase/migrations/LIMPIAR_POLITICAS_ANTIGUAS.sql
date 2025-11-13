-- ============================================
-- Script de Limpieza: Eliminar Políticas Antiguas
-- ============================================
-- Ejecuta este script ANTES de la migración principal
-- si tienes problemas con políticas duplicadas
-- ============================================

-- Eliminar todas las políticas antiguas de tasks
DROP POLICY IF EXISTS "Administradores pueden ver todas las tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden crear tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden actualizar tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden eliminar tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores tienen acceso completo a tareas" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden gestionar todas las tareas" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden ver sus tareas asignadas" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden ver tareas asignadas" ON tasks;
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden actualizar estado de sus tareas" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus tareas" ON tasks;
DROP POLICY IF EXISTS "Users can update their assigned tasks" ON tasks;

-- Eliminar todas las políticas antiguas de task_assignments
DROP POLICY IF EXISTS "Administradores pueden gestionar asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Administradores pueden gestionar todas las asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON task_assignments;
DROP POLICY IF EXISTS "Usuarios pueden ver sus asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Users can view their assignments" ON task_assignments;

-- Eliminar todas las políticas antiguas de task_messages
DROP POLICY IF EXISTS "Usuarios pueden ver mensajes de sus tareas" ON task_messages;
DROP POLICY IF EXISTS "Users can view messages in their tasks" ON task_messages;
DROP POLICY IF EXISTS "Usuarios pueden crear mensajes en sus tareas" ON task_messages;
DROP POLICY IF EXISTS "Users can create messages in their tasks" ON task_messages;

-- Eliminar todas las políticas antiguas de task_attachments
DROP POLICY IF EXISTS "Usuarios pueden ver archivos de sus tareas" ON task_attachments;
DROP POLICY IF EXISTS "Users can view attachments in their tasks" ON task_attachments;
DROP POLICY IF EXISTS "Usuarios pueden subir archivos a sus tareas" ON task_attachments;
DROP POLICY IF EXISTS "Users can upload attachments to their tasks" ON task_attachments;

-- Eliminar task_messages de realtime (si quieres recrearlo)
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS task_messages;

-- ============================================
-- LISTO: Ahora puedes ejecutar la migración principal
-- 20251112170000_create_tasks_system.sql
-- ============================================

