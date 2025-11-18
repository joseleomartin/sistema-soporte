# 🔧 Fix: Error "column profiles.department_id does not exist"

## 🐛 Problema

Al ejecutar la migración `20251112170000_create_tasks_system.sql` se producía el error:

```
ERROR: 42703: column profiles.department_id does not exist
```

## 🔍 Causa

La tabla `profiles` **NO tiene** una columna `department_id`. El sistema usa una arquitectura de relación muchos-a-muchos:

- `profiles` → Usuarios
- `departments` → Departamentos
- `user_departments` → Tabla intermedia que relaciona usuarios con departamentos

## ✅ Solución Aplicada

Se reemplazaron **TODAS** las referencias incorrectas de:

```sql
-- ❌ INCORRECTO (no existe)
JOIN profiles ON profiles.id = auth.uid()
WHERE ... AND profiles.department_id = ...
```

Por la consulta correcta usando `user_departments`:

```sql
-- ✅ CORRECTO
JOIN user_departments ON user_departments.department_id = ...
WHERE user_departments.user_id = auth.uid()
```

## 📝 Cambios Realizados

Se corrigieron las siguientes políticas RLS:

### 1. Política: "Usuarios pueden ver sus tareas asignadas"
```sql
-- Antes: profiles.department_id
-- Ahora: user_departments
EXISTS (
    SELECT 1 FROM task_assignments
    JOIN user_departments ON user_departments.department_id = task_assignments.assigned_to_department
    WHERE task_assignments.task_id = tasks.id
    AND user_departments.user_id = auth.uid()
)
```

### 2. Política: "Usuarios pueden actualizar estado de sus tareas"
```sql
-- Mismo cambio que arriba
```

### 3. Política: "Usuarios pueden ver sus asignaciones"
```sql
-- Antes: profiles.department_id = task_assignments.assigned_to_department
-- Ahora: user_departments
EXISTS (
    SELECT 1 FROM user_departments
    WHERE user_departments.user_id = auth.uid()
    AND user_departments.department_id = task_assignments.assigned_to_department
)
```

### 4. Política: "Usuarios pueden ver mensajes de sus tareas"
```sql
-- Antes: profiles.department_id
-- Ahora: user_departments
EXISTS (
    SELECT 1 FROM task_assignments
    JOIN user_departments ON user_departments.department_id = task_assignments.assigned_to_department
    WHERE task_assignments.task_id = task_messages.task_id
    AND user_departments.user_id = auth.uid()
)
```

### 5. Política: "Usuarios pueden crear mensajes en sus tareas"
```sql
-- Mismo cambio que arriba
```

### 6. Política: "Usuarios pueden ver archivos de sus tareas"
```sql
-- Mismo cambio que arriba
```

### 7. Política: "Usuarios pueden subir archivos a sus tareas"
```sql
-- Mismo cambio que arriba
```

## 🚀 Cómo Aplicar el Fix

### Opción 1: Re-ejecutar la Migración Completa

Si aún no has aplicado ninguna tabla:

```sql
-- En Supabase Dashboard → SQL Editor
-- Copia y ejecuta: project/supabase/migrations/20251112170000_create_tasks_system.sql
```

### Opción 2: Eliminar Políticas y Recrearlas

Si ya creaste las tablas pero fallan las políticas:

```sql
-- 1. Eliminar políticas con errores
DROP POLICY IF EXISTS "Usuarios pueden ver sus tareas asignadas" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden actualizar estado de sus tareas" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden ver sus asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Usuarios pueden ver mensajes de sus tareas" ON task_messages;
DROP POLICY IF EXISTS "Usuarios pueden crear mensajes en sus tareas" ON task_messages;
DROP POLICY IF EXISTS "Usuarios pueden ver archivos de sus tareas" ON task_attachments;
DROP POLICY IF EXISTS "Usuarios pueden subir archivos a sus tareas" ON task_attachments;

-- 2. Recrear con la migración corregida
-- Ejecuta solo las secciones de CREATE POLICY del archivo corregido
```

### Opción 3: Rollback Completo

Si quieres empezar de cero:

```sql
-- CUIDADO: Esto eliminará todas las tablas y datos
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_messages CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP FUNCTION IF EXISTS update_tasks_updated_at() CASCADE;

-- Luego ejecuta la migración corregida completa
```

## ✅ Verificación

Después de aplicar el fix, verifica que todo funcione:

```sql
-- 1. Verificar que las tablas existen
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'task%';

-- 2. Verificar que las políticas existen
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename LIKE 'task%';

-- 3. Verificar que Realtime está habilitado
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'task_messages';
```

## 🎯 Resultado Esperado

Después del fix:
- ✅ Todas las tablas creadas correctamente
- ✅ Todas las políticas RLS funcionando
- ✅ Los usuarios pueden ver tareas asignadas a ellos directamente
- ✅ Los usuarios pueden ver tareas asignadas a sus departamentos
- ✅ Los administradores tienen acceso completo
- ✅ Realtime habilitado en `task_messages`

## 📊 Arquitectura de Departamentos

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────┐
│  profiles   │──────<│ user_departments │>──────│ departments  │
│   (users)   │       │   (many-to-many) │       │              │
└─────────────┘       └──────────────────┘       └──────────────┘
     │                         │
     │                         │
     └─────────────┬───────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ task_assignments │
          └──────────────────┘
                   │
                   ▼
             ┌─────────┐
             │  tasks  │
             └─────────┘
```

**Cómo funciona:**
- Un usuario puede estar en múltiples departamentos
- Un departamento puede tener múltiples usuarios
- Una tarea puede asignarse a un usuario individual **O** a un departamento completo
- Si se asigna a un departamento, **todos** los usuarios de ese departamento pueden verla

## 🔍 Consultas de Ejemplo

### Ver departamentos de un usuario

```sql
SELECT d.* 
FROM departments d
JOIN user_departments ud ON ud.department_id = d.id
WHERE ud.user_id = auth.uid();
```

### Ver usuarios de un departamento

```sql
SELECT p.* 
FROM profiles p
JOIN user_departments ud ON ud.user_id = p.id
WHERE ud.department_id = 'uuid-del-departamento';
```

### Ver tareas asignadas al departamento del usuario actual

```sql
SELECT t.* 
FROM tasks t
JOIN task_assignments ta ON ta.task_id = t.id
JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
WHERE ud.user_id = auth.uid();
```

---

## ✅ Fix Aplicado

El archivo `project/supabase/migrations/20251112170000_create_tasks_system.sql` ya está corregido y listo para ejecutarse sin errores.

¡Ahora puedes aplicar la migración! 🚀





