/*
  # Simplify meeting rooms access

  1. Changes
    - Allow all authenticated users to view active meeting rooms
    - Keep admin-only permissions for creating/updating rooms
    - Make meeting rooms accessible to everyone like public Meet rooms
    
  2. Security
    - Only admins can create and manage rooms
    - All authenticated users can join any active room
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view rooms they have access to" ON meeting_rooms;
DROP POLICY IF EXISTS "Admin can update meeting rooms" ON meeting_rooms;
DROP POLICY IF EXISTS "Admin can create meeting rooms" ON meeting_rooms;

-- Create new simplified policies
CREATE POLICY "All authenticated users can view active rooms"
  ON meeting_rooms
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admin can create meeting rooms"
  ON meeting_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update meeting rooms"
  ON meeting_rooms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete meeting rooms"
  ON meeting_rooms
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
