-- ============================================
-- Fix: Aumentar precisión de campos numéricos en cotizador
-- ============================================
-- Soluciona el error "numeric field overflow" al permitir números más grandes
-- ============================================

-- Actualizar campos en tabla cotizaciones
ALTER TABLE cotizaciones 
  ALTER COLUMN precio_base_sin_iva TYPE numeric(30, 10),
  ALTER COLUMN fee_comercial_porcentaje TYPE numeric(10, 4),
  ALTER COLUMN precio_taquion_sin_iva TYPE numeric(30, 10),
  ALTER COLUMN precio_taquion_fee_sin_iva TYPE numeric(30, 10),
  ALTER COLUMN costo_financiero_porcentaje TYPE numeric(10, 4),
  ALTER COLUMN valor_factura_porcentaje TYPE numeric(10, 4),
  ALTER COLUMN incremental_iibb_recuperado TYPE numeric(30, 10),
  ALTER COLUMN margen_total_porcentaje TYPE numeric(10, 4);

-- Actualizar campos en tabla cotizador_secciones
ALTER TABLE cotizador_secciones 
  ALTER COLUMN markup_porcentaje TYPE numeric(10, 4);

-- Actualizar campos en tabla cotizador_conceptos
ALTER TABLE cotizador_conceptos 
  ALTER COLUMN precio_unitario TYPE numeric(30, 10);

-- Actualizar campos en tabla cotizador_valores
ALTER TABLE cotizador_valores 
  ALTER COLUMN value TYPE numeric(30, 10);

-- Actualizar campos en tabla cotizador_proveedores
ALTER TABLE cotizador_proveedores 
  ALTER COLUMN value TYPE numeric(30, 10);

-- Actualizar campos en tabla cotizador_gastos_logisticos
ALTER TABLE cotizador_gastos_logisticos 
  ALTER COLUMN value TYPE numeric(30, 10);

-- Actualizar campos en tabla cotizador_costos_fijos
ALTER TABLE cotizador_costos_fijos 
  ALTER COLUMN overhead TYPE numeric(30, 10),
  ALTER COLUMN presupuesto_mkt_porcentaje TYPE numeric(10, 4);
