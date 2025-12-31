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
-- Modificar la tabla existente para soportar tanto subforum_id como client_id
-- Si la tabla no existe, crearla con ambas columnas
DO $$
DECLARE
  has_subforum_id BOOLEAN;
  has_client_id BOOLEAN;
BEGIN
  -- Si la tabla no existe, crearla
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_drive_mapping') THEN
    CREATE TABLE client_drive_mapping (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      subforum_id uuid REFERENCES subforums(id) ON DELETE CASCADE,
      client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
      tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
      google_drive_folder_id text NOT NULL,
      folder_name text NOT NULL,
      folder_link text,
      created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT check_subforum_or_client CHECK ((subforum_id IS NOT NULL AND client_id IS NULL) OR (subforum_id IS NULL AND client_id IS NOT NULL)),
      CONSTRAINT unique_subforum UNIQUE(subforum_id),
      CONSTRAINT unique_client UNIQUE(client_id)
    );
  ELSE
    -- Si la tabla existe, agregar las columnas que falten
    -- Agregar subforum_id si no existe (para compatibilidad con Forums)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'subforum_id') THEN
      ALTER TABLE client_drive_mapping ADD COLUMN subforum_id uuid REFERENCES subforums(id) ON DELETE CASCADE;
    END IF;
    
    -- Agregar client_id si no existe (para nuevo sistema de Clientes)
    -- IMPORTANTE: Debe ser nullable para permitir que solo subforum_id tenga valor
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'client_id') THEN
      ALTER TABLE client_drive_mapping ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE CASCADE;
      -- Asegurar explícitamente que sea nullable
      ALTER TABLE client_drive_mapping ALTER COLUMN client_id DROP NOT NULL;
    END IF;
    
    -- Agregar tenant_id si no existe
    -- IMPORTANTE: Debe ser nullable para permitir uso con subforums
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'tenant_id') THEN
      ALTER TABLE client_drive_mapping ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
      -- Asegurar explícitamente que sea nullable
      ALTER TABLE client_drive_mapping ALTER COLUMN tenant_id DROP NOT NULL;
    END IF;
    
    -- Agregar folder_link si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'folder_link') THEN
      ALTER TABLE client_drive_mapping ADD COLUMN folder_link text;
    END IF;
    
    -- Agregar created_by si no existe
    -- IMPORTANTE: Debe ser nullable para permitir uso con subforums (la función original no lo usa)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'created_by') THEN
      ALTER TABLE client_drive_mapping ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE CASCADE;
      -- Asegurar explícitamente que sea nullable
      ALTER TABLE client_drive_mapping ALTER COLUMN created_by DROP NOT NULL;
    END IF;
    
    -- Asegurar que subforum_id puede ser NULL (si existe y es NOT NULL)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'subforum_id' AND is_nullable = 'NO') THEN
      ALTER TABLE client_drive_mapping ALTER COLUMN subforum_id DROP NOT NULL;
    END IF;
    
    -- Asegurar que client_id puede ser NULL (si existe y es NOT NULL)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'client_id' AND is_nullable = 'NO') THEN
      ALTER TABLE client_drive_mapping ALTER COLUMN client_id DROP NOT NULL;
    END IF;
    
    -- Asegurar que tenant_id puede ser NULL (si existe y es NOT NULL)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'tenant_id' AND is_nullable = 'NO') THEN
      ALTER TABLE client_drive_mapping ALTER COLUMN tenant_id DROP NOT NULL;
    END IF;
    
    -- Asegurar que created_by puede ser NULL (si existe y es NOT NULL)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'created_by' AND is_nullable = 'NO') THEN
      ALTER TABLE client_drive_mapping ALTER COLUMN created_by DROP NOT NULL;
    END IF;
    
    -- Manejar restricciones UNIQUE de manera compatible
    -- Para subforum_id: mantener constraint UNIQUE simple (necesario para ON CONFLICT en función original)
    -- Para client_id: usar índice parcial (permite NULL)
    
    -- Verificar si ambas columnas existen
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'subforum_id') INTO has_subforum_id;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_drive_mapping' AND column_name = 'client_id') INTO has_client_id;
    
    -- Para subforum_id: mantener/crear constraint UNIQUE simple (compatibilidad con función original que usa ON CONFLICT)
    IF has_subforum_id THEN
      -- Eliminar constraints/índices existentes de subforum_id
      ALTER TABLE client_drive_mapping DROP CONSTRAINT IF EXISTS client_drive_mapping_subforum_id_key;
      ALTER TABLE client_drive_mapping DROP CONSTRAINT IF EXISTS unique_subforum;
      DROP INDEX IF EXISTS client_drive_mapping_subforum_id_key;
      DROP INDEX IF EXISTS unique_subforum;
      -- Crear constraint UNIQUE simple (necesario para ON CONFLICT en función original)
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_drive_mapping_subforum_id_key' AND conrelid = 'client_drive_mapping'::regclass) THEN
        ALTER TABLE client_drive_mapping ADD CONSTRAINT client_drive_mapping_subforum_id_key UNIQUE(subforum_id);
      END IF;
    END IF;
    
    -- Para client_id: usar índice parcial (permite NULL cuando se usa subforum_id)
    IF has_client_id THEN
      -- Eliminar constraints/índices existentes de client_id
      ALTER TABLE client_drive_mapping DROP CONSTRAINT IF EXISTS client_drive_mapping_client_id_key;
      ALTER TABLE client_drive_mapping DROP CONSTRAINT IF EXISTS unique_client;
      DROP INDEX IF EXISTS client_drive_mapping_client_id_key;
      DROP INDEX IF EXISTS unique_client;
      -- Crear índice parcial (solo cuando client_id no es NULL)
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'client_drive_mapping' AND indexname = 'unique_client') THEN
        CREATE UNIQUE INDEX unique_client ON client_drive_mapping(client_id) WHERE client_id IS NOT NULL;
      END IF;
    END IF;
    
    -- Agregar CHECK constraint si no existe
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_subforum_or_client' AND conrelid = 'client_drive_mapping'::regclass) THEN
      ALTER TABLE client_drive_mapping ADD CONSTRAINT check_subforum_or_client CHECK ((subforum_id IS NOT NULL AND client_id IS NULL) OR (subforum_id IS NULL AND client_id IS NOT NULL));
    END IF;
  END IF;
END $$;

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_nombre ON clients(nombre);
CREATE INDEX IF NOT EXISTS idx_clients_cuit ON clients(cuit);
CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_tenant ON client_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_uploaded_by ON client_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_client_drive_mapping_subforum ON client_drive_mapping(subforum_id) WHERE subforum_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_drive_mapping_client ON client_drive_mapping(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_drive_mapping_tenant ON client_drive_mapping(tenant_id) WHERE tenant_id IS NOT NULL;

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

-- Eliminar políticas existentes si existen (solo las nuevas, mantener las de subforums si existen)
DROP POLICY IF EXISTS "Users can view client drive mappings from own tenant" ON client_drive_mapping;
DROP POLICY IF EXISTS "Users can create client drive mappings in own tenant" ON client_drive_mapping;
DROP POLICY IF EXISTS "Users can update client drive mappings in own tenant" ON client_drive_mapping;
DROP POLICY IF EXISTS "Admins can delete client drive mappings" ON client_drive_mapping;

-- SELECT: Para clients (tenant_id), usuarios del mismo tenant pueden ver mapeos
-- Para subforums, usar la política existente basada en subforum_permissions
CREATE POLICY "Users can view client drive mappings from own tenant"
  ON client_drive_mapping FOR SELECT
  TO authenticated
  USING (
    -- Si es un client (tiene client_id y tenant_id)
    (client_id IS NOT NULL AND tenant_id = get_user_tenant_id())
    OR
    -- Si es un subforum (tiene subforum_id), verificar permisos de subforum
    (subforum_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM subforums
      WHERE subforums.id = client_drive_mapping.subforum_id
      AND (
        EXISTS (
          SELECT 1 FROM subforum_permissions
          WHERE subforum_permissions.subforum_id = subforums.id
          AND subforum_permissions.user_id = auth.uid()
          AND subforum_permissions.can_view = true
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'support')
        )
      )
    ))
  );

-- INSERT: Para clients, usuarios del mismo tenant pueden crear mapeos
-- Para subforums, solo admins/support (manejado por la función RPC)
CREATE POLICY "Users can create client drive mappings in own tenant"
  ON client_drive_mapping FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Si es un client
    (client_id IS NOT NULL AND tenant_id = get_user_tenant_id() AND created_by = auth.uid())
    OR
    -- Si es un subforum, solo admins/support (la función RPC ya valida esto)
    (subforum_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    ))
  );

-- UPDATE: Para clients, usuarios del mismo tenant pueden actualizar mapeos
-- Para subforums, solo admins/support
CREATE POLICY "Users can update client drive mappings in own tenant"
  ON client_drive_mapping FOR UPDATE
  TO authenticated
  USING (
    -- Si es un client
    (client_id IS NOT NULL AND tenant_id = get_user_tenant_id())
    OR
    -- Si es un subforum, solo admins/support
    (subforum_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    ))
  )
  WITH CHECK (
    -- Si es un client
    (client_id IS NOT NULL AND tenant_id = get_user_tenant_id())
    OR
    -- Si es un subforum, solo admins/support
    (subforum_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    ))
  );

-- DELETE: Solo admins pueden eliminar mapeos (tanto clients como subforums)
CREATE POLICY "Admins can delete client drive mappings"
  ON client_drive_mapping FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND (
        -- Si es un client, verificar tenant
        (client_drive_mapping.client_id IS NOT NULL AND profiles.tenant_id = client_drive_mapping.tenant_id)
        OR
        -- Si es un subforum, cualquier admin
        (client_drive_mapping.subforum_id IS NOT NULL)
      )
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

-- Crear función para subforums (3 parámetros) - mantener compatibilidad
CREATE OR REPLACE FUNCTION save_client_drive_mapping(
  p_subforum_id uuid,
  p_google_drive_folder_id text,
  p_folder_name text
)
RETURNS uuid AS $$
DECLARE
  v_user_role text;
  v_mapping_id uuid;
BEGIN
  -- Verificar que el usuario es admin o support
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  IF v_user_role NOT IN ('admin', 'support') THEN
    RAISE EXCEPTION 'Solo administradores y soporte pueden configurar carpetas de Drive';
  END IF;
  
  -- Verificar que el subforum existe
  IF NOT EXISTS (SELECT 1 FROM subforums WHERE id = p_subforum_id) THEN
    RAISE EXCEPTION 'El subforo especificado no existe';
  END IF;
  
  -- Insertar o actualizar el mapeo
  INSERT INTO client_drive_mapping (
    subforum_id,
    google_drive_folder_id,
    folder_name
  )
  VALUES (
    p_subforum_id,
    p_google_drive_folder_id,
    p_folder_name
  )
  ON CONFLICT ON CONSTRAINT client_drive_mapping_subforum_id_key
  DO UPDATE SET
    google_drive_folder_id = EXCLUDED.google_drive_folder_id,
    folder_name = EXCLUDED.folder_name,
    updated_at = now()
  RETURNING id INTO v_mapping_id;
  
  RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear función para clients (4 parámetros) - nueva funcionalidad
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
  ON CONFLICT (client_id) WHERE client_id IS NOT NULL
  DO UPDATE SET
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
COMMENT ON TABLE client_drive_mapping IS 'Mapeo de carpetas de Google Drive para clientes y subforums';
COMMENT ON FUNCTION save_client_drive_mapping(uuid, text, text) IS 'Guarda o actualiza el mapeo de Google Drive para un subforum (3 parámetros)';
COMMENT ON FUNCTION save_client_drive_mapping(uuid, text, text, text) IS 'Guarda o actualiza el mapeo de Google Drive para un cliente (4 parámetros)';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

