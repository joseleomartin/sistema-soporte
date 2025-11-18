# 📝 Guía: Sistema de @Mentions en Chat de Clientes

## ✅ Implementación Completada

Se ha implementado un sistema completo de **@mentions** en el chat de clientes (SubforumChat) que permite etiquetar usuarios y notificarles automáticamente.

---

## 🎯 Características Implementadas

### 1. **Autocompletado de Usuarios**
- Al escribir `@` en el chat, aparece un autocompletado con usuarios disponibles
- Solo muestra usuarios que tienen acceso al subforo/cliente
- Búsqueda en tiempo real por nombre o email
- Navegación con teclado (flechas arriba/abajo, Enter, Escape)

### 2. **Detección Automática de Menciones**
- Detecta `@` mientras se escribe
- Muestra el autocompletado automáticamente
- Cierra el autocompletado al escribir espacio o nueva línea

### 3. **Formato de Menciones**
- Las menciones se guardan en formato: `@[Nombre Usuario](user_id)`
- Permite extraer los user_ids para crear notificaciones
- Mantiene el nombre legible en el mensaje

### 4. **Resaltado Visual**
- Las menciones se muestran con estilo especial:
  - Color azul (`text-blue-600`)
  - Fondo azul claro (`bg-blue-50`)
  - Fuente en negrita
  - Bordes redondeados

### 5. **Notificaciones Automáticas**
- Al enviar un mensaje con menciones, se crean notificaciones automáticamente
- Cada usuario mencionado recibe una notificación
- La notificación incluye:
  - Título: "Fuiste mencionado en el chat de [Nombre Cliente]"
  - Mensaje: "[Usuario] te mencionó: [preview del mensaje]"
  - Link al subforo/cliente

### 6. **Navegación desde Notificaciones**
- Al hacer clic en una notificación de mención, navega al chat del cliente
- Icono especial (morado) para distinguir menciones de otros tipos

---

## 📋 Archivos Modificados/Creados

### 1. **`supabase/migrations/20251112200000_add_forum_mention_notifications.sql`**

#### Cambios Realizados:

**a) Agregar tipo 'forum_mention':**
```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('calendar_event', 'ticket_comment', 'ticket_status', 'task_assigned', 'forum_mention'));
```

**b) Agregar columna subforum_id:**
```sql
ALTER TABLE notifications ADD COLUMN subforum_id UUID REFERENCES subforums(id) ON DELETE CASCADE;
```

**c) Función para crear notificaciones:**
```sql
CREATE OR REPLACE FUNCTION create_forum_mention_notifications(
  p_subforum_id UUID,
  p_mentioned_user_ids UUID[],
  p_mentioner_id UUID,
  p_message_preview TEXT
)
RETURNS void AS $$
-- Crea notificaciones para cada usuario mencionado
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**d) Función para obtener usuarios con acceso:**
```sql
CREATE OR REPLACE FUNCTION get_subforum_accessible_users(p_subforum_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  avatar_url TEXT
) AS $$
-- Retorna usuarios que tienen acceso al subforo
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 2. **`src/components/Forums/MentionAutocomplete.tsx`** (NUEVO)

#### Componente de Autocompletado:

- Muestra lista de usuarios disponibles
- Búsqueda en tiempo real
- Navegación con teclado
- Selección con click o Enter
- Muestra avatar, nombre, email y rol

---

### 3. **`src/components/Forums/SubforumChat.tsx`**

#### Cambios Realizados:

**a) Detección de @:**
```typescript
onChange={(e) => {
  const textBeforeCursor = value.substring(0, cursorPos);
  const lastAtIndex = textBeforeCursor.lastIndexOf('@');
  
  if (lastAtIndex !== -1) {
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
      setShowMentionAutocomplete(true);
      setMentionSearchTerm(textAfterAt);
    }
  }
}}
```

**b) Formateo de menciones:**
```typescript
const formatMentions = (text: string): string => {
  // Reemplaza @Nombre Usuario con @[Nombre Usuario](user_id)
  mentionedUsers.forEach((user, userId) => {
    formatted = formatted.replace(
      new RegExp(`@${user.full_name}`, 'gi'),
      `@[${user.full_name}](${userId})`
    );
  });
  return formatted;
};
```

**c) Extracción de menciones:**
```typescript
const extractMentions = (text: string): string[] => {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const userIds: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    userIds.push(match[2]); // user_id
  }
  return [...new Set(userIds)]; // Sin duplicados
};
```

**d) Renderizado con resaltado:**
```typescript
const renderMessageWithMentions = (content: string) => {
  // Parsea el mensaje y resalta las menciones
  parts.push(
    <span className="text-blue-600 font-medium bg-blue-50 px-1 rounded">
      @{match[1]}
    </span>
  );
};
```

**e) Creación de notificaciones:**
```typescript
const mentionedUserIds = extractMentions(formattedMessage);
if (mentionedUserIds.length > 0) {
  await supabase.rpc('create_forum_mention_notifications', {
    p_subforum_id: subforumId,
    p_mentioned_user_ids: mentionedUserIds,
    p_mentioner_id: profile.id,
    p_message_preview: messagePreview,
  });
}
```

---

### 4. **`src/components/Notifications/NotificationBell.tsx`**

#### Cambios Realizados:

**a) Agregar tipo 'forum_mention':**
```typescript
type: 'calendar_event' | 'ticket_comment' | 'ticket_status' | 'task_assigned' | 'forum_mention';
subforum_id?: string;
```

**b) Navegación al foro:**
```typescript
else if (notification.type === 'forum_mention' && notification.subforum_id) {
  if (onNavigateToForum) {
    onNavigateToForum(notification.subforum_id);
  }
}
```

**c) Icono especial:**
```typescript
case 'forum_mention':
  return <MessageSquare className="w-5 h-5 text-purple-600" />;
```

---

## 🚀 Cómo Aplicar los Cambios

### Paso 1: Ejecutar Migración SQL

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Ejecuta la migración:
   ```sql
   -- Copia el contenido de:
   -- supabase/migrations/20251112200000_add_forum_mention_notifications.sql
   ```

O ejecuta directamente:

```sql
-- 1. Agregar tipo 'forum_mention'
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('calendar_event', 'ticket_comment', 'ticket_status', 'task_assigned', 'forum_mention'));

-- 2. Agregar columna subforum_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'subforum_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN subforum_id UUID REFERENCES subforums(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_subforum_id ON notifications(subforum_id);
  END IF;
END $$;

-- 3. Crear función para notificaciones
-- (Ver archivo completo para la función completa)

-- 4. Crear función para obtener usuarios
-- (Ver archivo completo para la función completa)
```

### Paso 2: Verificar Funcionalidad

1. Abre un chat de cliente (subforo)
2. Escribe `@` en el campo de mensaje
3. Deberías ver el autocompletado con usuarios disponibles
4. Selecciona un usuario (click o Enter)
5. Envía el mensaje
6. El usuario mencionado debería recibir una notificación

---

## 🎨 Formato de Menciones

### En el Mensaje:
```
@Juan Pérez Hola, necesito tu ayuda con esto
```

### Almacenado en Base de Datos:
```
@[Juan Pérez](user-id-uuid) Hola, necesito tu ayuda con esto
```

### Mostrado en el Chat:
```
@Juan Pérez Hola, necesito tu ayuda con esto
```
(Donde `@Juan Pérez` está resaltado en azul)

---

## 🔍 Verificar que Funciona

### En la Consola del Navegador:

Cuando escribes `@`, deberías ver:
- El autocompletado aparecer
- Logs de búsqueda de usuarios (si hay errores)

Cuando envías un mensaje con menciones:
- No debería haber errores en la consola
- Las notificaciones deberían crearse automáticamente

### En Supabase:

1. Ve a **Table Editor** → **notifications**
2. Busca notificaciones con `type = 'forum_mention'`
3. Verifica que `subforum_id` esté correcto
4. Verifica que `user_id` corresponda al usuario mencionado

---

## ⚠️ Solución de Problemas

### Problema: El autocompletado no aparece

**Solución 1: Verificar función SQL**
```sql
-- Probar la función manualmente
SELECT * FROM get_subforum_accessible_users('subforum-id'::uuid);
```

**Solución 2: Verificar permisos**
- Asegúrate de que el usuario tenga acceso al subforo
- Verifica las políticas RLS en `subforum_permissions` y `department_forum_permissions`

**Solución 3: Verificar en consola**
- Abre la consola del navegador (F12)
- Busca errores relacionados con `get_subforum_accessible_users`

### Problema: Las notificaciones no se crean

**Solución 1: Verificar función RPC**
```sql
-- Probar la función manualmente
SELECT create_forum_mention_notifications(
  'subforum-id'::uuid,
  ARRAY['user-id'::uuid],
  'mentioner-id'::uuid,
  'Preview del mensaje...'
);
```

**Solución 2: Verificar formato de menciones**
- Asegúrate de que el mensaje tenga el formato correcto: `@[Nombre](user_id)`
- Verifica que `extractMentions` esté extrayendo correctamente los user_ids

**Solución 3: Verificar permisos RLS**
- La función usa `SECURITY DEFINER`, pero verifica que no haya políticas bloqueando

### Problema: Las menciones no se resaltan

**Solución:**
- Verifica que `renderMessageWithMentions` esté siendo llamado
- Asegúrate de que el formato del mensaje sea correcto: `@[Nombre](user_id)`
- Revisa la consola del navegador para errores de renderizado

---

## 📊 Flujo de Datos

```
Usuario escribe @
    ↓
Detección de @ en onChange
    ↓
Mostrar MentionAutocomplete
    ↓
Usuario selecciona usuario
    ↓
Insertar @Nombre Usuario en texto
    ↓
Usuario envía mensaje
    ↓
Formatear menciones: @[Nombre](user_id)
    ↓
Insertar mensaje en forum_messages
    ↓
Extraer user_ids de menciones
    ↓
Llamar create_forum_mention_notifications
    ↓
Crear notificaciones para cada usuario
    ↓
Usuarios reciben notificaciones ✅
```

---

## 🎯 Mejoras Futuras (Opcional)

1. **Menciones múltiples en una línea**
   - Ya soportado, pero se puede mejorar la UI

2. **Historial de menciones**
   - Mostrar usuarios mencionados recientemente primero

3. **Notificaciones push**
   - Integrar con servicio de push notifications

4. **Menciones en edición**
   - Permitir editar menciones en mensajes existentes

5. **Búsqueda mejorada**
   - Búsqueda por departamento, rol, etc.

---

## ✅ Checklist de Implementación

- [x] Migración SQL creada
- [x] Tipo 'forum_mention' agregado
- [x] Columna subforum_id agregada
- [x] Función create_forum_mention_notifications creada
- [x] Función get_subforum_accessible_users creada
- [x] Componente MentionAutocomplete creado
- [x] Detección de @ implementada
- [x] Autocompletado integrado
- [x] Formateo de menciones implementado
- [x] Extracción de menciones implementada
- [x] Resaltado visual implementado
- [x] Creación de notificaciones implementada
- [x] Navegación desde notificaciones implementada
- [x] Icono especial para menciones agregado

---

**¡El sistema de @mentions está completamente implementado! 🎉**

Ahora los usuarios pueden mencionar a otros en el chat de clientes y recibirán notificaciones automáticamente.



