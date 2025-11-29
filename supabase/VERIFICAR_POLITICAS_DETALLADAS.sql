-- ============================================
-- VERIFICAR POLÍTICAS DETALLADAS DEL BUCKET
-- ============================================
-- Este script verifica las políticas específicas del bucket direct-message-attachments
-- ============================================

-- 1. Ver todas las políticas relacionadas con attachments
SELECT 
  policyname,
  cmd,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (
    policyname LIKE '%attachment%' 
    OR policyname LIKE '%direct%'
    OR policyname LIKE '%message%'
  )
ORDER BY cmd, policyname;

-- 2. Verificar específicamente las políticas del bucket direct-message-attachments
-- Buscar en las expresiones USING y WITH CHECK si mencionan el bucket
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual::text LIKE '%direct-message-attachments%' THEN '✅ Menciona el bucket'
    ELSE '❌ NO menciona el bucket'
  END as verifica_bucket,
  qual as expresion_usando
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%attachment%';

-- 3. Verificar si hay políticas públicas que puedan estar interfiriendo
SELECT 
  policyname,
  cmd,
  roles,
  CASE 
    WHEN 'public' = ANY(roles) THEN '⚠️ PÚBLICA - Puede causar conflictos'
    WHEN 'authenticated' = ANY(roles) THEN '✅ Autenticada'
    ELSE '❓ Otro'
  END as tipo_acceso
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (
    policyname LIKE '%attachment%' 
    OR policyname LIKE '%direct%'
  )
ORDER BY policyname;

-- 4. Si la política "Public can view attachments" es del bucket direct-message-attachments,
-- debería eliminarse porque el bucket es privado
-- (Esta política probablemente es del bucket ticket-attachments, pero verifiquemos)

-- 5. Verificar la estructura de los paths de archivos en la base de datos
SELECT 
  file_path,
  file_name,
  message_id,
  uploaded_by,
  created_at
FROM direct_message_attachments
ORDER BY created_at DESC
LIMIT 5;

-- Esto nos ayudará a entender el formato del path y verificar si coincide con las políticas

