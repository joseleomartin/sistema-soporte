-- Agregar campo birthday a la tabla profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS birthday DATE;

-- Crear índice para búsquedas eficientes de cumpleaños
CREATE INDEX IF NOT EXISTS idx_profiles_birthday ON profiles(birthday);

-- Comentario en la columna
COMMENT ON COLUMN profiles.birthday IS 'Fecha de cumpleaños del usuario (solo mes y día se usan para mostrar tarjetas)';














