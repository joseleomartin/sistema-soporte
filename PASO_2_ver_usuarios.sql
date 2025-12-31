-- ============================================
-- PASO 2: Ver usuarios disponibles
-- ============================================
-- Ejecuta esta consulta para ver qué usuarios tienes disponibles
-- Luego copia el email de uno de ellos para usar en el PASO 4

SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  CASE WHEN p.id IS NULL THEN 'Sin perfil' ELSE 'Con perfil' END as estado_perfil,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 10;


