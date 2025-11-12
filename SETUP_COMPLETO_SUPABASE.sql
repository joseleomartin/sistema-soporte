-- ============================================
-- SCRIPT COMPLETO DE INSTALACIÓN - SUPABASE
-- Sistema de Gestión Financiera
-- ============================================
-- Ejecuta este script completo en el SQL Editor de Supabase
-- Creará todas las tablas, políticas RLS, triggers y storage necesarios
-- ============================================

-- 1. TABLA: profiles (Usuarios)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'support', 'user')),
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Trigger para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. TABLA: tickets (Sistema de Soporte)
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets, support and admin view all"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can create tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Support and admin can update tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- 3. TABLA: ticket_comments (Comentarios de Tickets)
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on own tickets, support and admin view all"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'support')
        )
      )
    )
  );

CREATE POLICY "Users can create comments on accessible tickets"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'support')
        )
      )
    )
  );

-- 4. TABLA: subforums (Clientes)
-- ============================================
CREATE TABLE IF NOT EXISTS subforums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  client_name text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subforums ENABLE ROW LEVEL SECURITY;

-- 5. TABLA: subforum_permissions (Permisos de Clientes)
-- ============================================
CREATE TABLE IF NOT EXISTS subforum_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subforum_id uuid NOT NULL REFERENCES subforums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_view boolean DEFAULT true,
  can_post boolean DEFAULT true,
  can_moderate boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subforum_id, user_id)
);

ALTER TABLE subforum_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas para subforums (después de crear subforum_permissions)
CREATE POLICY "Users can view subforums they have access to"
  ON subforums FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
    OR EXISTS (
      SELECT 1 FROM subforum_permissions
      WHERE subforum_permissions.subforum_id = subforums.id
      AND subforum_permissions.user_id = auth.uid()
      AND subforum_permissions.can_view = true
    )
  );

CREATE POLICY "Admin and support can create subforums"
  ON subforums FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Políticas para subforum_permissions
CREATE POLICY "Users can view their own permissions"
  ON subforum_permissions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Admin and support can manage permissions"
  ON subforum_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- 6. TABLA: forum_messages (Mensajes de Clientes)
-- ============================================
CREATE TABLE IF NOT EXISTS forum_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subforum_id uuid NOT NULL REFERENCES subforums(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE forum_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from accessible subforums"
  ON forum_messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM subforum_permissions
      WHERE subforum_id = forum_messages.subforum_id AND can_view = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can post messages in subforums"
  ON forum_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM subforum_permissions
      WHERE subforum_id = forum_messages.subforum_id AND can_post = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can update own messages"
  ON forum_messages FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can delete own messages or moderators can delete any"
  ON forum_messages FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- 7. TABLA: meeting_rooms (Salas de Reunión)
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  jitsi_room_id text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active meeting rooms"
  ON meeting_rooms FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin and support can create meeting rooms"
  ON meeting_rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- 8. TABLA: room_presence (Presencia en Salas)
-- ============================================
CREATE TABLE IF NOT EXISTS room_presence (
  room_id uuid NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE room_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view room presence"
  ON room_presence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own presence"
  ON room_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own presence"
  ON room_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own presence"
  ON room_presence FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 9. TABLA: calendar_events (Calendario)
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  all_day boolean DEFAULT false,
  color text DEFAULT '#3B82F6',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'personal' CHECK (event_type IN ('personal', 'assigned', 'meeting')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personal events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() AND assigned_to IS NULL);

CREATE POLICY "Users can view events assigned to them"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Admin and support can view all events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can create personal events"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() AND assigned_to IS NULL);

CREATE POLICY "Admin and support can create events for users"
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can update own personal events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() AND assigned_to IS NULL);

CREATE POLICY "Admin and support can update all events"
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can delete own personal events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND assigned_to IS NULL);

CREATE POLICY "Admin and support can delete all events"
  ON calendar_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- 10. ÍNDICES para Mejorar Rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_subforums_created_by ON subforums(created_by);
CREATE INDEX IF NOT EXISTS idx_subforum_permissions_user_id ON subforum_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_subforum_permissions_subforum_id ON subforum_permissions(subforum_id);
CREATE INDEX IF NOT EXISTS idx_forum_messages_subforum_id ON forum_messages(subforum_id);
CREATE INDEX IF NOT EXISTS idx_forum_messages_created_by ON forum_messages(created_by);
CREATE INDEX IF NOT EXISTS idx_forum_messages_created_at ON forum_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_messages_attachments ON forum_messages USING gin(attachments);
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_is_active ON meeting_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to ON calendar_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);

-- 11. TRIGGERS para updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subforums_updated_at BEFORE UPDATE ON subforums
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forum_messages_updated_at BEFORE UPDATE ON forum_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. STORAGE BUCKET para Archivos
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

CREATE POLICY "Public can view attachments" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'ticket-attachments');

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 13. FUNCIÓN para Limpiar Presencia Antigua
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM room_presence
  WHERE last_seen < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- 14. TABLA: departments (Departamentos)
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 15. TABLA: user_departments (Asignación de Usuarios a Departamentos)
-- ============================================
CREATE TABLE IF NOT EXISTS user_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, department_id)
);

ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view user departments"
  ON user_departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can assign departments"
  ON user_departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can remove department assignments"
  ON user_departments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Índices para user_departments
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments(department_id);

-- Insertar departamentos de ejemplo
INSERT INTO departments (name, description, color) VALUES
  ('Contadores', 'Departamento de contabilidad y finanzas', '#10B981'),
  ('Abogados', 'Departamento legal', '#3B82F6'),
  ('Soporte', 'Equipo de soporte técnico', '#F59E0B'),
  ('Administración', 'Administración general', '#8B5CF6')
ON CONFLICT (name) DO NOTHING;

-- 16. STORAGE BUCKET: avatars (Fotos de Perfil)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para avatares
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 17. HABILITAR REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE forum_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE room_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- ✅ Todas las tablas creadas
-- ✅ Todas las políticas RLS configuradas
-- ✅ Todos los índices creados
-- ✅ Todos los triggers configurados
-- ✅ Storage buckets creados (ticket-attachments, avatars)
-- ✅ Realtime habilitado
-- ✅ Sistema de departamentos configurado
-- ✅ Sistema de avatares configurado
-- ============================================

