-- ============================================
-- Sistema de Códigos de Invitación por Tenant
-- ============================================
-- Permite que los usuarios se registren en una empresa específica
-- usando un código de invitación sin poder seleccionar la empresa
-- ============================================

-- Tabla para códigos de invitación
CREATE TABLE IF NOT EXISTS invitation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz,
  max_uses integer, -- NULL = ilimitado
  current_uses integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invitation_codes_tenant_id ON invitation_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_active ON invitation_codes(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- Política: Solo administradores pueden ver códigos de su tenant
CREATE POLICY "Admins can view invitation codes from own tenant"
  ON invitation_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = invitation_codes.tenant_id
    )
  );

-- Política: Solo administradores pueden crear códigos en su tenant
CREATE POLICY "Admins can create invitation codes in own tenant"
  ON invitation_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = tenant_id
    )
    AND created_by = auth.uid()
  );

-- Política: Solo administradores pueden actualizar códigos de su tenant
CREATE POLICY "Admins can update invitation codes in own tenant"
  ON invitation_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = invitation_codes.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = invitation_codes.tenant_id
    )
  );

-- Política: Solo administradores pueden eliminar códigos de su tenant
CREATE POLICY "Admins can delete invitation codes in own tenant"
  ON invitation_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.tenant_id = invitation_codes.tenant_id
    )
  );

-- Política: Cualquiera puede validar códigos (para el registro)
CREATE POLICY "Anyone can validate invitation codes"
  ON invitation_codes FOR SELECT
  TO anon
  USING (is_active = true);

-- Función para validar y usar un código de invitación
CREATE OR REPLACE FUNCTION validate_and_use_invitation_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_code_record invitation_codes%ROWTYPE;
BEGIN
  -- Buscar el código
  SELECT * INTO v_code_record
  FROM invitation_codes
  WHERE code = p_code
    AND is_active = true;
  
  -- Verificar que existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código de invitación no válido o inactivo';
  END IF;
  
  -- Verificar que no haya expirado
  IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
    RAISE EXCEPTION 'El código de invitación ha expirado';
  END IF;
  
  -- Verificar límite de usos
  IF v_code_record.max_uses IS NOT NULL AND v_code_record.current_uses >= v_code_record.max_uses THEN
    RAISE EXCEPTION 'El código de invitación ha alcanzado su límite de usos';
  END IF;
  
  -- Incrementar contador de usos
  UPDATE invitation_codes
  SET current_uses = current_uses + 1,
      updated_at = NOW()
  WHERE id = v_code_record.id;
  
  RETURN v_code_record.tenant_id;
END;
$$;

-- Función para generar un código de invitación
CREATE OR REPLACE FUNCTION generate_invitation_code(
  p_tenant_id uuid,
  p_created_by uuid,
  p_expires_at timestamptz DEFAULT NULL,
  p_max_uses integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_code_exists boolean;
BEGIN
  -- Verificar que el creador es admin del tenant
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_created_by
    AND role = 'admin'
    AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Solo los administradores pueden generar códigos de invitación';
  END IF;
  
  -- Generar código único (8 caracteres alfanuméricos)
  LOOP
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Verificar que no existe
    SELECT EXISTS(SELECT 1 FROM invitation_codes WHERE code = v_code) INTO v_code_exists;
    
    EXIT WHEN NOT v_code_exists;
  END LOOP;
  
  -- Crear el código
  INSERT INTO invitation_codes (tenant_id, code, created_by, expires_at, max_uses)
  VALUES (p_tenant_id, v_code, p_created_by, p_expires_at, p_max_uses);
  
  RETURN v_code;
END;
$$;

-- Comentarios
COMMENT ON TABLE invitation_codes IS 'Códigos de invitación para que usuarios se registren en empresas específicas';
COMMENT ON FUNCTION validate_and_use_invitation_code IS 'Valida y usa un código de invitación, retornando el tenant_id';
COMMENT ON FUNCTION generate_invitation_code IS 'Genera un nuevo código de invitación para un tenant';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================







