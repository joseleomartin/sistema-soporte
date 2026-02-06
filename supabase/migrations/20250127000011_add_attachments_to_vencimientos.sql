-- ============================================
-- Sistema de Archivos Adjuntos para Vencimientos
-- ============================================
-- Similar a task_attachments pero para vencimientos_gestion
-- ============================================

-- ============================================
-- TABLA: vencimientos_gestion_attachments
-- ============================================
CREATE TABLE IF NOT EXISTS vencimientos_gestion_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vencimiento_id UUID NOT NULL REFERENCES vencimientos_gestion(id) ON DELETE CASCADE,
    message_id UUID REFERENCES vencimientos_gestion_messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_attachments_vencimiento_id ON vencimientos_gestion_attachments(vencimiento_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_attachments_message_id ON vencimientos_gestion_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_attachments_uploaded_by ON vencimientos_gestion_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_vencimientos_gestion_attachments_tenant_id ON vencimientos_gestion_attachments(tenant_id);

-- ============================================
-- POLÍTICAS RLS: vencimientos_gestion_attachments
-- ============================================
ALTER TABLE vencimientos_gestion_attachments ENABLE ROW LEVEL SECURITY;

-- Ver archivos adjuntos de vencimientos de su tenant
CREATE POLICY "Users can view own tenant vencimientos_gestion_attachments"
  ON vencimientos_gestion_attachments FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Crear archivos adjuntos en vencimientos de su tenant
CREATE POLICY "Users can create own tenant vencimientos_gestion_attachments"
  ON vencimientos_gestion_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Actualizar archivos adjuntos de vencimientos de su tenant (solo el que subió)
CREATE POLICY "Users can update own uploaded vencimientos_gestion_attachments"
  ON vencimientos_gestion_attachments FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

-- Eliminar archivos adjuntos de vencimientos de su tenant (solo el que subió o admins)
CREATE POLICY "Users can delete own uploaded vencimientos_gestion_attachments"
  ON vencimientos_gestion_attachments FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );

-- ============================================
-- STORAGE BUCKET: vencimientos-attachments
-- ============================================

-- Crear el bucket si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vencimientos-attachments',
  'vencimientos-attachments',
  false,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- POLÍTICAS RLS PARA STORAGE
-- ============================================

-- Política para SELECT (ver archivos)
CREATE POLICY "Users can view vencimientos attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vencimientos-attachments'
    AND (
      -- Usuario asignado al vencimiento
      auth.uid() IN (
        SELECT assigned_to_user 
        FROM vencimientos_gestion_assignments
        WHERE vencimiento_id = (string_to_array(name, '/'))[1]::uuid
      )
      OR
      -- Usuario del mismo tenant que creó el vencimiento
      EXISTS (
        SELECT 1 
        FROM vencimientos_gestion vg
        JOIN profiles p ON p.id = auth.uid()
        WHERE vg.id = (string_to_array(name, '/'))[1]::uuid
        AND vg.tenant_id = p.tenant_id
      )
      OR
      -- Administrador
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );

-- Política para INSERT (subir archivos)
CREATE POLICY "Users can upload vencimientos attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vencimientos-attachments'
    AND (
      -- Usuario asignado al vencimiento
      auth.uid() IN (
        SELECT assigned_to_user 
        FROM vencimientos_gestion_assignments
        WHERE vencimiento_id = (string_to_array(name, '/'))[1]::uuid
      )
      OR
      -- Usuario del mismo tenant que creó el vencimiento
      EXISTS (
        SELECT 1 
        FROM vencimientos_gestion vg
        JOIN profiles p ON p.id = auth.uid()
        WHERE vg.id = (string_to_array(name, '/'))[1]::uuid
        AND vg.tenant_id = p.tenant_id
      )
      OR
      -- Administrador
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );

-- Política para DELETE (eliminar archivos)
CREATE POLICY "Users can delete own vencimientos attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vencimientos-attachments'
    AND (
      -- Usuario que subió el archivo
      auth.uid() IN (
        SELECT uploaded_by
        FROM vencimientos_gestion_attachments
        WHERE file_path = name
      )
      OR
      -- Administrador
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );
