-- ============================================
-- Sistema de Proveedores
-- ============================================
-- Gestión completa de proveedores con documentos
-- Sistema multi-tenant con Row Level Security
-- ============================================

-- 1. TABLA DE PROVEEDORES
CREATE TABLE IF NOT EXISTS suppliers (
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

-- 2. TABLA DE DOCUMENTOS DE PROVEEDORES
CREATE TABLE IF NOT EXISTS supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 3. TABLA DE MAPEO DE GOOGLE DRIVE (opcional, similar a clientes)
CREATE TABLE IF NOT EXISTS supplier_drive_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  google_drive_folder_id text NOT NULL,
  folder_name text NOT NULL,
  folder_link text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier_id)
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_nombre ON suppliers(nombre);
CREATE INDEX IF NOT EXISTS idx_suppliers_cuit ON suppliers(cuit);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_tenant ON supplier_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_uploaded_by ON supplier_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_supplier_drive_mapping_supplier ON supplier_drive_mapping(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_drive_mapping_tenant ON supplier_drive_mapping(tenant_id);

-- ============================================
-- HABILITAR ROW LEVEL SECURITY
-- ============================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_drive_mapping ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS - PROVEEDORES
-- ============================================

-- SELECT: Usuarios autenticados del mismo tenant pueden ver proveedores
CREATE POLICY "Users can view suppliers from own tenant"
  ON suppliers FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- INSERT: Usuarios autenticados del mismo tenant pueden crear proveedores
CREATE POLICY "Users can create suppliers in own tenant"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- UPDATE: Usuarios autenticados del mismo tenant pueden actualizar proveedores
CREATE POLICY "Users can update suppliers in own tenant"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- DELETE: Solo admins y support pueden eliminar proveedores
CREATE POLICY "Admins and support can delete suppliers"
  ON suppliers FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = suppliers.tenant_id
    )
  );

-- ============================================
-- POLÍTICAS RLS - DOCUMENTOS DE PROVEEDORES
-- ============================================

-- SELECT: Usuarios autenticados del mismo tenant pueden ver documentos
CREATE POLICY "Users can view supplier documents from own tenant"
  ON supplier_documents FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_documents.supplier_id
      AND suppliers.tenant_id = get_user_tenant_id()
    )
  );

-- INSERT: Usuarios autenticados del mismo tenant pueden subir documentos
CREATE POLICY "Users can create supplier documents in own tenant"
  ON supplier_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_documents.supplier_id
      AND suppliers.tenant_id = get_user_tenant_id()
    )
  );

-- DELETE: Usuarios autenticados pueden eliminar sus propios documentos o admins pueden eliminar cualquiera
CREATE POLICY "Users can delete supplier documents"
  ON supplier_documents FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = supplier_documents.tenant_id
      )
    )
  );

-- ============================================
-- POLÍTICAS RLS - MAPEO DE GOOGLE DRIVE
-- ============================================

-- SELECT: Usuarios autenticados del mismo tenant pueden ver mapeos
CREATE POLICY "Users can view supplier drive mappings from own tenant"
  ON supplier_drive_mapping FOR SELECT
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_drive_mapping.supplier_id
      AND suppliers.tenant_id = get_user_tenant_id()
    )
  );

-- INSERT: Solo admins y support pueden crear mapeos
CREATE POLICY "Admins and support can create supplier drive mappings"
  ON supplier_drive_mapping FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = supplier_drive_mapping.tenant_id
    )
    AND EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_drive_mapping.supplier_id
      AND suppliers.tenant_id = get_user_tenant_id()
    )
  );

-- UPDATE: Solo admins y support pueden actualizar mapeos
CREATE POLICY "Admins and support can update supplier drive mappings"
  ON supplier_drive_mapping FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
      AND profiles.tenant_id = supplier_drive_mapping.tenant_id
    )
  )
  WITH CHECK (tenant_id = get_user_tenant_id());

-- DELETE: Solo admins pueden eliminar mapeos
CREATE POLICY "Admins can delete supplier drive mappings"
  ON supplier_drive_mapping FOR DELETE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = supplier_drive_mapping.tenant_id
    )
  );

-- ============================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- ============================================

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_drive_mapping_updated_at
  BEFORE UPDATE ON supplier_drive_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CREAR BUCKET DE STORAGE PARA DOCUMENTOS
-- ============================================

-- Crear el bucket (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-documents',
  'supplier-documents',
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

-- Política: Usuarios autenticados del mismo tenant pueden ver documentos
CREATE POLICY "Users can view supplier documents from own tenant"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'supplier-documents'
    AND EXISTS (
      SELECT 1 FROM supplier_documents
      WHERE supplier_documents.file_path = (storage.objects.name)
      AND supplier_documents.tenant_id = get_user_tenant_id()
    )
  );

-- Política: Usuarios autenticados del mismo tenant pueden subir documentos
CREATE POLICY "Users can upload supplier documents in own tenant"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-documents'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tenant_id = get_user_tenant_id()
    )
  );

-- Política: Usuarios autenticados pueden eliminar sus propios documentos o admins pueden eliminar cualquiera
CREATE POLICY "Users can delete supplier documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'supplier-documents'
    AND (
      EXISTS (
        SELECT 1 FROM supplier_documents
        WHERE supplier_documents.file_path = (storage.objects.name)
        AND supplier_documents.uploaded_by = auth.uid()
        AND supplier_documents.tenant_id = get_user_tenant_id()
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
        AND profiles.tenant_id = get_user_tenant_id()
      )
    )
  );

-- ============================================
-- FUNCIÓN RPC PARA GUARDAR MAPEO DE DRIVE
-- ============================================

CREATE OR REPLACE FUNCTION save_supplier_drive_mapping(
  p_supplier_id uuid,
  p_google_drive_folder_id text,
  p_folder_name text
)
RETURNS void AS $$
DECLARE
  v_tenant_id uuid;
  v_user_role text;
BEGIN
  -- Obtener tenant_id y rol del usuario
  SELECT tenant_id, role INTO v_tenant_id, v_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Verificar que el usuario sea admin o support
  IF v_user_role NOT IN ('admin', 'support') THEN
    RAISE EXCEPTION 'Solo administradores y soporte pueden configurar carpetas de Drive';
  END IF;

  -- Verificar que el proveedor pertenezca al mismo tenant
  IF NOT EXISTS (
    SELECT 1 FROM suppliers
    WHERE id = p_supplier_id
    AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'El proveedor no pertenece a tu empresa';
  END IF;

  -- Insertar o actualizar el mapeo
  INSERT INTO supplier_drive_mapping (
    supplier_id,
    tenant_id,
    google_drive_folder_id,
    folder_name,
    folder_link,
    created_by
  )
  VALUES (
    p_supplier_id,
    v_tenant_id,
    p_google_drive_folder_id,
    p_folder_name,
    'https://drive.google.com/drive/folders/' || p_google_drive_folder_id,
    auth.uid()
  )
  ON CONFLICT (supplier_id) DO UPDATE
  SET
    google_drive_folder_id = EXCLUDED.google_drive_folder_id,
    folder_name = EXCLUDED.folder_name,
    folder_link = EXCLUDED.folder_link,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


