# Orden de Ejecución de Migraciones Multi-Tenant

## ⚠️ IMPORTANTE: Ejecuta las migraciones en este orden exacto

Las migraciones deben ejecutarse en el orden numérico de sus nombres de archivo. El orden es crítico porque cada migración depende de la anterior.

---

## 📋 Orden de Ejecución

### 1️⃣ **20250120000000_create_tenants_table.sql**
**¿Qué hace?**
- Crea la tabla `tenants` (empresas)
- Crea el tenant por defecto "EmaGroup" 
- Crea la función helper `get_user_tenant_id()`
- Configura políticas RLS básicas para tenants

**¿Por qué primero?**
- Es la base del sistema multi-tenant
- Todas las demás tablas necesitan referenciar esta tabla

**Tiempo estimado:** ~5 segundos

---

### 2️⃣ **20250120000001_add_tenant_to_profiles.sql**
**¿Qué hace?**
- Agrega columna `tenant_id` a la tabla `profiles`
- Migra todos los usuarios existentes al tenant "EmaGroup"
- Actualiza el trigger `handle_new_user()` para asignar tenant automáticamente
- Actualiza las políticas RLS de profiles para filtrar por tenant

**¿Por qué segundo?**
- Necesita que la tabla `tenants` exista (foreign key)
- Otras tablas referencian `profiles`, así que debe tener `tenant_id` antes

**Tiempo estimado:** ~10-30 segundos (depende de cantidad de usuarios)

---

### 3️⃣ **20250120000002_add_tenant_to_all_tables.sql**
**¿Qué hace?**
- Agrega columna `tenant_id` a TODAS las tablas del sistema:
  - tickets, ticket_comments
  - subforums, forum_threads, forum_messages
  - tasks, task_assignments, task_messages, task_attachments
  - departments, user_departments
  - time_entries
  - calendar_events
  - direct_messages, direct_message_attachments
  - social_posts, social_likes, social_comments, social_post_media
  - birthday_comments
  - notifications
  - vacations
  - library_folders, library_documents, library_courses, course_parts
  - professional_news
  - internal_policies
  - client_favorites, client_prices, vencimientos_clientes
  - client_drive_mapping
  - meeting_rooms, room_presence
  - department_forum_permissions
- Migra todos los datos existentes al tenant "EmaGroup"
- Crea índices en `tenant_id` para todas las tablas

**¿Por qué tercero?**
- Necesita que `profiles` tenga `tenant_id` (para migrar datos basándose en usuarios)
- Debe ejecutarse antes de actualizar las políticas RLS

**Tiempo estimado:** ~1-5 minutos (depende de cantidad de datos)

---

### 4️⃣ **20250120000003_update_rls_for_tenants.sql**
**¿Qué hace?**
- Elimina TODAS las políticas RLS antiguas
- Crea nuevas políticas RLS que incluyen filtro por `tenant_id`
- Garantiza aislamiento total: usuarios solo ven datos de su tenant
- Actualiza políticas para: tickets, subforums, tasks, departments, time_entries, calendar_events, direct_messages, social_posts, notifications, vacations, library, professional_news, internal_policies, y todas las demás tablas

**¿Por qué último?**
- Necesita que todas las tablas tengan `tenant_id` ya agregado
- Es la capa de seguridad final que garantiza el aislamiento

**Tiempo estimado:** ~30-60 segundos

---

## 🚀 Pasos para Ejecutar

### Opción 1: SQL Editor de Supabase (Recomendado)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com)
2. Abre el **SQL Editor** en el menú lateral
3. Ejecuta cada migración **una por una** en este orden:
   - Copia y pega el contenido de `20250120000000_create_tenants_table.sql`
   - Haz clic en **Run** o presiona `Ctrl+Enter`
   - Espera a que termine
   - Repite con `20250120000001_add_tenant_to_profiles.sql`
   - Repite con `20250120000002_add_tenant_to_all_tables.sql`
   - Repite con `20250120000003_update_rls_for_tenants.sql`

### Opción 2: Supabase CLI

Si usas Supabase CLI, las migraciones se ejecutarán automáticamente en orden:

```bash
cd project
supabase db push
```

---

## ✅ Verificación Post-Migración

Después de ejecutar todas las migraciones, verifica que:

1. **Tabla tenants existe:**
   ```sql
   SELECT * FROM tenants;
   ```
   Debe mostrar al menos un registro con name='EmaGroup'

2. **Profiles tiene tenant_id:**
   ```sql
   SELECT id, email, tenant_id FROM profiles LIMIT 5;
   ```
   Todos los registros deben tener `tenant_id` no nulo

3. **Otras tablas tienen tenant_id:**
   ```sql
   SELECT COUNT(*) FROM tickets WHERE tenant_id IS NULL;
   ```
   Debe retornar 0 (ningún ticket sin tenant_id)

4. **Políticas RLS actualizadas:**
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
   AND policyname LIKE '%tenant%'
   LIMIT 10;
   ```
   Debe mostrar políticas que incluyen filtros por tenant

---

## ⚠️ Advertencias

1. **NO ejecutes las migraciones en paralelo** - Deben ejecutarse secuencialmente
2. **Haz backup antes de ejecutar** - Aunque las migraciones son seguras, siempre es buena práctica
3. **Verifica después de cada migración** - Si una falla, no continúes con la siguiente
4. **Tiempo total estimado:** 2-10 minutos dependiendo del tamaño de tu base de datos

---

## 🔄 Si algo sale mal

Si una migración falla:

1. **NO ejecutes la siguiente migración**
2. Revisa el mensaje de error
3. Si es necesario, revierte manualmente los cambios de la migración que falló
4. Corrige el problema y vuelve a ejecutar esa migración
5. Solo entonces continúa con la siguiente

---

## 📝 Notas

- Las migraciones están diseñadas para ser **idempotentes** (puedes ejecutarlas múltiples veces sin problemas)
- Los datos existentes se migran automáticamente al tenant "EmaGroup"
- Los nuevos usuarios se asignarán al tenant especificado en su metadata o al tenant por defecto


