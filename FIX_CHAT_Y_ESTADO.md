# 🔧 Fix: Chat se Agranda y Usuario No Puede Cambiar Estado

## 🐛 Problemas Identificados

### 1. El chat se agranda a medida que se escribe
### 2. El usuario no puede cambiar el estado de la tarea

---

## ✅ Solución 1: Textarea con Altura Fija

### **Problema:**
El `<textarea>` del chat crecía automáticamente sin límite, haciendo que la interfaz se deformara.

### **Solución:**
Agregué `rows={2}` y `max-h-32` para fijar la altura:

```tsx
// ❌ Antes: sin altura fija
<textarea
  className="flex-1 px-4 py-2 border ... resize-none"
/>

// ✅ Ahora: altura fija de 2 líneas con máximo
<textarea
  rows={2}
  className="flex-1 px-4 py-2 border ... resize-none max-h-32"
/>
```

**Resultado:**
- ✅ El textarea siempre tiene 2 líneas visibles
- ✅ Máximo de altura: `8rem` (32 × 0.25rem = 8rem ≈ 128px)
- ✅ Scroll interno si el texto es muy largo
- ✅ `resize-none` previene que el usuario lo redimensione manualmente

---

## ✅ Solución 2: Verificar Asignación Correctamente

### **Problema:**
El código intentaba acceder a `profile.department_id` que **NO EXISTE**:

```tsx
// ❌ INCORRECTO
const { data } = await supabase
  .from('task_assignments')
  .select('*')
  .eq('task_id', task.id)
  .or(`assigned_to_user.eq.${profile.id},assigned_to_department.eq.${profile.department_id}`);
  //                                                             ^^^^^^^^^^^^^^^^^ NO EXISTE
```

Esto hacía que la verificación fallara y `isAssigned` siempre fuera `false`, bloqueando el cambio de estado.

### **Solución:**
Verificar asignación correctamente usando `user_departments`:

```tsx
// ✅ CORRECTO
// 1. Obtener departamentos del usuario
const { data: userDepts } = await supabase
  .from('user_departments')
  .select('department_id')
  .eq('user_id', profile.id);

const departmentIds = userDepts?.map(d => d.department_id) || [];

// 2. Verificar asignación directa
const { data: directAssignment } = await supabase
  .from('task_assignments')
  .select('*')
  .eq('task_id', task.id)
  .eq('assigned_to_user', profile.id)
  .maybeSingle();

if (directAssignment) {
  setIsAssigned(true);
  return;
}

// 3. Verificar asignación por departamento
if (departmentIds.length > 0) {
  const { data: deptAssignment } = await supabase
    .from('task_assignments')
    .select('*')
    .eq('task_id', task.id)
    .in('assigned_to_department', departmentIds)
    .maybeSingle();

  setIsAssigned(!!deptAssignment);
}
```

---

## 🔒 Mejoras Adicionales en handleStatusChange

Agregué validaciones y logs:

```tsx
const handleStatusChange = async (newStatus: string) => {
  // Validación de permisos
  if (!isAssigned && profile?.role !== 'admin') {
    alert('No tienes permisos para cambiar el estado de esta tarea');
    return;
  }

  try {
    setUpdating(true);
    console.log('🔄 Updating task status to:', newStatus);

    const { data, error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating status:', error);
      throw error;
    }

    console.log('✅ Task status updated:', data);
    setTask(data);
  } catch (error: any) {
    console.error('❌ Error updating status:', error);
    alert(`Error al actualizar el estado: ${error.message || 'Error desconocido'}`);
  } finally {
    setUpdating(false);
  }
};
```

**Mejoras:**
- ✅ Validación explícita de permisos
- ✅ Logs para debugging
- ✅ Mensaje de error más descriptivo
- ✅ Manejo correcto de excepciones

---

## 🎯 Cómo Funciona Ahora

### **Usuario Asignado:**
1. Usuario abre una tarea asignada a él
2. `checkIfAssigned()` verifica:
   - ¿Está asignado directamente? → `isAssigned = true`
   - ¿Pertenece a un departamento asignado? → `isAssigned = true`
   - ¿Ninguna de las anteriores? → `isAssigned = false`
3. Si `isAssigned = true` o es `admin`:
   - ✅ Puede cambiar el estado
   - El dropdown está habilitado

### **Usuario NO Asignado:**
1. Usuario abre una tarea de otro usuario
2. `checkIfAssigned()` retorna `false`
3. Si intenta cambiar el estado:
   - ❌ Alert: "No tienes permisos..."
   - El estado no cambia

---

## 🧪 Cómo Probar la Corrección

### **Test 1: Textarea con Altura Fija**

1. Abre el chat de una tarea
2. Escribe un mensaje largo de varias líneas
3. ✅ **El textarea NO debe crecer más allá de ~128px**
4. ✅ **Debe aparecer scroll interno** si el texto es muy largo
5. ✅ **No debe deformar la interfaz**

---

### **Test 2: Usuario Asignado Puede Cambiar Estado**

**Como Admin:**
1. Crea una tarea
2. Asigna a "Juan"
3. Guarda

**Como Juan:**
1. Login como Juan
2. Ve a "Tareas"
3. Abre la tarea asignada
4. Abre la consola del navegador (F12)
5. Cambia el estado de "Pendiente" a "En Progreso"
6. **En la consola deberías ver:**
   ```
   🔄 Updating task status to: in_progress
   ✅ Task status updated: { id: "...", status: "in_progress", ... }
   ```
7. ✅ **El estado debe cambiar correctamente**

---

### **Test 3: Usuario NO Asignado NO Puede Cambiar Estado**

**Como Admin:**
1. Crea una tarea
2. Asigna a "María" (NO a Juan)
3. Guarda

**Como Juan:**
1. Login como Juan
2. Ve a "Tareas"
3. ✅ **NO debería ver** la tarea (porque no está asignado)

**Como Admin (para forzar el test):**
1. Si quieres probar el mensaje de error
2. Temporalmente dale permisos de lectura a todos en RLS
3. Juan podrá ver la tarea pero no cambiar el estado
4. ❌ **Alert:** "No tienes permisos para cambiar el estado de esta tarea"

---

## 🔍 Debugging

### **Verificar Asignación:**

Abre la consola y ejecuta:

```tsx
// En checkIfAssigned(), agrega estos logs temporales:
console.log('👤 Current user:', profile.id);
console.log('📋 Task ID:', task.id);
console.log('🏢 User departments:', departmentIds);
console.log('✅ Direct assignment:', directAssignment);
console.log('🏢 Dept assignment:', deptAssignment);
console.log('🎯 Is assigned:', isAssigned);
```

Esto te mostrará exactamente por qué un usuario puede o no puede cambiar el estado.

---

### **Logs del Update:**

Cuando cambias el estado, deberías ver:

```
🔄 Updating task status to: in_progress
✅ Task status updated: {
  id: "uuid-de-la-tarea",
  status: "in_progress",
  title: "...",
  ...
}
```

Si ves un error:

```
❌ Error updating status: {
  message: "new row violates row-level security policy",
  code: "42501",
  ...
}
```

**Solución:** Significa que las políticas RLS están bloqueando el UPDATE. Verifica que:
1. El usuario está asignado
2. La política "Usuarios pueden actualizar estado de sus tareas" existe
3. La migración SQL se aplicó correctamente

---

## 📊 Arquitectura de Permisos

```
Usuario quiere cambiar estado de tarea
    ↓
¿Es admin?
    ├─ SÍ → ✅ Puede cambiar
    └─ NO → Verificar asignación
              ↓
          ¿Asignado directamente?
              ├─ SÍ → ✅ Puede cambiar
              └─ NO → ¿Pertenece a dept asignado?
                        ├─ SÍ → ✅ Puede cambiar
                        └─ NO → ❌ NO puede cambiar
```

---

## 📝 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `src/components/Tasks/TaskChat.tsx` | ✅ Textarea con `rows={2}` y `max-h-32` |
| `src/components/Tasks/TaskDetail.tsx` | ✅ `checkIfAssigned()` usa `user_departments` |
| `src/components/Tasks/TaskDetail.tsx` | ✅ `handleStatusChange()` con logs y validación |

---

## 🎨 Estilos del Textarea

```tsx
<textarea
  rows={2}                    // Altura inicial: 2 líneas
  className="
    flex-1                    // Ocupa espacio disponible
    px-4 py-2                 // Padding interno
    border border-gray-300    // Borde gris
    rounded-lg                // Esquinas redondeadas
    focus:ring-2              // Anillo al hacer focus
    focus:ring-indigo-500     // Color del anillo
    resize-none               // NO se puede redimensionar manualmente
    max-h-32                  // Altura máxima: 8rem (128px)
  "
/>
```

**Resultado:**
- Altura inicial: `~48px` (2 líneas)
- Altura máxima: `128px` (8rem)
- Scroll automático si el texto excede la altura máxima

---

## ✅ Checklist de Verificación

Después del fix, verifica:

- [ ] El textarea del chat tiene altura fija
- [ ] El textarea no crece indefinidamente
- [ ] Aparece scroll interno en el textarea si el texto es largo
- [ ] La interfaz del chat no se deforma
- [ ] Admin puede cambiar estado de cualquier tarea
- [ ] Usuario asignado puede cambiar estado de su tarea
- [ ] Usuario NO asignado NO puede cambiar estado
- [ ] Los logs aparecen en la consola al cambiar estado
- [ ] El mensaje de error es claro si no hay permisos

---

## 🚀 Resultado

Ahora:
- ✅ El chat tiene una interfaz **limpia y fija**
- ✅ El textarea **no se agranda** más allá de lo permitido
- ✅ Los usuarios asignados **pueden cambiar el estado**
- ✅ Los usuarios NO asignados **están bloqueados** correctamente
- ✅ Logs claros para **debugging**
- ✅ Mensajes de error **descriptivos**

**¡Recarga la aplicación y prueba ambos fixes!** 🎉





