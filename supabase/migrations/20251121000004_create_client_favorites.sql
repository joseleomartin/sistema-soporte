-- Crear tabla para favoritos de clientes
CREATE TABLE IF NOT EXISTS client_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subforum_id UUID NOT NULL REFERENCES subforums(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, subforum_id) -- Un usuario solo puede marcar un cliente como favorito una vez
);

-- Habilitar RLS
ALTER TABLE client_favorites ENABLE ROW LEVEL SECURITY;

-- Políticas para client_favorites
-- SELECT: Los usuarios pueden ver sus propios favoritos
CREATE POLICY "Usuarios pueden ver sus propios favoritos"
  ON client_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Los usuarios pueden crear sus propios favoritos
CREATE POLICY "Usuarios pueden crear sus propios favoritos"
  ON client_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Los usuarios pueden eliminar sus propios favoritos
CREATE POLICY "Usuarios pueden eliminar sus propios favoritos"
  ON client_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_client_favorites_user_id ON client_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_client_favorites_subforum_id ON client_favorites(subforum_id);
CREATE INDEX IF NOT EXISTS idx_client_favorites_user_subforum ON client_favorites(user_id, subforum_id);

-- Comentarios
COMMENT ON TABLE client_favorites IS 'Tabla para almacenar los clientes favoritos de cada usuario';
COMMENT ON COLUMN client_favorites.user_id IS 'ID del usuario que marcó el cliente como favorito';
COMMENT ON COLUMN client_favorites.subforum_id IS 'ID del subforo (cliente) marcado como favorito';



















