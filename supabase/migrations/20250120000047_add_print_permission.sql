-- ==================================================================
-- MIGRACIÓN: Agregar Permiso de Imprimir
-- ==================================================================
-- Fecha: 2025-01-20
-- Descripción: Agrega columna can_print a department_permissions
--              para controlar permisos de impresión/generación de PDFs
-- ==================================================================

-- Agregar columna can_print a department_permissions
ALTER TABLE department_permissions
ADD COLUMN IF NOT EXISTS can_print boolean NOT NULL DEFAULT false;

-- Actualizar comentario de la tabla
COMMENT ON COLUMN department_permissions.can_print IS 'Permite imprimir/generar PDFs de órdenes';

-- ==================================================================
-- NOTAS:
-- ==================================================================
-- - Por defecto, can_print es false (no se puede imprimir)
-- - Los admins siempre pueden imprimir (se maneja en el código)
-- - Para activar impresión, configurar en: Personas > Áreas > Permisos
-- ==================================================================










