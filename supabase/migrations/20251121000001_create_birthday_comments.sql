-- Crear tabla para comentarios de cumpleaños
CREATE TABLE IF NOT EXISTS birthday_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  birthday_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE birthday_comments ENABLE ROW LEVEL SECURITY;

-- Políticas para birthday_comments
-- SELECT: Todos pueden ver comentarios
CREATE POLICY "Anyone can view birthday comments"
  ON birthday_comments FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT: Todos pueden comentar
CREATE POLICY "Anyone can comment on birthdays"
  ON birthday_comments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- UPDATE: Solo el autor puede editar su comentario
CREATE POLICY "Users can update own birthday comments"
  ON birthday_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Solo el autor o admin puede eliminar
CREATE POLICY "Users can delete own birthday comments or admins can delete any"
  ON birthday_comments FOR DELETE
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_birthday_comments_birthday_user_id ON birthday_comments(birthday_user_id);
CREATE INDEX IF NOT EXISTS idx_birthday_comments_user_id ON birthday_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_birthday_comments_created_at ON birthday_comments(created_at);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_birthday_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER update_birthday_comments_updated_at
  BEFORE UPDATE ON birthday_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_birthday_comments_updated_at();

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE birthday_comments;

-- Comentario en la tabla
COMMENT ON TABLE birthday_comments IS 'Comentarios de felicitación en los cumpleaños de usuarios';















