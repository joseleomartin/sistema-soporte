/*
  # Corregir política de INSERT para mensajes directos

  1. Problema
    - Los usuarios normales no pueden responder a mensajes de administradores
    - La política actual podría estar bloqueando respuestas
    
  2. Solución
    - Actualizar la política para permitir que usuarios normales respondan a admin/support
    - Asegurar que si un admin/support envió un mensaje a un usuario, el usuario pueda responder
*/

-- Eliminar la política existente
DROP POLICY IF EXISTS "Users can send messages" ON direct_messages;

-- Crear política simplificada y corregida que permite:
-- 1. Admin/support pueden enviar a cualquiera
-- 2. Usuarios normales pueden enviar a admin/support (incluyendo respuestas)
CREATE POLICY "Users can send messages"
  ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      -- Si el remitente es admin o support, puede enviar a cualquiera
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
      )
      OR
      -- Si el remitente es usuario normal, puede enviar a admin/support
      -- Esto incluye respuestas a mensajes recibidos de admin/support
      (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'user'
        )
        AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = receiver_id
          AND profiles.role IN ('admin', 'support')
        )
      )
    )
  );

