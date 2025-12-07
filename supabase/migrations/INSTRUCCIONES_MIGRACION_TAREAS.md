# 📋 Instrucciones: Migración del Sistema de Tareas

## ✅ El archivo `20251112170000_create_tasks_system.sql` está listo

El archivo ha sido actualizado para ser **idempotente** (puede ejecutarse múltiples veces sin errores).

---

## 🚀 Cómo Aplicar la Migración

### **Opción 1: Primera Vez (Recomendado)**

Si es la primera vez que ejecutas la migración:

```sql
-- En Supabase Dashboard → SQL Editor
-- Copia y pega TODO el contenido de:
-- project/supabase/migrations/20251112170000_create_tasks_system.sql
-- Click en "Run"
```

✅ **Resultado esperado:** Todo se crea correctamente

---

### **Opción 2: Actualización (Si ya ejecutaste una versión anterior)**

Si ya ejecutaste una versión anterior y te dio errores:

```sql
-- La nueva versión tiene DROP IF EXISTS y CREATE IF NOT EXISTS
-- Simplemente ejecuta el archivo completo de nuevo
-- Los objetos existentes NO darán error
```

✅ **Resultado esperado:** Se actualizan políticas y se mantienen datos

---

### **Opción 3: Rollback Completo (Empezar de cero)**

Si quieres eliminar todo y empezar de cero:

```sql
-- CUIDADO: Esto eliminará todas las tareas y datos
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_messages CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP FUNCTION IF EXISTS update_tasks_updated_at() CASCADE;
DROP FUNCTION IF EXISTS prevent_task_field_updates() CASCADE;

-- Luego ejecuta el archivo completo
```

---

## 🔍 Verificar que Funcionó

Después de ejecutar la migración, verifica:

### 1. **Tablas Creadas**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'task%'
ORDER BY table_name;
```

**Resultado esperado:**
```
task_assignments
task_attachments
task_messages
tasks
```

---

### 2. **Índices Creados**
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename LIKE 'task%'
ORDER BY tablename, indexname;
```

**Resultado esperado:**
```
idx_task_assignments_assigned_by
idx_task_assignments_assigned_to_department
idx_task_assignments_assigned_to_user
idx_task_assignments_task_id
idx_task_attachments_message_id
idx_task_attachments_task_id
idx_task_attachments_uploaded_by
idx_task_messages_created_at
idx_task_messages_task_id
idx_task_messages_user_id
idx_tasks_created_at
idx_tasks_created_by
idx_tasks_due_date
idx_tasks_priority
idx_tasks_status
```

---

### 3. **Políticas RLS Creadas**
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'task%'
ORDER BY tablename, policyname;
```

**Resultado esperado:**
```
tasks → Administradores tienen acceso completo a tareas
tasks → Usuarios pueden actualizar estado de sus tareas
tasks → Usuarios pueden ver sus tareas asignadas
task_assignments → Administradores pueden gestionar todas las asignaciones
task_assignments → Usuarios pueden ver sus asignaciones
task_messages → Usuarios pueden crear mensajes en sus tareas
task_messages → Usuarios pueden ver mensajes de sus tareas
task_attachments → Usuarios pueden subir archivos a sus tareas
task_attachments → Usuarios pueden ver archivos de sus tareas
```

---

### 4. **Funciones y Triggers**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name LIKE '%task%'
ORDER BY routine_name;
```

**Resultado esperado:**
```
prevent_task_field_updates
update_tasks_updated_at
```

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table LIKE 'task%'
ORDER BY event_object_table, trigger_name;
```

**Resultado esperado:**
```
tasks → tasks_prevent_field_updates_trigger
tasks → tasks_updated_at_trigger
```

---

### 5. **Realtime Habilitado**
```sql
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'task_messages';
```

**Resultado esperado:**
```
public | task_messages
```

---

## ⚠️ Errores Comunes y Soluciones

### Error: `relation "idx_tasks_created_by" already exists`

**Causa:** Estás ejecutando la migración por segunda vez sin `IF NOT EXISTS`.

**Solución:** ✅ **YA ESTÁ CORREGIDO** en la nueva versión. Todos los índices ahora tienen `CREATE INDEX IF NOT EXISTS`.

---

### Error: `policy "..." already exists on table "..."`

**Causa:** Estás ejecutando la migración por segunda vez sin `DROP IF EXISTS`.

**Solución:** ✅ **YA ESTÁ CORREGIDO** en la nueva versión. Todas las políticas ahora tienen `DROP POLICY IF EXISTS` antes de crearlas.

---

### Error: `trigger "..." already exists`

**Causa:** Estás ejecutando la migración por segunda vez.

**Solución:** ✅ **YA ESTÁ CORREGIDO** en la nueva versión. Todos los triggers ahora tienen `DROP TRIGGER IF EXISTS` antes de crearlos.

---

### Error: `column profiles.department_id does not exist`

**Causa:** La tabla `profiles` no tiene una columna `department_id` (se usa `user_departments`).

**Solución:** ✅ **YA ESTÁ CORREGIDO**. Ahora usa `JOIN user_departments` correctamente.

---

### Error: `missing FROM-clause entry for table "old"`

**Causa:** Se intentaba usar `OLD` en una política RLS (solo funciona en triggers).

**Solución:** ✅ **YA ESTÁ CORREGIDO**. Ahora usa un trigger `prevent_task_field_updates` para validar campos.

---

## 🎯 Cambios Importantes en Esta Versión

| Característica | Estado |
|----------------|--------|
| ✅ Múltiples usuarios por tarea | Implementado |
| ✅ Constraint flexible | `(user IS NOT NULL) OR (dept IS NOT NULL)` |
| ✅ Índice único para evitar duplicados | `UNIQUE(task_id, user, dept)` |
| ✅ `IF NOT EXISTS` en índices | Sí |
| ✅ `DROP IF EXISTS` en políticas | Sí |
| ✅ `DROP IF EXISTS` en triggers | Sí |
| ✅ Usa `user_departments` correctamente | Sí |
| ✅ Trigger para validar campos | Sí |
| ✅ Realtime habilitado | Sí (task_messages) |

---

## 📝 Resumen de Correcciones

### ✅ **Todos los Errores Corregidos**

1. ❌ `idx_tasks_created_by already exists` → ✅ `CREATE INDEX IF NOT EXISTS`
2. ❌ `policy already exists` → ✅ `DROP POLICY IF EXISTS` antes de crear
3. ❌ `trigger already exists` → ✅ `DROP TRIGGER IF EXISTS` antes de crear
4. ❌ `profiles.department_id does not exist` → ✅ Usa `user_departments`
5. ❌ `missing FROM-clause entry for table "old"` → ✅ Usa trigger en lugar de política
6. ❌ Solo 1 usuario por tarea → ✅ Permite múltiples usuarios

---

## 🚀 ¡Listo para Ejecutar!

El archivo **`20251112170000_create_tasks_system.sql`** está completamente corregido y puede ejecutarse múltiples veces sin errores.

### **Ejecuta la Migración:**

```bash
# En Supabase Dashboard → SQL Editor
# Copia y pega todo el archivo
# Click en "Run"
```

**¿Algún error? Copia el mensaje completo y lo resolvemos.** 🔧













