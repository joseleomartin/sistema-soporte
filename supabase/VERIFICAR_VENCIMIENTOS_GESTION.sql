-- ============================================
-- Script de Verificación: Sistema de Vencimientos
-- ============================================
-- Ejecuta este script en Supabase SQL Editor para verificar
-- si las tablas del sistema de vencimientos existen
-- ============================================

-- 1. Verificar si la tabla principal existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'vencimientos_gestion'
        ) THEN '✅ Tabla vencimientos_gestion EXISTE'
        ELSE '❌ Tabla vencimientos_gestion NO EXISTE - Necesitas ejecutar la migración'
    END AS estado_tabla_principal;

-- 2. Verificar todas las tablas del sistema
SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✅ Existe'
        ELSE '❌ No existe'
    END AS estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'vencimientos_gestion',
    'vencimientos_gestion_assignments',
    'vencimientos_gestion_messages'
)
ORDER BY table_name;

-- 3. Verificar columnas de la tabla principal (si existe)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'vencimientos_gestion'
ORDER BY ordinal_position;

-- 4. Verificar políticas RLS
SELECT 
    tablename,
    policyname,
    CASE 
        WHEN policyname IS NOT NULL THEN '✅ Existe'
        ELSE '❌ No existe'
    END AS estado
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN (
    'vencimientos_gestion',
    'vencimientos_gestion_assignments',
    'vencimientos_gestion_messages'
)
ORDER BY tablename, policyname;

-- 5. Verificar columna vencimientos_responsable_id en subforums
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'subforums' 
            AND column_name = 'vencimientos_responsable_id'
        ) THEN '✅ Columna vencimientos_responsable_id EXISTE en subforums'
        ELSE '❌ Columna vencimientos_responsable_id NO EXISTE - Necesitas ejecutar la migración 20250127000010'
    END AS estado_columna_responsable;
