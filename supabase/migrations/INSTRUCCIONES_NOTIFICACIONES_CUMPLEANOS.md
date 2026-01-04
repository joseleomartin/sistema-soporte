# Instrucciones: Notificaciones de Cumpleaños

## Descripción
Este sistema crea notificaciones automáticas para todos los usuarios cuando alguien cumple años. Las notificaciones aparecen en el panel de notificaciones y al hacer clic redirigen a la sección Social.

## Instalación

### 1. Ejecutar la migración SQL
Ejecuta el archivo `20251205000001_add_birthday_notifications.sql` en la consola SQL de Supabase:
- Ve a: https://supabase.com/dashboard/project/[TU_PROJECT_ID]/editor
- Copia y pega el contenido del archivo
- Ejecuta el script

### 2. Configurar ejecución automática diaria

Tienes dos opciones:

#### Opción A: Usar pg_cron (Recomendado)
Si tienes pg_cron instalado en Supabase, ejecuta esto en la consola SQL:

```sql
SELECT cron.schedule(
  'daily-birthday-notifications',
  '0 8 * * *',  -- Todos los días a las 8:00 AM UTC
  'SELECT create_birthday_notifications();'
);
```

Esto ejecutará la función automáticamente todos los días a las 8:00 AM UTC.

#### Opción B: Ejecutar manualmente
Si no tienes pg_cron, puedes ejecutar la función manualmente cada día:

```sql
SELECT create_birthday_notifications();
```

O configurar un cron job externo que llame a esta función a través de la API de Supabase.

### 3. Probar la función

Para probar que funciona correctamente:

```sql
-- Ver usuarios que cumplen años hoy
SELECT id, full_name, birthday
FROM profiles
WHERE birthday IS NOT NULL
  AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE);

-- Ejecutar la función manualmente
SELECT create_birthday_notifications();

-- Verificar que se crearon las notificaciones
SELECT 
  n.*,
  p.full_name as user_name,
  n.metadata->>'birthday_user_name' as birthday_person
FROM notifications n
JOIN profiles p ON p.id = n.user_id
WHERE n.type = 'birthday'
  AND DATE(n.created_at) = CURRENT_DATE
ORDER BY n.created_at DESC;
```

## Cómo funciona

1. **Detección de cumpleaños**: La función busca usuarios que cumplen años el día actual (mes y día coinciden con la fecha actual).

2. **Creación de notificaciones**: Para cada usuario que cumple años, se crea una notificación para todos los demás usuarios de la plataforma.

3. **Prevención de duplicados**: La función verifica que no exista ya una notificación de cumpleaños para ese usuario hoy, evitando duplicados.

4. **Redirección**: Cuando un usuario hace clic en la notificación, es redirigido automáticamente a la sección Social.

## Notas importantes

- Las notificaciones se crean solo una vez por día para cada cumpleaños
- El usuario que cumple años NO recibe notificación (solo los demás)
- Las notificaciones incluyen el nombre del usuario que cumple años
- El formato del mensaje es: "¡Es el cumpleaños de [Nombre]! 🎉"

## Solución de problemas

### Las notificaciones no se crean
1. Verifica que la migración se ejecutó correctamente
2. Verifica que hay usuarios con fecha de cumpleaños en la base de datos
3. Verifica que la función `create_birthday_notifications()` existe:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'create_birthday_notifications';
   ```

### Las notificaciones se crean duplicadas
- La función tiene protección contra duplicados, pero si ocurre, verifica que la condición de fecha en la función sea correcta

### No se puede ejecutar automáticamente
- Si no tienes pg_cron, considera usar un servicio externo como:
  - GitHub Actions (con cron schedule)
  - Vercel Cron Jobs
  - AWS Lambda con EventBridge
  - Cualquier servicio que pueda hacer llamadas HTTP a la API de Supabase














