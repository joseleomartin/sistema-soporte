-- Crear tabla para múltiples archivos de media en posts
CREATE TABLE IF NOT EXISTS social_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'gif')),
  media_url text NOT NULL,
  display_order integer DEFAULT 0, -- Orden de visualización
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE social_post_media ENABLE ROW LEVEL SECURITY;

-- Políticas para social_post_media
-- SELECT: Todos pueden ver media
CREATE POLICY "Anyone can view post media"
  ON social_post_media FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: Todos pueden agregar media a sus posts
CREATE POLICY "Anyone can add media to own posts"
  ON social_post_media FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM social_posts
      WHERE social_posts.id = post_id
      AND social_posts.user_id = auth.uid()
    )
  );

-- UPDATE: Solo el autor del post puede actualizar
CREATE POLICY "Users can update media in own posts"
  ON social_post_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM social_posts
      WHERE social_posts.id = post_id
      AND social_posts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM social_posts
      WHERE social_posts.id = post_id
      AND social_posts.user_id = auth.uid()
    )
  );

-- DELETE: Solo el autor del post o admin puede eliminar
CREATE POLICY "Users can delete media from own posts or admins can delete any"
  ON social_post_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM social_posts
      WHERE social_posts.id = post_id
      AND (social_posts.user_id = auth.uid() OR
           EXISTS (
             SELECT 1 FROM profiles 
             WHERE profiles.id = auth.uid() 
             AND profiles.role = 'admin'
           ))
    )
  );

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_social_post_media_post_id ON social_post_media(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_media_display_order ON social_post_media(post_id, display_order);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE social_post_media;

-- Comentario en la tabla
COMMENT ON TABLE social_post_media IS 'Archivos multimedia asociados a posts sociales (soporta múltiples imágenes/videos por post)';

-- Hacer media_type y media_url opcionales en social_posts para mantener compatibilidad
-- Los posts antiguos seguirán funcionando, los nuevos usarán social_post_media
ALTER TABLE social_posts 
  ALTER COLUMN media_type DROP NOT NULL,
  ALTER COLUMN media_url DROP NOT NULL;









