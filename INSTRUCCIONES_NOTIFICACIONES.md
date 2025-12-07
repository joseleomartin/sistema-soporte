# 🔔 Sistema de Notificaciones - Instrucciones de Instalación

## ✅ ¿Qué se ha implementado?

El sistema de notificaciones ahora incluye:

1. **Notificaciones de Eventos de Calendario**: Cuando un admin/soporte asigna un evento a un usuario
2. **Notificaciones de Comentarios en Tickets**: Cuando alguien comenta en un ticket
3. **Notificaciones de Cambio de Estado**: Cuando el estado de un ticket cambia

## 📋 Características

- ✨ **Iconos diferenciados** por tipo de notificación:
  - 📅 Calendario (azul) para eventos
  - 💬 Mensaje (verde) para comentarios
  - ⚠️ Alerta (naranja) para cambios de estado

- 🔴 **Contador de no leídas** en la campanita
- 🔔 **Notificaciones del navegador** (si el usuario da permiso)
- ⚡ **Tiempo real** usando Supabase Realtime
- 🎯 **Navegación inteligente**: Al hacer clic, te lleva al ticket o al calendario según corresponda

## 🚀 Pasos para Activar el Sistema

### 1. Ejecutar la Migración SQL

Ve a tu proyecto de Supabase:
1. Abre el **SQL Editor**
2. Copia y pega el contenido completo del archivo:
   ```
   project/supabase/migrations/20251112070000_create_notifications_system.sql
   ```
3. Haz clic en **"Run"**
4. Deberías ver: **"Success. No rows returned"**

### 2. Verificar que todo está correcto

Después de ejecutar la migración, verifica:

```sql
-- Verificar que la tabla existe
SELECT * FROM notifications LIMIT 1;

-- Verificar que los triggers están activos
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname LIKE 'trigger_notify%';
```

Deberías ver 3 triggers:
- `trigger_notify_ticket_comment`
- `trigger_notify_ticket_status_change`
- `trigger_notify_calendar_event`

### 3. Verificar Realtime

En el panel de Supabase, ve a **Database > Replication** y verifica que la tabla `notifications` está habilitada para Realtime.

## 🧪 Probar el Sistema

### Probar Notificaciones de Calendario:
1. Inicia sesión como **admin** o **soporte**
2. Ve al **Dashboard**
3. Crea un nuevo evento y asígnalo a otro usuario
4. Inicia sesión con ese usuario
5. Deberías ver una notificación en la campanita 🔔

### Probar Notificaciones de Tickets:
1. Crea un ticket como **usuario básico**
2. Inicia sesión como **soporte** o **admin**
3. Comenta en ese ticket
4. Vuelve a la cuenta del usuario básico
5. Deberías ver una notificación del comentario

### Probar Cambio de Estado:
1. Como **soporte/admin**, cambia el estado de un ticket
2. El creador del ticket recibirá una notificación

## 🎨 Interfaz de Usuario

La campanita ahora muestra:
- **Contador rojo** con el número de notificaciones no leídas
- **Dropdown** con todas las notificaciones
- **Iconos de colores** según el tipo
- **Título y mensaje** descriptivos
- **Fecha y hora** de cada notificación
- **Botón "Marcar todas como leídas"**

## 🔧 Funciones Automáticas

El sistema incluye triggers que crean notificaciones automáticamente cuando:

1. **Se crea un comentario en un ticket**:
   - Notifica al creador del ticket (si no es quien comentó)
   - Notifica al usuario asignado (si existe y no es quien comentó)

2. **Se cambia el estado de un ticket**:
   - Notifica al creador del ticket

3. **Se asigna un evento de calendario**:
   - Notifica al usuario asignado (solo si no es el creador)

## 🧹 Limpieza Automática (Opcional)

El sistema incluye una función para limpiar notificaciones leídas antiguas (más de 30 días):

```sql
-- Ejecutar manualmente cuando quieras limpiar
SELECT cleanup_old_notifications();
```

Para automatizar esto, puedes usar **pg_cron** en Supabase (requiere plan Pro):
```sql
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 2 * * 0', -- Cada domingo a las 2 AM
  'SELECT cleanup_old_notifications();'
);
```

## 🐛 Solución de Problemas

### Las notificaciones no aparecen:
1. Verifica que ejecutaste la migración SQL correctamente
2. Revisa que Realtime está habilitado para la tabla `notifications`
3. Abre la consola del navegador y busca errores

### Los triggers no funcionan:
```sql
-- Verificar que los triggers existen
SELECT * FROM pg_trigger WHERE tgname LIKE 'trigger_notify%';

-- Si no aparecen, vuelve a ejecutar la parte de triggers del script
```

### Error de permisos:
```sql
-- Verificar las políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'notifications';
```

## 📊 Estructura de la Tabla

```sql
notifications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  type text ('calendar_event' | 'ticket_comment' | 'ticket_status'),
  title text,
  message text,
  read boolean DEFAULT false,
  ticket_id uuid (opcional),
  event_id uuid (opcional),
  metadata jsonb (datos adicionales),
  created_at timestamptz
)
```

## ✨ ¡Listo!

Una vez ejecutada la migración, el sistema de notificaciones estará completamente funcional. Los usuarios recibirán notificaciones automáticamente cuando:
- Se les asigne un evento de calendario
- Alguien comente en sus tickets
- Cambien el estado de sus tickets

¡Disfruta de tu nuevo sistema de notificaciones! 🎉
















