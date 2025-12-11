-- Script para corregir la foreign key de library_courses si ya fue creada incorrectamente
-- Ejecutar este script si la tabla ya existe con la foreign key apuntando a auth.users

-- 1. Eliminar la foreign key incorrecta si existe
ALTER TABLE library_courses 
  DROP CONSTRAINT IF EXISTS library_courses_created_by_fkey;

-- 2. Agregar la foreign key correcta apuntando a profiles
ALTER TABLE library_courses
  ADD CONSTRAINT library_courses_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id) 
  ON DELETE CASCADE;

-- Verificar que la relación funciona
-- SELECT 
--   lc.id,
--   lc.title,
--   p.full_name as creator_name
-- FROM library_courses lc
-- LEFT JOIN profiles p ON lc.created_by = p.id;








