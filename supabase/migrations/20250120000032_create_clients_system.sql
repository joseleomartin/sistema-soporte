-- ============================================
-- Sistema de Clientes (para Empresas de Producción)
-- ============================================
-- Gestión completa de clientes con documentos
-- Similar al sistema de proveedores
-- Sistema multi-tenant con Row Level Security
-- ============================================

-- 1. TABLA DE CLIENTES
-- Primero eliminar la tabla si existe para evitar conflictos
DROP TABLE IF EXISTS clients CASCADE;
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  razon_social text,
  cuit text,
  telefono text,
  email text,
  provincia text,
  direccion text,
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. TABLA DE DOCUMENTOS DE CLIENTES
-- Primero eliminar la tabla si existe para evitar conflictos
DROP TABLE IF EXISTS client_documents CASCADE;
CREATE TABLE client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 3. TABLA DE MAPEO DE GOOGLE DRIVE
-- Primero eliminar la tabla si existe para evitar conflictos
DROP TABLE IF EXISTS client_drive_mapping CASCADE;
CREATE TABLE client_drive_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  google_drive_folder_id text NOT NULL,
  folder_name text NOT NULL,
  folder_link text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_nombre ON clients(nombre);
CREATE INDEX IF NOT EXISTS idx_clients_cuit ON clients(cuit);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_tenant ON client_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_by ON client_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_drive_mapping_client ON client_drive_mapping(client_id);
CREATE INDEX IF NOT EXISTS idx_client_drive_mapping_tenant ON client_drive_mapping(tenant_id);

-- ============================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_drive_mapping ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS - CLIENTES
-- ============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view clients from own tenant" ON clients;
DROP POLICY IF EXISTS "Users can create clients in own tenant" ON clients;
DROP POLICY IF EXISTS "Users can update clients in own tenant" ON clients;
DROP POLICY IF EXISTS "Admins and support can delete clients" ON clients;

-- SELECT: Usuarios autenticados del mismo tenant pueden ver clientes
CREATE POLICY "Users can view clients from own tenant"
  ON clients FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- INSERT: Usuarios autenticados del mismo tenant pueden crear clientes
CREATE POLICY "Users can create clients in own tenant"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- UPDATE: Usuarios autenticados del mismo tenant pueden actualizar clientes
CREATE POLICY "Users can update clients in own tenant"
  ON clients FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- DELETE: Solo admins y support pueden eliminar clientes
CREATE POLICY "Admins and support can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = clients.tenant_id
    )
  );

-- ============================================
-- POLÍTICAS RLS - DOCUMENTOS DE CLIENTES
-- ============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view client documents from own tenant" ON client_documents;
DROP POLICY IF EXISTS "Users can upload client documents in own tenant" ON client_documents;
DROP POLICY IF EXISTS "Admins and support can delete client documents" ON client_documents;

-- SELECT: Usuarios autenticados del mismo tenant pueden ver documentos
CREATE POLICY "Users can view client documents from own tenant"
  ON client_documents FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- INSERT: Usuarios autenticados del mismo tenant pueden subir documentos
CREATE POLICY "Users can upload client documents in own tenant"
  ON client_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND uploaded_by = auth.uid()
  );

-- DELETE: Solo admins y support pueden eliminar documentos
CREATE POLICY "Admins and support can delete client documents"
  ON client_documents FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = client_documents.tenant_id
    )
  );

-- ============================================
-- POLÍTICAS RLS - MAPEO DE GOOGLE DRIVE
-- ============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view client drive mappings from own tenant" ON client_drive_mapping;
DROP POLICY IF EXISTS "Users can create client drive mappings in own tenant" ON client_drive_mapping;
DROP POLICY IF EXISTS "Users can update client drive mappings in own tenant" ON client_drive_mapping;
DROP POLICY IF EXISTS "Admins can delete client drive mappings" ON client_drive_mapping;

-- SELECT: Usuarios autenticados del mismo tenant pueden ver mapeos
CREATE POLICY "Users can view client drive mappings from own tenant"
  ON client_drive_mapping FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- INSERT: Usuarios autenticados del mismo tenant pueden crear mapeos
CREATE POLICY "Users can create client drive mappings in own tenant"
  ON client_drive_mapping FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
  );

-- UPDATE: Usuarios autenticados del mismo tenant pueden actualizar mapeos
CREATE POLICY "Users can update client drive mappings in own tenant"
  ON client_drive_mapping FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- DELETE: Solo admins pueden eliminar mapeos
CREATE POLICY "Admins can delete client drive mappings"
  ON client_drive_mapping FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = client_drive_mapping.tenant_id
    )
  );

-- ============================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- ============================================

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
DROP TRIGGER IF EXISTS update_client_drive_mapping_updated_at ON client_drive_mapping;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_drive_mapping_updated_at
  BEFORE UPDATE ON client_drive_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CREAR BUCKET DE STORAGE PARA DOCUMENTOS
-- ============================================

-- Crear el bucket (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false, -- Privado por seguridad
  52428800, -- 50MB en bytes
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- POLÍTICAS DE STORAGE PARA DOCUMENTOS
-- ============================================

-- Eliminar políticas de storage existentes si existen
DROP POLICY IF EXISTS "Users can view client documents from own tenant" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload client documents in own tenant" ON storage.objects;
DROP POLICY IF EXISTS "Admins and support can delete client documents" ON storage.objects;

-- Política: Usuarios autenticados del mismo tenant pueden ver documentos
CREATE POLICY "Users can view client documents from own tenant"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Política: Usuarios autenticados del mismo tenant pueden subir documentos
CREATE POLICY "Users can upload client documents in own tenant"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Política: Solo admins y support pueden eliminar documentos
CREATE POLICY "Admins and support can delete client documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================
-- FUNCIÓN RPC PARA GUARDAR MAPEO DE DRIVE
-- ============================================

-- Eliminar todas las versiones de la función si existen
-- Nota: Hay una función existente con 3 parámetros (UUID, TEXT, TEXT) para subforums
-- Esta nueva función tiene 4 parámetros (uuid, text, text, text) para clients
-- Eliminamos todas las versiones posibles para evitar conflictos
DO $$ 
DECLARE
  func_record RECORD;
  func_schema TEXT;
BEGIN
  -- Buscar y eliminar todas las funciones con este nombre
  FOR func_record IN 
    SELECT 
      p.oid,
      p.proname,
      n.nspname as schema_name,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'save_client_drive_mapping'
      AND n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
        func_record.schema_name,
        func_record.proname,
        func_record.args
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla, continuar con la siguiente
        NULL;
    END;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    -- Si falla, continuar
    NULL;
END $$;

CREATE OR REPLACE FUNCTION save_client_drive_mapping(
  p_client_id uuid,
  p_google_drive_folder_id text,
  p_folder_name text,
  p_folder_link text
)
RETURNS void AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Obtener tenant_id del cliente
  SELECT tenant_id INTO v_tenant_id
  FROM clients
  WHERE id = p_client_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  -- Insertar o actualizar el mapeo
  INSERT INTO client_drive_mapping (
    client_id,
    tenant_id,
    google_drive_folder_id,
    folder_name,
    folder_link,
    created_by
  )
  VALUES (
    p_client_id,
    v_tenant_id,
    p_google_drive_folder_id,
    p_folder_name,
    p_folder_link,
    auth.uid()
  )
  ON CONFLICT (client_id) DO UPDATE SET
    google_drive_folder_id = EXCLUDED.google_drive_folder_id,
    folder_name = EXCLUDED.folder_name,
    folder_link = EXCLUDED.folder_link,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE clients IS 'Clientes de empresas de producción';
COMMENT ON TABLE client_documents IS 'Documentos asociados a clientes';
COMMENT ON TABLE client_drive_mapping IS 'Mapeo de carpetas de Google Drive para clientes';
COMMENT ON FUNCTION save_client_drive_mapping IS 'Guarda o actualiza el mapeo de Google Drive para un cliente';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

