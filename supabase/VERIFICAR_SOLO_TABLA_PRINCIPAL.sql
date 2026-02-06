-- ============================================
-- Verificación Rápida: Tabla vencimientos_gestion
-- ============================================
-- Ejecuta este script para verificar si la tabla principal existe
-- ============================================

-- Verificar si la tabla principal existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'vencimientos_gestion'
        ) THEN '✅ Tabla vencimientos_gestion EXISTE - Todo está bien'
        ELSE '❌ Tabla vencimientos_gestion NO EXISTE - Necesitas ejecutar la migración 20250127000009_create_vencimientos_gestion_table.sql'
    END AS estado;

-- Si la tabla existe, mostrar sus columnas
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'vencimientos_gestion'
ORDER BY ordinal_position;
