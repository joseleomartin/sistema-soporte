-- Script de prueba para establecer el cumpleaños de un usuario a HOY
-- Reemplaza 'TU_EMAIL_AQUI' con tu email de usuario

-- Opción 1: Actualizar por email
UPDATE profiles 
SET birthday = CURRENT_DATE
WHERE email = 'TU_EMAIL_AQUI';

-- Opción 2: Actualizar por ID (reemplaza con tu user_id)
-- UPDATE profiles 
-- SET birthday = CURRENT_DATE
-- WHERE id = 'TU_USER_ID_AQUI';

-- Verificar que se actualizó correctamente
SELECT 
  id,
  full_name,
  email,
  birthday,
  EXTRACT(MONTH FROM birthday) as mes,
  EXTRACT(DAY FROM birthday) as dia,
  EXTRACT(MONTH FROM CURRENT_DATE) as mes_hoy,
  EXTRACT(DAY FROM CURRENT_DATE) as dia_hoy
FROM profiles
WHERE email = 'TU_EMAIL_AQUI';

-- Ver todos los usuarios que cumplen años HOY
SELECT 
  id,
  full_name,
  email,
  avatar_url,
  birthday,
  EXTRACT(YEAR FROM AGE(birthday)) as edad
FROM profiles
WHERE 
  birthday IS NOT NULL
  AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE);


