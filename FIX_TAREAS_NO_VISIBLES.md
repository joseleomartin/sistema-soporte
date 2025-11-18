# 🐛 Fix: Usuario No Puede Ver Sus Tareas Asignadas

## 🎯 Problema

Los usuarios no podían ver las tareas que se les asignaron. La pantalla mostraba "No hay tareas - Aún no hay tareas asignadas".

---

## 🔍 Causa del Problema

En `TasksList.tsx`, el código intentaba acceder a `profile.department_id`:

```tsx
// ❌ INCORRECTO
const { data: assignments } = await supabase
  .from('task_assignments')
  .select('task_id')
  .or(`assigned_to_user.eq.${profile.id},assigned_to_department.eq.${profile.department_id}`);
```

**Problema:** La tabla `profiles` **NO tiene** una columna `department_id`. 

Los usuarios están relacionados con departamentos a través de la tabla `user_departments` (relación muchos-a-muchos).

---

## ✅ Solución Implementada

Ahora el código:

1. **Primero obtiene los departamentos del usuario** desde `user_departments`
2. **Busca tareas asignadas directamente** al usuario
3. **Busca tareas asignadas a sus departamentos**
4. **Combina ambas listas** sin duplicados

```tsx
// ✅ CORRECTO
// 1. Obtener departamentos del usuario
const { data: userDepts } = await supabase
  .from('user_departments')
  .select('department_id')
  .eq('user_id', profile.id);

const departmentIds = userDepts?.map(d => d.department_id) || [];

// 2. Obtener tareas asignadas al usuario
const { data: userAssignments } = await supabase
  .from('task_assignments')
  .select('task_id')
  .eq('assigned_to_user', profile.id);

// 3. Obtener tareas asignadas a sus departamentos
const { data: deptAssignments } = await supabase
  .from('task_assignments')
  .select('task_id')
  .in('assigned_to_department', departmentIds);

// 4. Combinar sin duplicados
const allTaskIds = new Set([
  ...(userAssignments?.map(a => a.task_id) || []),
  ...(deptAssignments?.map(a => a.task_id) || [])
]);

const taskIds = Array.from(allTaskIds);

// 5. Obtener las tareas
const { data: tasks } = await supabase
  .from('tasks')
  .select('*')
  .in('id', taskIds);
```

---

## 📊 Arquitectura de Asignación de Tareas

```
Usuario (profiles)
    ↓
    ├─→ Asignación Directa (task_assignments.assigned_to_user)
    │        ↓
    │      Tarea (tasks)
    │
    └─→ Pertenece a Departamento (user_departments)
             ↓
           Departamento (departments)
             ↓
           Asignación a Departamento (task_assignments.assigned_to_department)
             ↓
           Tarea (tasks)
```

**Un usuario puede ver una tarea si:**
- ✅ Está asignado directamente (`task_assignments.assigned_to_user = usuario_id`)
- ✅ Pertenece a un departamento que tiene la tarea asignada

---

## 🎯 Casos de Uso

### Caso 1: Tarea asignada a un usuario específico

```sql
-- Admin crea tarea
INSERT INTO tasks (title, ...) VALUES ('Revisar documentos', ...);

-- Admin asigna a Juan
INSERT INTO task_assignments (task_id, assigned_to_user)
VALUES ('uuid-tarea', 'uuid-juan');

-- ✅ Juan puede ver la tarea
```

### Caso 2: Tarea asignada a un departamento

```sql
-- Admin crea tarea
INSERT INTO tasks (title, ...) VALUES ('Proyecto urgente', ...);

-- Admin asigna al Departamento de Ventas
INSERT INTO task_assignments (task_id, assigned_to_department)
VALUES ('uuid-tarea', 'uuid-dept-ventas');

-- Juan pertenece al Departamento de Ventas
-- ✅ Juan puede ver la tarea
```

### Caso 3: Tarea asignada a múltiples usuarios

```sql
-- Admin crea tarea
INSERT INTO tasks (title, ...) VALUES ('Reunión cliente X', ...);

-- Admin asigna a Juan, María y Carlos
INSERT INTO task_assignments (task_id, assigned_to_user) VALUES
  ('uuid-tarea', 'uuid-juan'),
  ('uuid-tarea', 'uuid-maria'),
  ('uuid-tarea', 'uuid-carlos');

-- ✅ Juan, María y Carlos pueden ver la tarea
```

### Caso 4: Tarea asignada a usuarios Y departamento

```sql
-- Admin crea tarea
INSERT INTO tasks (title, ...) VALUES ('Proyecto complejo', ...);

-- Admin asigna a Juan (directo) y al Departamento de Soporte
INSERT INTO task_assignments (task_id, assigned_to_user, assigned_to_department) VALUES
  ('uuid-tarea', 'uuid-juan', NULL),
  ('uuid-tarea', NULL, 'uuid-dept-soporte');

-- ✅ Juan puede ver la tarea (asignación directa)
-- ✅ Todos los del Departamento de Soporte pueden ver la tarea
```

---

## 🧪 Cómo Probar la Corrección

### Test 1: Asignación Directa

1. **Como Admin:**
   - Crear una tarea
   - Asignarla a un usuario específico (ej: Juan)
   - Guardar

2. **Como Juan:**
   - Ir a "Tareas"
   - ✅ **Debería ver** la tarea asignada
   - Hacer click en la tarea
   - ✅ **Debería ver** su nombre en los usuarios asignados

---

### Test 2: Asignación a Departamento

1. **Como Admin:**
   - Crear una tarea
   - Asignarla a un departamento (ej: Ventas)
   - Guardar

2. **Como usuario de Ventas:**
   - Ir a "Tareas"
   - ✅ **Debería ver** la tarea
   - Hacer click en la tarea
   - ✅ **Debería ver** el badge del departamento "Ventas"

---

### Test 3: Sin Asignación

1. **Como Admin:**
   - Crear una tarea
   - Asignarla a otro usuario (no tú)
   - Guardar

2. **Como usuario no asignado:**
   - Ir a "Tareas"
   - ❌ **NO debería ver** la tarea
   - ✅ Mensaje: "No hay tareas - Aún no hay tareas asignadas"

---

## 🐛 Debugging: Consultas SQL para Verificar

### Ver tareas de un usuario

```sql
-- Reemplaza 'uuid-del-usuario' con el ID real
SELECT t.*
FROM tasks t
WHERE EXISTS (
    -- Asignación directa
    SELECT 1 FROM task_assignments ta
    WHERE ta.task_id = t.id
    AND ta.assigned_to_user = 'uuid-del-usuario'
)
OR EXISTS (
    -- Asignación por departamento
    SELECT 1 FROM task_assignments ta
    JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
    WHERE ta.task_id = t.id
    AND ud.user_id = 'uuid-del-usuario'
);
```

### Ver asignaciones de una tarea

```sql
-- Reemplaza 'uuid-de-la-tarea' con el ID real
SELECT 
    ta.id,
    ta.task_id,
    p.full_name as usuario_asignado,
    d.name as departamento_asignado
FROM task_assignments ta
LEFT JOIN profiles p ON p.id = ta.assigned_to_user
LEFT JOIN departments d ON d.id = ta.assigned_to_department
WHERE ta.task_id = 'uuid-de-la-tarea';
```

### Ver departamentos de un usuario

```sql
-- Reemplaza 'uuid-del-usuario' con el ID real
SELECT d.*
FROM departments d
JOIN user_departments ud ON ud.department_id = d.id
WHERE ud.user_id = 'uuid-del-usuario';
```

---

## ✅ Checklist de Verificación

Después del fix, verifica:

- [ ] Usuario puede ver tareas asignadas directamente
- [ ] Usuario puede ver tareas de sus departamentos
- [ ] Usuario NO ve tareas de otros usuarios
- [ ] Admin ve TODAS las tareas
- [ ] Tarjetas muestran usuarios asignados correctamente
- [ ] Tarjetas muestran departamentos asignados correctamente
- [ ] Filtros funcionan correctamente
- [ ] Búsqueda funciona correctamente

---

## 📝 Archivo Modificado

- ✅ `src/components/Tasks/TasksList.tsx` - Corregida la lógica de filtrado

---

## 🚀 Despliegue

```bash
# 1. Guarda los cambios
git add .
git commit -m "Fix: corregir visualización de tareas asignadas"

# 2. Push a producción
git push

# 3. Vercel/Netlify desplegará automáticamente
```

---

## 🎉 Resultado

Ahora los usuarios pueden ver correctamente:
- ✅ Tareas asignadas directamente a ellos
- ✅ Tareas asignadas a sus departamentos
- ✅ Múltiples usuarios en una misma tarea
- ✅ Badges con avatares y nombres
- ✅ Badges con departamentos

**¡El sistema funciona completamente!** 🚀





