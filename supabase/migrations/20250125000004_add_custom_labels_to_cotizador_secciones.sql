-- ==================================================================
-- MIGRACIÓN: Agregar Campos para Etiquetas Personalizadas en Secciones
-- ==================================================================
-- Fecha: 2025-01-25
-- Descripción: Agrega campos para permitir personalizar los nombres
--              de las filas "Subtotal" y "Markup" en el cotizador
-- ==================================================================

-- Agregar campos para etiquetas personalizadas
DO $$
BEGIN
  -- Agregar campo para etiqueta de subtotal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cotizador_secciones' 
    AND column_name = 'subtotal_label'
  ) THEN
    ALTER TABLE cotizador_secciones 
    ADD COLUMN subtotal_label text;
    
    COMMENT ON COLUMN cotizador_secciones.subtotal_label IS 'Etiqueta personalizada para la fila de subtotal (por defecto usa el nombre de la sección)';
    RAISE NOTICE 'Columna subtotal_label agregada a cotizador_secciones';
  ELSE
    RAISE NOTICE 'La columna subtotal_label ya existe en cotizador_secciones';
  END IF;

  -- Agregar campo para etiqueta de markup
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cotizador_secciones' 
    AND column_name = 'markup_label'
  ) THEN
    ALTER TABLE cotizador_secciones 
    ADD COLUMN markup_label text;
    
    COMMENT ON COLUMN cotizador_secciones.markup_label IS 'Etiqueta personalizada para la fila de markup (por defecto usa el nombre de la sección)';
    RAISE NOTICE 'Columna markup_label agregada a cotizador_secciones';
  ELSE
    RAISE NOTICE 'La columna markup_label ya existe en cotizador_secciones';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
