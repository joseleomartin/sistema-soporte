-- ============================================
-- Refrescar Schema Cache de Supabase
-- ============================================
-- Este script ayuda a forzar la actualización del schema cache
-- Ejecuta esto DESPUÉS de crear las tablas si aún ves errores 404
-- ============================================

-- 1. Verificar que la tabla existe físicamente
SELECT 
    'Tabla física' AS tipo,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'vencimientos_gestion'
        ) THEN '✅ EXISTE'
        ELSE '❌ NO EXISTE - Ejecuta la migración primero'
    END AS estado;

-- 2. Verificar políticas RLS (esto fuerza a Supabase a refrescar el cache)
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'vencimientos_gestion';

-- 3. Hacer una consulta simple para forzar el refresh
SELECT COUNT(*) as total_vencimientos
FROM vencimientos_gestion;

-- 4. Verificar que las columnas están correctas
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'vencimientos_gestion'
ORDER BY ordinal_position;

-- ============================================
-- INSTRUCCIONES:
-- ============================================
-- 1. Si la tabla NO EXISTE: Ejecuta primero la migración
--    20250127000009_create_vencimientos_gestion_table.sql
--
-- 2. Si la tabla EXISTE pero aún ves errores 404:
--    - Espera 1-2 minutos
--    - Recarga la aplicación (F5)
--    - El schema cache se actualiza automáticamente
--
-- 3. Si después de 5 minutos aún no funciona:
--    - Ve a Supabase Dashboard → Settings → API
--    - Busca "Refresh Schema Cache" (si está disponible)
--    - O contacta con soporte de Supabase
-- ============================================
