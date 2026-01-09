# Instrucciones: Notificaciones de Nuevos Tickets para Área Soporte

## Descripción
Este sistema notifica automáticamente a todos los usuarios del área "Soporte" cuando se crea un nuevo ticket en el sistema.

## Instalación

### 1. Ejecutar la migración SQL
Ejecuta el archivo `20251205000002_notify_support_on_new_ticket.sql` en la consola SQL de Supabase:
- Ve a: https://supabase.com/dashboard/project/[TU_PROJECT_ID]/editor
- Copia y pega el contenido del archivo
- Ejecuta el script

### 2. Verificar que el departamento "Soporte" existe
Ejecuta esta consulta para verificar:

```sql
SELECT id, name FROM departments WHERE name = 'Soporte';
```

Si no existe, créalo:

```sql
INSERT INTO departments (name, description, color)
VALUES ('Soporte', 'Equipo de soporte técnico', '#F59E0B')
ON CONFLICT (name) DO NOTHING;
```

### 3. Verificar usuarios asignados al área Soporte
Ejecuta esta consulta para ver los usuarios del área Soporte:

```sql
SELECT 
  p.id, 
  p.full_name, 
  p.email,
  d.name as department_name
FROM profiles p
JOIN user_departments ud ON ud.user_id = p.id
JOIN departments d ON d.id = ud.department_id
WHERE d.name = 'Soporte';
```

Si no hay usuarios asignados, asigna usuarios al área Soporte:

```sql
-- Obtener el ID del departamento Soporte
SELECT id FROM departments WHERE name = 'Soporte';

-- Asignar un usuario al área Soporte (reemplaza USER_ID y ASSIGNED_BY_ID)
INSERT INTO user_departments (user_id, department_id, assigned_by)
VALUES (
  'USER_ID_AQUI',  -- ID del usuario a asignar
  (SELECT id FROM departments WHERE name = 'Soporte'),
  'ASSIGNED_BY_ID_AQUI'  -- ID del admin que hace la asignación
);
```

## Cómo funciona

1. **Detección de nuevo ticket**: Cuando se crea un ticket (INSERT en la tabla `tickets`), el trigger `trigger_notify_support_on_new_ticket` se ejecuta automáticamente.

2. **Búsqueda de usuarios**: La función busca todos los usuarios asignados al departamento "Soporte" a través de la tabla `user_departments`.

3. **Creación de notificaciones**: Para cada usuario del área Soporte (excepto el creador del ticket), se crea una notificación con:
   - Tipo: `ticket_created`
   - Título: "Nuevo ticket de soporte"
   - Mensaje: "[Nombre del creador] ha creado el ticket '[Título del ticket]'"
   - Metadata: Información del ticket (ID, título, categoría, prioridad, creador)

4. **Redirección**: Cuando un usuario hace clic en la notificación, es redirigido automáticamente al ticket específico.

## Notas importantes

- El creador del ticket NO recibe notificación (solo los usuarios del área Soporte)
- Solo se notifica a usuarios que están asignados al departamento "Soporte"
- Las notificaciones incluyen información completa del ticket en los metadatos
- El sistema funciona automáticamente, no requiere intervención manual

## Solución de problemas

### Las notificaciones no se crean
1. Verifica que la migración se ejecutó correctamente
2. Verifica que existe el departamento "Soporte":
   ```sql
   SELECT id, name FROM departments WHERE name = 'Soporte';
   ```
3. Verifica que hay usuarios asignados al área Soporte:
   ```sql
   SELECT COUNT(*) FROM user_departments 
   JOIN departments ON departments.id = user_departments.department_id 
   WHERE departments.name = 'Soporte';
   ```
4. Verifica que el trigger existe:
   ```sql
   SELECT trigger_name, event_manipulation, event_object_table 
   FROM information_schema.triggers 
   WHERE trigger_name = 'trigger_notify_support_on_new_ticket';
   ```

### Las notificaciones se crean pero no aparecen
1. Verifica que el tipo 'ticket_created' está en el CHECK constraint:
   ```sql
   SELECT constraint_name, check_clause 
   FROM information_schema.check_constraints 
   WHERE constraint_name = 'notifications_type_check';
   ```
2. Verifica que las notificaciones se están creando:
   ```sql
   SELECT * FROM notifications 
   WHERE type = 'ticket_created' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

### Probar manualmente
Para probar que funciona, crea un ticket de prueba y verifica las notificaciones:

```sql
-- Crear un ticket de prueba (reemplaza CREATED_BY_ID con un ID de usuario)
INSERT INTO tickets (title, description, category, priority, created_by)
VALUES (
  'Ticket de prueba',
  'Este es un ticket de prueba para verificar notificaciones',
  'Técnico',
  'medium',
  'CREATED_BY_ID_AQUI'
);

-- Verificar que se crearon las notificaciones
SELECT 
  n.*,
  p.full_name as usuario_notificado
FROM notifications n
JOIN profiles p ON p.id = n.user_id
WHERE n.type = 'ticket_created'
ORDER BY n.created_at DESC
LIMIT 10;
```


















