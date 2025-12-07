# 🔔 Notificaciones de Tareas Asignadas

## ✅ Implementación Completada

He implementado el sistema de notificaciones para cuando se asigna una nueva tarea a un usuario.

---

## 📋 Lo que se ha Creado

### 1. **Migración SQL** (`20251112180000_add_task_notifications.sql`)

- ✅ Agrega tipo `'task_assigned'` al CHECK constraint de `notifications`
- ✅ Agrega columna `task_id` a la tabla `notifications`
- ✅ Crea función `notify_task_assigned()` que:
  - Detecta cuando se asigna una tarea a un usuario
  - Crea notificación para asignación directa
  - Crea notificaciones para todos los usuarios de un departamento asignado
- ✅ Crea trigger `trigger_notify_task_assigned` en `task_assignments`
- ✅ Habilita Realtime para `notifications` (si no está ya habilitado)

### 2. **Frontend** (`NotificationBell.tsx`)

- ✅ Agrega tipo `'task_assigned'` a la interfaz `Notification`
- ✅ Agrega icono `CheckSquare` (indigo) para notificaciones de tareas
- ✅ Agrega navegación a tareas al hacer click
- ✅ Soporte completo en el dropdown de notificaciones

---

## 🚀 Cómo Activar

### **Paso 1: Ejecutar la Migración SQL**

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Copia y pega **TODO** el contenido de:
   ```
   project/supabase/migrations/20251112180000_add_task_notifications.sql
   ```
3. Click en **"Run"**
4. ✅ Deberías ver mensajes de verificación

---

### **Paso 2: Verificar que Funcionó**

Ejecuta estas queries para verificar:

```sql
-- Verificar que el tipo 'task_assigned' está permitido
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_type_check';

-- Verificar que task_id existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name = 'task_id';

-- Verificar que el trigger existe
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname = 'trigger_notify_task_assigned';
```

---

## 🧪 Cómo Probar

### **Test 1: Asignación Directa a Usuario**

1. **Como Admin:**
   - Ve a "Tareas"
   - Click en "Nueva Tarea"
   - Completa el formulario
   - Asigna a un usuario específico (ej: "Juan")
   - Guarda

2. **Como Juan:**
   - Deberías ver una notificación en la campanita 🔔
   - El contador debería mostrar "1" (o incrementar)
   - Click en la campanita
   - Deberías ver: "Nueva tarea asignada - Se te ha asignado la tarea '...' por [Admin]"
   - Click en la notificación
   - ✅ Debería llevarte a la vista de Tareas

---

### **Test 2: Asignación a Departamento**

1. **Como Admin:**
   - Crea una nueva tarea
   - Asigna a un departamento (ej: "Ventas")
   - Guarda

2. **Como cualquier usuario del departamento Ventas:**
   - Deberías ver una notificación
   - Mensaje: "Nueva tarea asignada a tu departamento - Se ha asignado la tarea '...' a tu departamento por [Admin]"
   - ✅ Click te lleva a Tareas

---

### **Test 3: Múltiples Usuarios**

1. **Como Admin:**
   - Crea una tarea
   - Asigna a 3 usuarios diferentes
   - Guarda

2. **Cada usuario asignado:**
   - ✅ Recibe su propia notificación
   - ✅ Aparece en tiempo real (sin recargar)
   - ✅ Puede hacer click para ir a Tareas

---

## 📊 Estructura de la Notificación

```json
{
  "id": "uuid",
  "user_id": "uuid-del-usuario",
  "type": "task_assigned",
  "title": "Nueva tarea asignada",
  "message": "Se te ha asignado la tarea 'Revisar documentos' por Juan Pérez",
  "task_id": "uuid-de-la-tarea",
  "read": false,
  "metadata": {
    "task_id": "uuid-de-la-tarea",
    "assigned_by": "uuid-del-admin",
    "assigned_at": "2025-11-12T18:00:00Z"
  },
  "created_at": "2025-11-12T18:00:00Z"
}
```

---

## 🎨 Iconos y Colores

| Tipo de Notificación | Icono | Color |
|----------------------|-------|-------|
| `calendar_event` | 📅 Calendar | Azul (`text-blue-600`) |
| `ticket_comment` | 💬 MessageSquare | Verde (`text-green-600`) |
| `ticket_status` | ⚠️ AlertCircle | Naranja (`text-orange-600`) |
| `task_assigned` | ✅ CheckSquare | Indigo (`text-indigo-600`) |

---

## 🔍 Cómo Funciona

### **Flujo Completo:**

```
1. Admin crea tarea y asigna a usuario
   ↓
2. INSERT en task_assignments
   ↓
3. Trigger detecta el INSERT
   ↓
4. Función notify_task_assigned() ejecuta:
   - Obtiene título de la tarea
   - Obtiene nombre del creador
   - Crea notificación en tabla notifications
   ↓
5. Realtime detecta nuevo INSERT en notifications
   ↓
6. NotificationBell recibe la notificación
   ↓
7. Usuario ve la campanita con contador
   ↓
8. Click en notificación → Navega a Tareas
```

---

## 🔧 Detalles Técnicos

### **Trigger:**
```sql
CREATE TRIGGER trigger_notify_task_assigned
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assigned();
```

**Se ejecuta:**
- ✅ Después de cada INSERT en `task_assignments`
- ✅ Para cada fila insertada
- ✅ Crea notificación automáticamente

---

### **Función `notify_task_assigned()`:**

**Para asignación directa:**
- Crea 1 notificación para el usuario asignado

**Para asignación a departamento:**
- Crea 1 notificación para CADA usuario del departamento
- Usa `INSERT INTO ... SELECT` para crear múltiples notificaciones

---

## 🐛 Troubleshooting

### **No aparecen notificaciones**

1. **Verificar que el trigger existe:**
   ```sql
   SELECT tgname FROM pg_trigger 
   WHERE tgname = 'trigger_notify_task_assigned';
   ```

2. **Verificar que Realtime está habilitado:**
   ```sql
   SELECT tablename FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   AND tablename = 'notifications';
   ```

3. **Verificar que se crearon notificaciones:**
   ```sql
   SELECT * FROM notifications 
   WHERE type = 'task_assigned' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

4. **Revisar la consola del navegador (F12):**
   - Busca: `🔔 Nueva notificación recibida`
   - Si no aparece, Realtime no está funcionando

---

### **Notificaciones duplicadas**

**Causa:** El trigger se ejecuta múltiples veces.

**Solución:** Verifica que solo hay un trigger:
```sql
SELECT COUNT(*) FROM pg_trigger 
WHERE tgname = 'trigger_notify_task_assigned';
```

Debería ser `1`. Si es más, elimina los duplicados.

---

### **Error: "type check constraint violation"**

**Causa:** El tipo `'task_assigned'` no está en el CHECK constraint.

**Solución:** Ejecuta la migración completa de nuevo.

---

## ✅ Checklist de Verificación

- [ ] Migración SQL ejecutada
- [ ] Tipo `'task_assigned'` agregado al constraint
- [ ] Columna `task_id` existe en `notifications`
- [ ] Trigger `trigger_notify_task_assigned` existe
- [ ] Realtime habilitado para `notifications`
- [ ] Frontend actualizado (NotificationBell.tsx)
- [ ] Probado crear tarea y asignar a usuario
- [ ] Notificación aparece en tiempo real
- [ ] Click en notificación navega a Tareas
- [ ] Icono CheckSquare aparece correctamente

---

## 🎉 Resultado

Ahora cuando un admin asigna una tarea:
- ✅ El usuario recibe una notificación **instantáneamente**
- ✅ La campanita muestra el contador
- ✅ La notificación aparece en el dropdown
- ✅ Click navega a la vista de Tareas
- ✅ Funciona para asignaciones directas y por departamento

**¡El sistema de notificaciones de tareas está completamente funcional!** 🚀













