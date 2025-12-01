/*
  # Función para obtener todos los clientes para carga de horas

  1. Cambios
    - Crear función RPC que devuelva todos los subforums (clientes) sin restricciones RLS
    - Esta función solo devuelve id y name, suficiente para la carga de horas
    - Los usuarios pueden usar esta función para ver todos los clientes al cargar horas
    
  2. Seguridad
    - La función solo permite SELECT, no modifica datos
    - Solo devuelve id y name de los subforums
    - No afecta las políticas RLS existentes para otras operaciones
*/

-- Crear función que devuelve todos los clientes para carga de horas
CREATE OR REPLACE FUNCTION get_all_clients_for_time_tracking()
RETURNS TABLE (
  id uuid,
  name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Esta función se ejecuta con permisos de definidor (SECURITY DEFINER)
  -- lo que permite saltarse las políticas RLS para esta consulta específica
  RETURN QUERY
  SELECT 
    subforums.id,
    subforums.name
  FROM subforums
  ORDER BY subforums.name;
END;
$$;

-- Permitir a todos los usuarios autenticados ejecutar esta función
GRANT EXECUTE ON FUNCTION get_all_clients_for_time_tracking() TO authenticated;

