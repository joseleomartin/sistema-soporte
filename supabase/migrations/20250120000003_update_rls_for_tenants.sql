-- ============================================
-- Actualizar TODAS las políticas RLS para aislamiento por tenant
-- ============================================
-- CRÍTICO: Esta migración garantiza que ningún usuario pueda ver datos de otros tenants
-- ============================================

-- ============================================
-- 1. TICKETS
-- ============================================

-- Eliminar políticas antiguas y nuevas (por si la migración se ejecutó parcialmente)
DROP POLICY IF EXISTS "Users can view own tickets, support and admin view all" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Support and admin can update tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view tickets from own tenant" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets in own tenant" ON tickets;
DROP POLICY IF EXISTS "Support and admin can update tickets in own tenant" ON tickets;

-- Nuevas políticas con tenant_id
CREATE POLICY "Users can view tickets from own tenant"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

CREATE POLICY "Users can create tickets in own tenant"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Support and admin can update tickets in own tenant"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 2. TICKET_COMMENTS
-- ============================================

DROP POLICY IF EXISTS "Users can view comments on own tickets, support and admin view all" ON ticket_comments;
DROP POLICY IF EXISTS "Users can comment on own tickets" ON ticket_comments;
DROP POLICY IF EXISTS "Support and admin can comment on any ticket" ON ticket_comments;
DROP POLICY IF EXISTS "Users can view ticket comments from own tenant" ON ticket_comments;
DROP POLICY IF EXISTS "Users can comment on tickets in own tenant" ON ticket_comments;

CREATE POLICY "Users can view ticket comments from own tenant"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      EXISTS (
        SELECT 1 FROM tickets
        WHERE tickets.id = ticket_comments.ticket_id
        AND tickets.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

CREATE POLICY "Users can comment on tickets in own tenant"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

-- ============================================
-- 3. SUBFORUMS
-- ============================================

DROP POLICY IF EXISTS "Users can view subforums they have access to" ON subforums;
DROP POLICY IF EXISTS "Users can create subforums" ON subforums;
DROP POLICY IF EXISTS "Admins can update subforums" ON subforums;
DROP POLICY IF EXISTS "Users can view subforums from own tenant" ON subforums;
DROP POLICY IF EXISTS "Users can create subforums in own tenant" ON subforums;
DROP POLICY IF EXISTS "Admins can update subforums in own tenant" ON subforums;

CREATE POLICY "Users can view subforums from own tenant"
  ON subforums FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      EXISTS (
        SELECT 1 FROM subforum_permissions
        WHERE subforum_permissions.subforum_id = subforums.id
        AND subforum_permissions.user_id = auth.uid()
        AND subforum_permissions.can_view = true
        AND subforum_permissions.tenant_id = get_user_tenant_id()
      )
      OR EXISTS (
        SELECT 1 FROM department_forum_permissions dfp
        JOIN user_departments ud ON ud.department_id = dfp.department_id
        JOIN forums f ON f.id = dfp.forum_id
        WHERE f.id = subforums.forum_id
        AND ud.user_id = auth.uid()
        AND dfp.can_view = true
        AND dfp.tenant_id = get_user_tenant_id()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

CREATE POLICY "Users can create subforums in own tenant"
  ON subforums FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update subforums in own tenant"
  ON subforums FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 4. SUBFORUM_PERMISSIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view subforum permissions" ON subforum_permissions;
DROP POLICY IF EXISTS "Admins can manage subforum permissions" ON subforum_permissions;
DROP POLICY IF EXISTS "Users can view subforum permissions from own tenant" ON subforum_permissions;
DROP POLICY IF EXISTS "Admins can manage subforum permissions in own tenant" ON subforum_permissions;

CREATE POLICY "Users can view subforum permissions from own tenant"
  ON subforum_permissions FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage subforum permissions in own tenant"
  ON subforum_permissions FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 5. FORUM_THREADS (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forum_threads') THEN
    DROP POLICY IF EXISTS "Users can view threads in accessible subforums" ON forum_threads;
    DROP POLICY IF EXISTS "Users can create threads" ON forum_threads;
    DROP POLICY IF EXISTS "Users can update own threads" ON forum_threads;

    CREATE POLICY "Users can view forum threads from own tenant"
      ON forum_threads FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM subforums s
          WHERE s.id = forum_threads.subforum_id
          AND s.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Users can create forum threads in own tenant"
      ON forum_threads FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      );

    CREATE POLICY "Users can update own forum threads in own tenant"
      ON forum_threads FOR UPDATE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      );
  END IF;
END $$;

-- ============================================
-- 6. FORUM_MESSAGES (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'forum_messages') THEN
    DROP POLICY IF EXISTS "Users can view messages in accessible threads" ON forum_messages;
    DROP POLICY IF EXISTS "Users can view messages in accessible subforums" ON forum_messages;
    DROP POLICY IF EXISTS "Users can create messages" ON forum_messages;
    DROP POLICY IF EXISTS "Users can post messages in subforums" ON forum_messages;
    DROP POLICY IF EXISTS "Users can update own messages" ON forum_messages;
    DROP POLICY IF EXISTS "Users can view forum messages from own tenant" ON forum_messages;
    DROP POLICY IF EXISTS "Users can create forum messages in own tenant" ON forum_messages;
    DROP POLICY IF EXISTS "Users can update own forum messages in own tenant" ON forum_messages;

    CREATE POLICY "Users can view forum messages from own tenant"
      ON forum_messages FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM subforums s
          WHERE s.id = forum_messages.subforum_id
          AND s.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Users can create forum messages in own tenant"
      ON forum_messages FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      );

    CREATE POLICY "Users can update own forum messages in own tenant"
      ON forum_messages FOR UPDATE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      );
  END IF;
END $$;

-- ============================================
-- 7. TASKS
-- ============================================

DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden actualizar estado de sus tareas" ON tasks;
DROP POLICY IF EXISTS "Admins can update any task" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden ver tareas de equipo y sus personales" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden actualizar tareas de equipo y sus personales" ON tasks;
DROP POLICY IF EXISTS "Administradores pueden eliminar tareas de equipo y sus personales" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden crear tareas personales" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden ver sus tareas personales" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus tareas personales" ON tasks;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus tareas personales" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks from own tenant" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in own tenant" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in own tenant" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in own tenant" ON tasks;

-- Política para ver tareas: 
-- - Tareas personales: SOLO el creador puede verlas (incluso admins no pueden ver personales de otros)
-- - Tareas de equipo: según asignaciones o admin del tenant
CREATE POLICY "Users can view tasks from own tenant"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      -- Tareas personales: SOLO el creador puede verlas (nadie más, ni siquiera admins)
      (COALESCE(tasks.is_personal, false) = true AND created_by = auth.uid())
      OR
      -- Tareas de equipo (is_personal = false o NULL): según asignaciones o si es admin
      (COALESCE(tasks.is_personal, false) = false AND (
        -- Si el usuario las creó
        created_by = auth.uid()
        OR
        -- Si está asignado directamente
        EXISTS (
          SELECT 1 FROM task_assignments
          WHERE task_assignments.task_id = tasks.id
          AND task_assignments.assigned_to_user = auth.uid()
          AND task_assignments.tenant_id = get_user_tenant_id()
        )
        OR
        -- Si pertenece a un departamento asignado
        EXISTS (
          SELECT 1 FROM task_assignments ta
          JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
          WHERE ta.task_id = tasks.id
          AND ud.user_id = auth.uid()
          AND ta.tenant_id = get_user_tenant_id()
        )
        OR
        -- Admins: solo pueden ver tareas de equipo (NO personales de otros)
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      ))
    )
  );

CREATE POLICY "Users can create tasks in own tenant"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update tasks in own tenant"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      -- Tareas personales: solo el creador puede actualizarlas
      (COALESCE(tasks.is_personal, false) = true AND created_by = auth.uid())
      OR
      -- Tareas de equipo: si está asignado directamente
      (COALESCE(tasks.is_personal, false) = false AND EXISTS (
        SELECT 1 FROM task_assignments
        WHERE task_assignments.task_id = tasks.id
        AND task_assignments.assigned_to_user = auth.uid()
        AND task_assignments.tenant_id = get_user_tenant_id()
      ))
      OR
      -- Tareas de equipo: si pertenece a un departamento asignado
      (COALESCE(tasks.is_personal, false) = false AND EXISTS (
        SELECT 1 FROM task_assignments ta
        JOIN user_departments ud ON ud.department_id = ta.assigned_to_department
        WHERE ta.task_id = tasks.id
        AND ud.user_id = auth.uid()
        AND ta.tenant_id = get_user_tenant_id()
      ))
      OR
      -- Admins: solo pueden actualizar tareas de equipo (no personales de otros)
      (COALESCE(tasks.is_personal, false) = false AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.tenant_id = get_user_tenant_id()
      ))
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
  );

-- Política para eliminar tareas
CREATE POLICY "Users can delete tasks in own tenant"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      -- Tareas personales: solo el creador puede eliminarlas
      (COALESCE(tasks.is_personal, false) = true AND created_by = auth.uid())
      OR
      -- Admins: solo pueden eliminar tareas de equipo (no personales de otros)
      (COALESCE(tasks.is_personal, false) = false AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.tenant_id = get_user_tenant_id()
      ))
    )
  );

-- ============================================
-- 8. TASK_ASSIGNMENTS
-- ============================================

DROP POLICY IF EXISTS "Users can view task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admins can manage task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Users can view task assignments from own tenant" ON task_assignments;
DROP POLICY IF EXISTS "Admins can manage task assignments in own tenant" ON task_assignments;

CREATE POLICY "Users can view task assignments from own tenant"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage task assignments in own tenant"
  ON task_assignments FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 9. DEPARTMENTS
-- ============================================

DROP POLICY IF EXISTS "Everyone can view departments" ON departments;
DROP POLICY IF EXISTS "Only admins can create departments" ON departments;
DROP POLICY IF EXISTS "Only admins can update departments" ON departments;
DROP POLICY IF EXISTS "Only admins can delete departments" ON departments;
DROP POLICY IF EXISTS "Users can view departments from own tenant" ON departments;
DROP POLICY IF EXISTS "Admins can create departments in own tenant" ON departments;
DROP POLICY IF EXISTS "Admins can update departments in own tenant" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments in own tenant" ON departments;

CREATE POLICY "Users can view departments from own tenant"
  ON departments FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create departments in own tenant"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Admins can update departments in own tenant"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Admins can delete departments in own tenant"
  ON departments FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 10. USER_DEPARTMENTS
-- ============================================

DROP POLICY IF EXISTS "Everyone can view user departments" ON user_departments;
DROP POLICY IF EXISTS "Only admins can assign departments" ON user_departments;
DROP POLICY IF EXISTS "Only admins can remove department assignments" ON user_departments;
DROP POLICY IF EXISTS "Users can view user departments from own tenant" ON user_departments;
DROP POLICY IF EXISTS "Admins can assign departments in own tenant" ON user_departments;
DROP POLICY IF EXISTS "Admins can remove department assignments in own tenant" ON user_departments;

CREATE POLICY "Users can view user departments from own tenant"
  ON user_departments FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can assign departments in own tenant"
  ON user_departments FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Admins can remove department assignments in own tenant"
  ON user_departments FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 11. TIME_ENTRIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can create own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
DROP POLICY IF EXISTS "Admins can view all time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can view time entries from own tenant" ON time_entries;
DROP POLICY IF EXISTS "Users can create time entries in own tenant" ON time_entries;
DROP POLICY IF EXISTS "Users can update time entries in own tenant" ON time_entries;

CREATE POLICY "Users can view time entries from own tenant"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

CREATE POLICY "Users can create time entries in own tenant"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update time entries in own tenant"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

-- ============================================
-- 12. CALENDAR_EVENTS
-- ============================================

DROP POLICY IF EXISTS "Users can view own personal events" ON calendar_events;
DROP POLICY IF EXISTS "Users can view events assigned to them" ON calendar_events;
DROP POLICY IF EXISTS "Admin and support can view all events" ON calendar_events;
DROP POLICY IF EXISTS "Users can create personal events" ON calendar_events;
DROP POLICY IF EXISTS "Admin and support can create events for users" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own personal events" ON calendar_events;
DROP POLICY IF EXISTS "Admin and support can update all events" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete own personal events" ON calendar_events;
DROP POLICY IF EXISTS "Admin and support can delete all events" ON calendar_events;
DROP POLICY IF EXISTS "Users can view calendar events from own tenant" ON calendar_events;
DROP POLICY IF EXISTS "Users can create calendar events in own tenant" ON calendar_events;
DROP POLICY IF EXISTS "Users can update calendar events in own tenant" ON calendar_events;
DROP POLICY IF EXISTS "Users can delete calendar events in own tenant" ON calendar_events;

CREATE POLICY "Users can view calendar events from own tenant"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      created_by = auth.uid() AND assigned_to IS NULL
      OR assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

CREATE POLICY "Users can create calendar events in own tenant"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND (
      (created_by = auth.uid() AND assigned_to IS NULL)
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

CREATE POLICY "Users can update calendar events in own tenant"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      (created_by = auth.uid() AND assigned_to IS NULL)
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
  );

CREATE POLICY "Users can delete calendar events in own tenant"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      (created_by = auth.uid() AND assigned_to IS NULL)
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

-- ============================================
-- 13. DIRECT_MESSAGES
-- ============================================

DROP POLICY IF EXISTS "Users can view own messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can send messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can update read status" ON direct_messages;
DROP POLICY IF EXISTS "Users can view direct messages from own tenant" ON direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages in own tenant" ON direct_messages;
DROP POLICY IF EXISTS "Users can update read status in own tenant" ON direct_messages;

CREATE POLICY "Users can view direct messages from own tenant"
  ON direct_messages FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

CREATE POLICY "Users can send direct messages in own tenant"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = receiver_id
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can update read status in own tenant"
  ON direct_messages FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND receiver_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND receiver_id = auth.uid()
  );

-- ============================================
-- 14. DIRECT_MESSAGE_ATTACHMENTS
-- ============================================

DROP POLICY IF EXISTS "Users can view message attachments" ON direct_message_attachments;
DROP POLICY IF EXISTS "Users can upload message attachments" ON direct_message_attachments;
DROP POLICY IF EXISTS "Users can view message attachments from own tenant" ON direct_message_attachments;
DROP POLICY IF EXISTS "Users can upload message attachments in own tenant" ON direct_message_attachments;

CREATE POLICY "Users can view message attachments from own tenant"
  ON direct_message_attachments FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM direct_messages dm
      WHERE dm.id = direct_message_attachments.message_id
      AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
      AND dm.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can upload message attachments in own tenant"
  ON direct_message_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM direct_messages dm
      WHERE dm.id = direct_message_attachments.message_id
      AND dm.sender_id = auth.uid()
      AND dm.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 15. SOCIAL_POSTS
-- ============================================

DROP POLICY IF EXISTS "Anyone can view posts" ON social_posts;
DROP POLICY IF EXISTS "Anyone can create posts" ON social_posts;
DROP POLICY IF EXISTS "Users can update own posts" ON social_posts;
DROP POLICY IF EXISTS "Users can delete own posts or admin can delete any" ON social_posts;
DROP POLICY IF EXISTS "Users can view social posts from own tenant" ON social_posts;
DROP POLICY IF EXISTS "Users can create social posts in own tenant" ON social_posts;
DROP POLICY IF EXISTS "Users can update own social posts in own tenant" ON social_posts;
DROP POLICY IF EXISTS "Users can delete own social posts in own tenant" ON social_posts;

CREATE POLICY "Users can view social posts from own tenant"
  ON social_posts FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create social posts in own tenant"
  ON social_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update own social posts in own tenant"
  ON social_posts FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can delete own social posts in own tenant"
  ON social_posts FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

-- ============================================
-- 16. SOCIAL_LIKES
-- ============================================

DROP POLICY IF EXISTS "Anyone can view likes" ON social_likes;
DROP POLICY IF EXISTS "Anyone can like posts" ON social_likes;
DROP POLICY IF EXISTS "Users can unlike own likes" ON social_likes;
DROP POLICY IF EXISTS "Users can view social likes from own tenant" ON social_likes;
DROP POLICY IF EXISTS "Users can like posts in own tenant" ON social_likes;
DROP POLICY IF EXISTS "Users can unlike own likes in own tenant" ON social_likes;

CREATE POLICY "Users can view social likes from own tenant"
  ON social_likes FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_likes.post_id
      AND sp.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can like posts in own tenant"
  ON social_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_likes.post_id
      AND sp.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can unlike own likes in own tenant"
  ON social_likes FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

-- ============================================
-- 17. SOCIAL_COMMENTS
-- ============================================

DROP POLICY IF EXISTS "Anyone can view comments" ON social_comments;
DROP POLICY IF EXISTS "Anyone can comment on posts" ON social_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON social_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON social_comments;
DROP POLICY IF EXISTS "Users can view social comments from own tenant" ON social_comments;
DROP POLICY IF EXISTS "Users can comment on posts in own tenant" ON social_comments;
DROP POLICY IF EXISTS "Users can update own comments in own tenant" ON social_comments;
DROP POLICY IF EXISTS "Users can delete own comments in own tenant" ON social_comments;

CREATE POLICY "Users can view social comments from own tenant"
  ON social_comments FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_comments.post_id
      AND sp.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can comment on posts in own tenant"
  ON social_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_comments.post_id
      AND sp.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can update own comments in own tenant"
  ON social_comments FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can delete own comments in own tenant"
  ON social_comments FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

-- ============================================
-- 18. SOCIAL_POST_MEDIA
-- ============================================

DROP POLICY IF EXISTS "Users can view post media" ON social_post_media;
DROP POLICY IF EXISTS "Users can upload post media" ON social_post_media;
DROP POLICY IF EXISTS "Users can view social post media from own tenant" ON social_post_media;
DROP POLICY IF EXISTS "Users can upload social post media in own tenant" ON social_post_media;

CREATE POLICY "Users can view social post media from own tenant"
  ON social_post_media FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_post_media.post_id
      AND sp.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can upload social post media in own tenant"
  ON social_post_media FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM social_posts sp
      WHERE sp.id = social_post_media.post_id
      AND sp.user_id = auth.uid()
      AND sp.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 19. BIRTHDAY_COMMENTS
-- ============================================

DROP POLICY IF EXISTS "Users can view birthday comments" ON birthday_comments;
DROP POLICY IF EXISTS "Users can create birthday comments" ON birthday_comments;
DROP POLICY IF EXISTS "Users can view birthday comments from own tenant" ON birthday_comments;
DROP POLICY IF EXISTS "Users can create birthday comments in own tenant" ON birthday_comments;

CREATE POLICY "Users can view birthday comments from own tenant"
  ON birthday_comments FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = birthday_comments.birthday_user_id
      AND p.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can create birthday comments in own tenant"
  ON birthday_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = birthday_comments.birthday_user_id
      AND p.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 20. NOTIFICATIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view notifications from own tenant" ON notifications;
DROP POLICY IF EXISTS "System can create notifications in own tenant" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications in own tenant" ON notifications;

CREATE POLICY "Users can view notifications from own tenant"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "System can create notifications in own tenant"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = notifications.user_id
      AND p.tenant_id = get_user_tenant_id()
    )
  );

CREATE POLICY "Users can update own notifications in own tenant"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

-- ============================================
-- 21. VACATIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view own vacations" ON vacations;
DROP POLICY IF EXISTS "Admins can view all vacations" ON vacations;
DROP POLICY IF EXISTS "Users can create own vacations" ON vacations;
DROP POLICY IF EXISTS "Admins can update vacations" ON vacations;
DROP POLICY IF EXISTS "Users can view vacations from own tenant" ON vacations;
DROP POLICY IF EXISTS "Users can create vacations in own tenant" ON vacations;
DROP POLICY IF EXISTS "Admins can update vacations in own tenant" ON vacations;

CREATE POLICY "Users can view vacations from own tenant"
  ON vacations FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

CREATE POLICY "Users can create vacations in own tenant"
  ON vacations FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "Admins can update vacations in own tenant"
  ON vacations FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- ============================================
-- 22. LIBRARY_FOLDERS (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_folders') THEN
    DROP POLICY IF EXISTS "Users can view library folders" ON library_folders;
    DROP POLICY IF EXISTS "Admins can manage library folders" ON library_folders;
    DROP POLICY IF EXISTS "Users can view library folders from own tenant" ON library_folders;
    DROP POLICY IF EXISTS "Admins can manage library folders in own tenant" ON library_folders;

    CREATE POLICY "Users can view library folders from own tenant"
      ON library_folders FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage library folders in own tenant"
      ON library_folders FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 23. LIBRARY_DOCUMENTS (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_documents') THEN
    DROP POLICY IF EXISTS "Users can view library documents" ON library_documents;
    DROP POLICY IF EXISTS "Admins can manage library documents" ON library_documents;
    DROP POLICY IF EXISTS "Users can view library documents from own tenant" ON library_documents;
    DROP POLICY IF EXISTS "Admins can manage library documents in own tenant" ON library_documents;

    CREATE POLICY "Users can view library documents from own tenant"
      ON library_documents FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM library_folders lf
          WHERE lf.id = library_documents.folder_id
          AND lf.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Admins can manage library documents in own tenant"
      ON library_documents FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 24. LIBRARY_COURSES (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_courses') THEN
    DROP POLICY IF EXISTS "Users can view library courses" ON library_courses;
    DROP POLICY IF EXISTS "Admins can manage library courses" ON library_courses;
    DROP POLICY IF EXISTS "Users can view library courses from own tenant" ON library_courses;
    DROP POLICY IF EXISTS "Admins can manage library courses in own tenant" ON library_courses;

    CREATE POLICY "Users can view library courses from own tenant"
      ON library_courses FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage library courses in own tenant"
      ON library_courses FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 25. COURSE_PARTS (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'course_parts') THEN
    DROP POLICY IF EXISTS "Users can view course parts" ON course_parts;
    DROP POLICY IF EXISTS "Admins can manage course parts" ON course_parts;
    DROP POLICY IF EXISTS "Users can view course parts from own tenant" ON course_parts;
    DROP POLICY IF EXISTS "Admins can manage course parts in own tenant" ON course_parts;

    CREATE POLICY "Users can view course parts from own tenant"
      ON course_parts FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM library_courses lc
          WHERE lc.id = course_parts.course_id
          AND lc.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Admins can manage course parts in own tenant"
      ON course_parts FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 26. PROFESSIONAL_NEWS (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'professional_news') THEN
    DROP POLICY IF EXISTS "Users can view professional news" ON professional_news;
    DROP POLICY IF EXISTS "Admins can manage professional news" ON professional_news;
    DROP POLICY IF EXISTS "Users can view professional news from own tenant" ON professional_news;
    DROP POLICY IF EXISTS "Admins can manage professional news in own tenant" ON professional_news;

    CREATE POLICY "Users can view professional news from own tenant"
      ON professional_news FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage professional news in own tenant"
      ON professional_news FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 27. INTERNAL_POLICIES (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'internal_policies') THEN
    DROP POLICY IF EXISTS "Users can view internal policies" ON internal_policies;
    DROP POLICY IF EXISTS "Admins can manage internal policies" ON internal_policies;
    DROP POLICY IF EXISTS "Users can view internal policies from own tenant" ON internal_policies;
    DROP POLICY IF EXISTS "Admins can manage internal policies in own tenant" ON internal_policies;

    CREATE POLICY "Users can view internal policies from own tenant"
      ON internal_policies FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage internal policies in own tenant"
      ON internal_policies FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 28. CLIENT_FAVORITES (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_favorites') THEN
    DROP POLICY IF EXISTS "Users can view own favorites" ON client_favorites;
    DROP POLICY IF EXISTS "Users can manage own favorites" ON client_favorites;
    DROP POLICY IF EXISTS "Users can view client favorites from own tenant" ON client_favorites;
    DROP POLICY IF EXISTS "Users can manage client favorites in own tenant" ON client_favorites;

    CREATE POLICY "Users can view client favorites from own tenant"
      ON client_favorites FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
      );

    CREATE POLICY "Users can manage client favorites in own tenant"
      ON client_favorites FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
      );
  END IF;
END $$;

-- ============================================
-- 29. CLIENT_PRICES (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_prices') THEN
    DROP POLICY IF EXISTS "Users can view client prices" ON client_prices;
    DROP POLICY IF EXISTS "Admins can manage client prices" ON client_prices;
    DROP POLICY IF EXISTS "Users can view client prices from own tenant" ON client_prices;
    DROP POLICY IF EXISTS "Admins can manage client prices in own tenant" ON client_prices;

    CREATE POLICY "Users can view client prices from own tenant"
      ON client_prices FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage client prices in own tenant"
      ON client_prices FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 30. VENCIMIENTOS_CLIENTES (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vencimientos_clientes') THEN
    DROP POLICY IF EXISTS "Users can view vencimientos" ON vencimientos_clientes;
    DROP POLICY IF EXISTS "Admins can manage vencimientos" ON vencimientos_clientes;
    DROP POLICY IF EXISTS "Users can view vencimientos from own tenant" ON vencimientos_clientes;
    DROP POLICY IF EXISTS "Admins can manage vencimientos in own tenant" ON vencimientos_clientes;

    CREATE POLICY "Users can view vencimientos from own tenant"
      ON vencimientos_clientes FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage vencimientos in own tenant"
      ON vencimientos_clientes FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 31. CLIENT_DRIVE_MAPPING (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_drive_mapping') THEN
    DROP POLICY IF EXISTS "Users can view drive mappings" ON client_drive_mapping;
    DROP POLICY IF EXISTS "Admins can manage drive mappings" ON client_drive_mapping;
    DROP POLICY IF EXISTS "Users can view drive mappings from own tenant" ON client_drive_mapping;
    DROP POLICY IF EXISTS "Admins can manage drive mappings in own tenant" ON client_drive_mapping;

    CREATE POLICY "Users can view drive mappings from own tenant"
      ON client_drive_mapping FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage drive mappings in own tenant"
      ON client_drive_mapping FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 32. MEETING_ROOMS (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meeting_rooms') THEN
    DROP POLICY IF EXISTS "Users can view meeting rooms" ON meeting_rooms;
    DROP POLICY IF EXISTS "Users can create meeting rooms" ON meeting_rooms;
    DROP POLICY IF EXISTS "Users can update meeting rooms" ON meeting_rooms;
    DROP POLICY IF EXISTS "Users can view meeting rooms from own tenant" ON meeting_rooms;
    DROP POLICY IF EXISTS "Users can create meeting rooms in own tenant" ON meeting_rooms;
    DROP POLICY IF EXISTS "Users can update meeting rooms in own tenant" ON meeting_rooms;

    CREATE POLICY "Users can view meeting rooms from own tenant"
      ON meeting_rooms FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Users can create meeting rooms in own tenant"
      ON meeting_rooms FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      );

    CREATE POLICY "Users can update meeting rooms in own tenant"
      ON meeting_rooms FOR UPDATE
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND created_by = auth.uid()
      );
  END IF;
END $$;

-- ============================================
-- 33. ROOM_PRESENCE (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'room_presence') THEN
    DROP POLICY IF EXISTS "Users can view room presence" ON room_presence;
    DROP POLICY IF EXISTS "Users can update room presence" ON room_presence;
    DROP POLICY IF EXISTS "Users can view room presence from own tenant" ON room_presence;
    DROP POLICY IF EXISTS "Users can update room presence in own tenant" ON room_presence;

    CREATE POLICY "Users can view room presence from own tenant"
      ON room_presence FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM meeting_rooms mr
          WHERE mr.id = room_presence.room_id
          AND mr.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Users can update room presence in own tenant"
      ON room_presence FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
      );
  END IF;
END $$;

-- ============================================
-- 34. DEPARTMENT_FORUM_PERMISSIONS (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'department_forum_permissions') THEN
    DROP POLICY IF EXISTS "Everyone can view department forum permissions" ON department_forum_permissions;
    DROP POLICY IF EXISTS "Only admins can manage department forum permissions" ON department_forum_permissions;
    DROP POLICY IF EXISTS "Users can view department forum permissions from own tenant" ON department_forum_permissions;
    DROP POLICY IF EXISTS "Admins can manage department forum permissions in own tenant" ON department_forum_permissions;

    CREATE POLICY "Users can view department forum permissions from own tenant"
      ON department_forum_permissions FOR SELECT
      TO authenticated
      USING (tenant_id = get_user_tenant_id());

    CREATE POLICY "Admins can manage department forum permissions in own tenant"
      ON department_forum_permissions FOR ALL
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 35. TASK_MESSAGES (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_messages') THEN
    DROP POLICY IF EXISTS "Users can view task messages" ON task_messages;
    DROP POLICY IF EXISTS "Users can create task messages" ON task_messages;
    DROP POLICY IF EXISTS "Users can view task messages from own tenant" ON task_messages;
    DROP POLICY IF EXISTS "Users can create task messages in own tenant" ON task_messages;

    CREATE POLICY "Users can view task messages from own tenant"
      ON task_messages FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = task_messages.task_id
          AND t.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Users can create task messages in own tenant"
      ON task_messages FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = task_messages.task_id
          AND t.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

-- ============================================
-- 36. TASK_ATTACHMENTS (solo si la tabla existe)
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_attachments') THEN
    DROP POLICY IF EXISTS "Users can view task attachments" ON task_attachments;
    DROP POLICY IF EXISTS "Users can upload task attachments" ON task_attachments;
    DROP POLICY IF EXISTS "Users can view task attachments from own tenant" ON task_attachments;
    DROP POLICY IF EXISTS "Users can upload task attachments in own tenant" ON task_attachments;

    CREATE POLICY "Users can view task attachments from own tenant"
      ON task_attachments FOR SELECT
      TO authenticated
      USING (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = task_attachments.task_id
          AND t.tenant_id = get_user_tenant_id()
        )
      );

    CREATE POLICY "Users can upload task attachments in own tenant"
      ON task_attachments FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = task_attachments.task_id
          AND t.tenant_id = get_user_tenant_id()
        )
      );
  END IF;
END $$;

