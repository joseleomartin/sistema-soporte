-- Crear tabla para posts sociales
CREATE TABLE IF NOT EXISTS social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text, -- Texto opcional del post
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'gif')),
  media_url text NOT NULL, -- URL del archivo en storage
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla para likes
CREATE TABLE IF NOT EXISTS social_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id) -- Un usuario solo puede dar like una vez
);

-- Crear tabla para comentarios
CREATE TABLE IF NOT EXISTS social_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;

-- Políticas para social_posts
-- SELECT: Todos los usuarios autenticados pueden ver posts
CREATE POLICY "Anyone can view posts"
  ON social_posts FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: Todos pueden crear posts
CREATE POLICY "Anyone can create posts"
  ON social_posts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- UPDATE: Solo el autor puede editar su post
CREATE POLICY "Users can update own posts"
  ON social_posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Solo el autor o admin puede eliminar
CREATE POLICY "Users can delete own posts or admins can delete any"
  ON social_posts FOR DELETE
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Políticas para social_likes
-- SELECT: Todos pueden ver likes
CREATE POLICY "Anyone can view likes"
  ON social_likes FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: Todos pueden dar like
CREATE POLICY "Anyone can like posts"
  ON social_likes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- DELETE: Solo el usuario puede quitar su like
CREATE POLICY "Users can remove own likes"
  ON social_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para social_comments
-- SELECT: Todos pueden ver comentarios
CREATE POLICY "Anyone can view comments"
  ON social_comments FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: Todos pueden comentar
CREATE POLICY "Anyone can comment"
  ON social_comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- UPDATE: Solo el autor puede editar su comentario
CREATE POLICY "Users can update own comments"
  ON social_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Solo el autor o admin puede eliminar
CREATE POLICY "Users can delete own comments or admins can delete any"
  ON social_comments FOR DELETE
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_likes_post_id ON social_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_likes_user_id ON social_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_post_id ON social_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_user_id ON social_comments(user_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_social_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_social_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_posts_updated_at();

CREATE TRIGGER update_social_comments_updated_at
  BEFORE UPDATE ON social_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_social_comments_updated_at();

-- Habilitar Realtime para las tablas
ALTER PUBLICATION supabase_realtime ADD TABLE social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE social_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE social_comments;

-- Comentarios en las tablas
COMMENT ON TABLE social_posts IS 'Posts de la sección social con contenido multimedia';
COMMENT ON TABLE social_likes IS 'Likes de los usuarios en los posts';
COMMENT ON TABLE social_comments IS 'Comentarios en los posts sociales';




