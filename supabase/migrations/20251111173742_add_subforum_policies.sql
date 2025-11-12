/*
  # Add RLS policies for subforums table

  1. Security Policies
    - Admin and support can view all subforums
    - Users can view subforums they have permission to access
    - Admin and support can create subforums
    - Admin and support can update subforums
    - Admin can delete subforums
    
  2. Notes
    - Enables admin and support to create and manage subforums
    - Users can only view subforums they have explicit permission for
*/

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin and support can view all subforums" ON subforums;
DROP POLICY IF EXISTS "Users can view accessible subforums" ON subforums;
DROP POLICY IF EXISTS "Admin and support can create subforums" ON subforums;
DROP POLICY IF EXISTS "Admin and support can update subforums" ON subforums;
DROP POLICY IF EXISTS "Admin can delete subforums" ON subforums;

-- View policies
CREATE POLICY "Admin and support can view all subforums"
  ON subforums
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can view accessible subforums"
  ON subforums
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM subforum_permissions
      WHERE subforum_id = subforums.id AND can_view = true
    )
  );

-- Insert policy
CREATE POLICY "Admin and support can create subforums"
  ON subforums
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Update policy
CREATE POLICY "Admin and support can update subforums"
  ON subforums
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Delete policy
CREATE POLICY "Admin can delete subforums"
  ON subforums
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
