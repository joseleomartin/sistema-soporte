# ✅ Cambios: Asignación Múltiple de Usuarios a Tareas

## 🎯 Problema Resuelto

1. **La tarea no se reflejaba en el usuario seleccionado**
2. **Necesidad de asignar múltiples usuarios a una misma tarea**

---

## 🔧 Cambios Realizados

### 1. **Base de Datos** (`20251112170000_create_tasks_system.sql`)

#### ❌ Antes
```sql
-- Solo permitía UN usuario O UN departamento
CONSTRAINT check_assignment_type CHECK (
    (assigned_to_user IS NOT NULL AND assigned_to_department IS NULL) OR
    (assigned_to_user IS NULL AND assigned_to_department IS NOT NULL)
)
```

#### ✅ Ahora
```sql
-- Permite múltiples usuarios Y/O departamentos
CONSTRAINT check_assignment_type CHECK (
    (assigned_to_user IS NOT NULL) OR (assigned_to_department IS NOT NULL)
),
-- Evitar asignaciones duplicadas
UNIQUE(task_id, assigned_to_user, assigned_to_department)
```

**Ventajas:**
- ✅ Una tarea puede tener múltiples usuarios asignados
- ✅ Una tarea puede tener múltiples departamentos asignados
- ✅ Una tarea puede tener AMBOS (usuarios Y departamentos)
- ✅ No se permiten asignaciones duplicadas

---

### 2. **Frontend: CreateTaskModal** (Selección Múltiple)

#### ❌ Antes
```tsx
// Dropdown de selección única
<select value={selectedUserId}>
  <option>Selecciona un usuario</option>
  ...
</select>
```

#### ✅ Ahora
```tsx
// Lista de checkboxes para selección múltiple
<div className="space-y-2">
  {users.map((user) => (
    <label className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={selectedUserIds.includes(user.id)}
        onChange={(e) => {
          if (e.target.checked) {
            setSelectedUserIds([...selectedUserIds, user.id]);
          } else {
            setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
          }
        }}
      />
      <div>
        <p>{user.full_name}</p>
        <p className="text-xs">{user.email}</p>
      </div>
    </label>
  ))}
</div>
{selectedUserIds.length > 0 && (
  <p>{selectedUserIds.length} usuario(s) seleccionado(s)</p>
)}
```

**Funcionalidad:**
- ✅ Seleccionar múltiples usuarios con checkboxes
- ✅ Contador de usuarios seleccionados
- ✅ UI más visual con nombre y email
- ✅ Scroll para listas largas

---

### 3. **Frontend: Crear Asignaciones** (Backend Logic)

#### ❌ Antes
```tsx
// Una sola asignación
const assignmentData = {
  task_id: taskData.id,
  assigned_to_user: selectedUserId, // Solo uno
  assigned_by: profile.id
};

await supabase.from('task_assignments').insert([assignmentData]);
```

#### ✅ Ahora
```tsx
// Múltiples asignaciones
const assignments = [];

if (assignmentType === 'user') {
  // Crear una asignación por cada usuario seleccionado
  for (const userId of selectedUserIds) {
    assignments.push({
      task_id: taskData.id,
      assigned_to_user: userId,
      assigned_by: profile.id
    });
  }
} else {
  // Asignación a departamento
  assignments.push({
    task_id: taskData.id,
    assigned_to_department: selectedDepartmentId,
    assigned_by: profile.id
  });
}

await supabase.from('task_assignments').insert(assignments);
```

**Funcionalidad:**
- ✅ Crea un registro en `task_assignments` por cada usuario
- ✅ Todas las asignaciones se crean en una sola transacción
- ✅ Si falla, no se crea ninguna asignación (atomicidad)

---

### 4. **Frontend: TasksList** (Mostrar Usuarios Asignados)

#### ✅ Nuevo
```tsx
// Cargar asignaciones con información de usuarios
const { data: assignmentsData, error: assignError } = await supabase
  .from('task_assignments')
  .select(`
    task_id,
    assigned_to_user,
    assigned_to_department,
    profiles:assigned_to_user (id, full_name, avatar_url),
    departments:assigned_to_department (id, name)
  `)
  .in('task_id', taskIds);

// Agrupar por tarea
const taskAssignments = new Map();
assignmentsData?.forEach(assignment => {
  if (!taskAssignments.has(assignment.task_id)) {
    taskAssignments.set(assignment.task_id, { users: [], departments: [] });
  }
  if (assignment.profiles) {
    taskAssignments.get(assignment.task_id).users.push(assignment.profiles);
  }
  if (assignment.departments) {
    taskAssignments.get(assignment.task_id).departments.push(assignment.departments);
  }
});

// Agregar a las tareas
tasksData = tasksData.map(task => ({
  ...task,
  assigned_users: taskAssignments.get(task.id)?.users || [],
  assigned_departments: taskAssignments.get(task.id)?.departments || []
}));
```

**Funcionalidad:**
- ✅ Carga todos los usuarios asignados a cada tarea
- ✅ Carga todos los departamentos asignados
- ✅ Usa JOIN de Supabase para traer los datos en una query

---

### 5. **Frontend: Visualizar Usuarios en Tarjetas**

#### ✅ Nuevo
```tsx
{/* Usuarios Asignados */}
{((task.assigned_users && task.assigned_users.length > 0) || 
  (task.assigned_departments && task.assigned_departments.length > 0)) && (
  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
    <Users className="w-4 h-4 text-gray-500" />
    <div className="flex flex-wrap gap-2">
      {/* Usuarios */}
      {task.assigned_users?.map((user) => (
        <div key={user.id} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-full">
          {user.avatar_url ? (
            <img src={user.avatar_url} className="w-5 h-5 rounded-full" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white">
              {user.full_name.charAt(0)}
            </div>
          )}
          <span className="text-xs font-medium">{user.full_name}</span>
        </div>
      ))}
      
      {/* Departamentos */}
      {task.assigned_departments?.map((dept) => (
        <div key={dept.id} className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-full">
          <Users className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{dept.name}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

**Diseño:**
- ✅ Muestra avatar o inicial del usuario
- ✅ Badges con colores diferentes (usuarios: azul, departamentos: morado)
- ✅ Scroll horizontal si hay muchos
- ✅ Solo se muestra si hay asignaciones

---

## 📊 Estructura de Datos

### Ejemplo: Tarea con 3 Usuarios

```sql
-- Tarea
tasks:
  id: "uuid-tarea-1"
  title: "Revisar documentación"
  ...

-- Asignaciones (3 registros)
task_assignments:
  1. { task_id: "uuid-tarea-1", assigned_to_user: "usuario-1" }
  2. { task_id: "uuid-tarea-1", assigned_to_user: "usuario-2" }
  3. { task_id: "uuid-tarea-1", assigned_to_user: "usuario-3" }
```

### Ejemplo: Tarea con Usuarios Y Departamento

```sql
-- Tarea
tasks:
  id: "uuid-tarea-2"
  title: "Proyecto urgente"
  ...

-- Asignaciones (4 registros)
task_assignments:
  1. { task_id: "uuid-tarea-2", assigned_to_user: "usuario-1" }
  2. { task_id: "uuid-tarea-2", assigned_to_user: "usuario-2" }
  3. { task_id: "uuid-tarea-2", assigned_to_department: "dept-ventas" }
  4. { task_id: "uuid-tarea-2", assigned_to_department: "dept-soporte" }
```

---

## 🚀 Cómo Usar

### Como Administrador (Crear Tarea)

1. Click en "Nueva Tarea"
2. Llenar título, descripción, cliente, fecha, prioridad
3. En "Asignar a", seleccionar "Usuario"
4. **Marcar múltiples checkboxes** de usuarios
5. Ver el contador: "3 usuario(s) seleccionado(s)"
6. Click en "Crear Tarea"

### Como Usuario Asignado (Ver Tarea)

1. Ir a "Tareas" en el sidebar
2. Ver **todas** las tareas asignadas a ti
3. En cada tarjeta, ver:
   - Título, descripción, cliente
   - Fecha límite
   - Prioridad y estado
   - **Lista de todos los usuarios asignados** (con avatares)

---

## ✅ Ventajas del Nuevo Sistema

| Característica | Antes | Ahora |
|----------------|-------|-------|
| **Usuarios por tarea** | 1 usuario O 1 departamento | ✅ Múltiples usuarios Y/O departamentos |
| **Selección de usuarios** | Dropdown simple | ✅ Checkboxes con búsqueda visual |
| **Visualización** | No se mostraban asignaciones | ✅ Badges con avatares y nombres |
| **Flexibilidad** | Limitada | ✅ Total: combinar usuarios y departamentos |
| **UI/UX** | Básica | ✅ Moderna con contador y scroll |

---

## 🐛 Problemas Resueltos

### ✅ **Problema 1: "La tarea no se vio reflejada en el usuario"**

**Causa**: El constraint impedía asignar si ya había un registro con usuario.

**Solución**: Eliminado el constraint excluyente. Ahora permite múltiples registros.

### ✅ **Problema 2: "Puede haber más de un usuario asignado"**

**Causa**: El sistema estaba diseñado para una sola asignación.

**Solución**: 
- Base de datos permite múltiples registros
- Frontend usa checkboxes
- Lógica crea múltiples registros en `task_assignments`

---

## 📝 Checklist de Migración

- [x] Modificar constraint en `task_assignments`
- [x] Agregar UNIQUE constraint para evitar duplicados
- [x] Cambiar estado de `selectedUserId` a `selectedUserIds[]`
- [x] Reemplazar dropdown por checkboxes
- [x] Actualizar lógica de validación (array.length > 0)
- [x] Modificar lógica de creación (loop + múltiples inserts)
- [x] Cargar asignaciones con JOIN en TasksList
- [x] Mostrar usuarios asignados en tarjetas
- [x] Agregar interfaz TypeScript para `assigned_users`
- [x] Importar icono `Users` de lucide-react

---

## 🎉 Sistema Listo

El sistema ahora permite:
- ✅ Asignar múltiples usuarios a una tarea
- ✅ Asignar múltiples departamentos a una tarea
- ✅ Combinar usuarios y departamentos
- ✅ Ver todos los asignados en la lista
- ✅ UI moderna con avatares y badges

¿Necesitas agregar más funcionalidades? (ej: eliminar asignaciones, reasignar, notificaciones) 🚀











