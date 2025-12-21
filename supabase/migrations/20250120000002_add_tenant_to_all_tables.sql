-- ============================================
-- Agregar tenant_id a todas las tablas
-- ============================================
-- Esta migración agrega tenant_id a todas las tablas y migra datos existentes
-- Verifica si cada tabla existe antes de modificarla
-- ============================================

-- Obtener el ID del tenant por defecto (EmaGroup)
DO $$
DECLARE
  default_tenant_id uuid;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'emagroup' LIMIT 1;
  
  -- Si no existe el tenant, crear uno por defecto
  IF default_tenant_id IS NULL THEN
    INSERT INTO tenants (name, slug) VALUES ('EmaGroup', 'emagroup') RETURNING id INTO default_tenant_id;
  END IF;
  
  -- Función helper para agregar tenant_id a una tabla
  -- Se usa para cada tabla individualmente con verificación de existencia
  
  -- 1. TICKETS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE tickets SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE tickets ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);
  END IF;
  
  -- 2. TICKET_COMMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_comments') THEN
    ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE ticket_comments SET tenant_id = (
      SELECT t.tenant_id FROM tickets t WHERE t.id = ticket_comments.ticket_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE ticket_comments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_tenant_id ON ticket_comments(tenant_id);
  END IF;
  
  -- 3. SUBFORUMS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subforums') THEN
    ALTER TABLE subforums ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE subforums SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = subforums.created_by LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE subforums ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_subforums_tenant_id ON subforums(tenant_id);
  END IF;
  
  -- 4. SUBFORUM_PERMISSIONS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subforum_permissions') THEN
    ALTER TABLE subforum_permissions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE subforum_permissions SET tenant_id = (
      SELECT s.tenant_id FROM subforums s WHERE s.id = subforum_permissions.subforum_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE subforum_permissions ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_subforum_permissions_tenant_id ON subforum_permissions(tenant_id);
  END IF;
  
  -- 5. FORUM_THREADS (solo si la tabla existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forum_threads') THEN
    ALTER TABLE forum_threads ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE forum_threads SET tenant_id = (
      SELECT s.tenant_id FROM subforums s WHERE s.id = forum_threads.subforum_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE forum_threads ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_forum_threads_tenant_id ON forum_threads(tenant_id);
  END IF;
  
  -- 6. FORUM_MESSAGES (solo si la tabla existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forum_messages') THEN
    ALTER TABLE forum_messages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE forum_messages SET tenant_id = (
      SELECT s.tenant_id FROM subforums s WHERE s.id = forum_messages.subforum_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE forum_messages ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_forum_messages_tenant_id ON forum_messages(tenant_id);
  END IF;
  
  -- 7. TASKS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE tasks SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = tasks.created_by LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE tasks ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks(tenant_id);
  END IF;
  
  -- 8. TASK_ASSIGNMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_assignments') THEN
    ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE task_assignments SET tenant_id = (
      SELECT t.tenant_id FROM tasks t WHERE t.id = task_assignments.task_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE task_assignments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_task_assignments_tenant_id ON task_assignments(tenant_id);
  END IF;
  
  -- 9. TASK_MESSAGES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_messages') THEN
    ALTER TABLE task_messages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE task_messages SET tenant_id = (
      SELECT t.tenant_id FROM tasks t WHERE t.id = task_messages.task_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE task_messages ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_task_messages_tenant_id ON task_messages(tenant_id);
  END IF;
  
  -- 10. TASK_ATTACHMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_attachments') THEN
    ALTER TABLE task_attachments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE task_attachments SET tenant_id = (
      SELECT t.tenant_id FROM tasks t WHERE t.id = task_attachments.task_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE task_attachments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_task_attachments_tenant_id ON task_attachments(tenant_id);
  END IF;
  
  -- 11. DEPARTMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
    ALTER TABLE departments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE departments SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE departments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_departments_tenant_id ON departments(tenant_id);
    -- Eliminar constraint UNIQUE en name ya que ahora debe ser único por tenant
    -- Primero intentar eliminar como constraint, luego como índice
    ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
    DROP INDEX IF EXISTS departments_name_key;
    -- Crear nuevo índice único que incluye tenant_id
    CREATE UNIQUE INDEX IF NOT EXISTS departments_name_tenant_unique ON departments(name, tenant_id);
  END IF;
  
  -- 12. USER_DEPARTMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_departments') THEN
    ALTER TABLE user_departments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE user_departments SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = user_departments.user_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE user_departments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_user_departments_tenant_id ON user_departments(tenant_id);
  END IF;
  
  -- 13. TIME_ENTRIES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'time_entries') THEN
    ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE time_entries SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = time_entries.user_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE time_entries ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON time_entries(tenant_id);
  END IF;
  
  -- 14. CALENDAR_EVENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events') THEN
    ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE calendar_events SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = calendar_events.created_by LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE calendar_events ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_id ON calendar_events(tenant_id);
  END IF;
  
  -- 15. DIRECT_MESSAGES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'direct_messages') THEN
    ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE direct_messages SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = direct_messages.sender_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE direct_messages ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_direct_messages_tenant_id ON direct_messages(tenant_id);
  END IF;
  
  -- 16. DIRECT_MESSAGE_ATTACHMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'direct_message_attachments') THEN
    ALTER TABLE direct_message_attachments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE direct_message_attachments SET tenant_id = (
      SELECT dm.tenant_id FROM direct_messages dm WHERE dm.id = direct_message_attachments.message_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE direct_message_attachments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_direct_message_attachments_tenant_id ON direct_message_attachments(tenant_id);
  END IF;
  
  -- 17. SOCIAL_POSTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_posts') THEN
    ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE social_posts SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = social_posts.user_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE social_posts ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_social_posts_tenant_id ON social_posts(tenant_id);
  END IF;
  
  -- 18. SOCIAL_LIKES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_likes') THEN
    ALTER TABLE social_likes ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE social_likes SET tenant_id = (
      SELECT sp.tenant_id FROM social_posts sp WHERE sp.id = social_likes.post_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE social_likes ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_social_likes_tenant_id ON social_likes(tenant_id);
  END IF;
  
  -- 19. SOCIAL_COMMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_comments') THEN
    ALTER TABLE social_comments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE social_comments SET tenant_id = (
      SELECT sp.tenant_id FROM social_posts sp WHERE sp.id = social_comments.post_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE social_comments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_social_comments_tenant_id ON social_comments(tenant_id);
  END IF;
  
  -- 20. SOCIAL_POST_MEDIA
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'social_post_media') THEN
    ALTER TABLE social_post_media ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE social_post_media SET tenant_id = (
      SELECT sp.tenant_id FROM social_posts sp WHERE sp.id = social_post_media.post_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE social_post_media ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_social_post_media_tenant_id ON social_post_media(tenant_id);
  END IF;
  
  -- 21. BIRTHDAY_COMMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'birthday_comments') THEN
    ALTER TABLE birthday_comments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE birthday_comments SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = birthday_comments.birthday_user_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE birthday_comments ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_birthday_comments_tenant_id ON birthday_comments(tenant_id);
  END IF;
  
  -- 22. NOTIFICATIONS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE notifications SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = notifications.user_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE notifications ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
  END IF;
  
  -- 23. VACATIONS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vacations') THEN
    ALTER TABLE vacations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE vacations SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = vacations.user_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE vacations ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_vacations_tenant_id ON vacations(tenant_id);
  END IF;
  
  -- 24. LIBRARY_FOLDERS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_folders') THEN
    ALTER TABLE library_folders ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE library_folders SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = library_folders.created_by LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE library_folders ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_library_folders_tenant_id ON library_folders(tenant_id);
  END IF;
  
  -- 25. LIBRARY_DOCUMENTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_documents') THEN
    ALTER TABLE library_documents ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE library_documents SET tenant_id = (
      SELECT lf.tenant_id FROM library_folders lf WHERE lf.id = library_documents.folder_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE library_documents ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_library_documents_tenant_id ON library_documents(tenant_id);
  END IF;
  
  -- 26. LIBRARY_COURSES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_courses') THEN
    ALTER TABLE library_courses ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE library_courses SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = library_courses.created_by LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE library_courses ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_library_courses_tenant_id ON library_courses(tenant_id);
  END IF;
  
  -- 27. COURSE_PARTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_parts') THEN
    ALTER TABLE course_parts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE course_parts SET tenant_id = (
      SELECT lc.tenant_id FROM library_courses lc WHERE lc.id = course_parts.course_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE course_parts ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_course_parts_tenant_id ON course_parts(tenant_id);
  END IF;
  
  -- 28. PROFESSIONAL_NEWS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'professional_news') THEN
    ALTER TABLE professional_news ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE professional_news SET tenant_id = COALESCE((
      SELECT p.tenant_id FROM profiles p WHERE p.id = professional_news.created_by LIMIT 1
    ), default_tenant_id) WHERE tenant_id IS NULL;
    ALTER TABLE professional_news ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_professional_news_tenant_id ON professional_news(tenant_id);
  END IF;
  
  -- 29. INTERNAL_POLICIES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'internal_policies') THEN
    ALTER TABLE internal_policies ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE internal_policies SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = internal_policies.created_by LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE internal_policies ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_internal_policies_tenant_id ON internal_policies(tenant_id);
  END IF;
  
  -- 30. CLIENT_FAVORITES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_favorites') THEN
    ALTER TABLE client_favorites ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE client_favorites SET tenant_id = (
      SELECT s.tenant_id FROM subforums s WHERE s.id = client_favorites.subforum_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE client_favorites ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_client_favorites_tenant_id ON client_favorites(tenant_id);
  END IF;
  
  -- 31. CLIENT_PRICES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_prices') THEN
    ALTER TABLE client_prices ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE client_prices SET tenant_id = (
      SELECT s.tenant_id FROM subforums s WHERE s.id = client_prices.client_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE client_prices ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_client_prices_tenant_id ON client_prices(tenant_id);
  END IF;
  
  -- 32. VENCIMIENTOS_CLIENTES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vencimientos_clientes') THEN
    ALTER TABLE vencimientos_clientes ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE vencimientos_clientes SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = vencimientos_clientes.user_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE vencimientos_clientes ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_vencimientos_clientes_tenant_id ON vencimientos_clientes(tenant_id);
  END IF;
  
  -- 33. CLIENT_DRIVE_MAPPING
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_drive_mapping') THEN
    ALTER TABLE client_drive_mapping ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE client_drive_mapping SET tenant_id = (
      SELECT s.tenant_id FROM subforums s WHERE s.id = client_drive_mapping.subforum_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE client_drive_mapping ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_client_drive_mapping_tenant_id ON client_drive_mapping(tenant_id);
  END IF;
  
  -- 34. MEETING_ROOMS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meeting_rooms') THEN
    ALTER TABLE meeting_rooms ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE meeting_rooms SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = meeting_rooms.created_by LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE meeting_rooms ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_meeting_rooms_tenant_id ON meeting_rooms(tenant_id);
  END IF;
  
  -- 35. ROOM_PRESENCE
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'room_presence') THEN
    ALTER TABLE room_presence ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE room_presence SET tenant_id = (
      SELECT mr.tenant_id FROM meeting_rooms mr WHERE mr.id = room_presence.room_id LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE room_presence ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_room_presence_tenant_id ON room_presence(tenant_id);
  END IF;
  
  -- 36. FORUMS (tabla padre de subforums, si existe) - DEBE IR ANTES de department_forum_permissions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forums') THEN
    ALTER TABLE forums ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE forums SET tenant_id = (
      SELECT p.tenant_id FROM profiles p WHERE p.id = forums.created_by LIMIT 1
    ) WHERE tenant_id IS NULL;
    ALTER TABLE forums ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_forums_tenant_id ON forums(tenant_id);
  END IF;
  
  -- 37. DEPARTMENT_FORUM_PERMISSIONS (después de forums para poder usar forums.tenant_id)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'department_forum_permissions') THEN
    ALTER TABLE department_forum_permissions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    -- Si forums tiene tenant_id, usarlo; si no, usar el tenant_id del usuario que otorgó el permiso
    UPDATE department_forum_permissions SET tenant_id = COALESCE((
      SELECT f.tenant_id FROM forums f WHERE f.id = department_forum_permissions.forum_id LIMIT 1
    ), (
      SELECT p.tenant_id FROM profiles p WHERE p.id = department_forum_permissions.granted_by LIMIT 1
    )) WHERE tenant_id IS NULL;
    ALTER TABLE department_forum_permissions ALTER COLUMN tenant_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_department_forum_permissions_tenant_id ON department_forum_permissions(tenant_id);
  END IF;
  
END $$;
