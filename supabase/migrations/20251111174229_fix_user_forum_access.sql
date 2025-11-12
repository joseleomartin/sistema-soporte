/*
  # Fix user forum access

  1. Changes
    - Add policies for subforum_permissions table so admin/support can grant access
    - Update forum_messages policies to allow users to post in forums they have access to
    - Ensure users can view subforums they have permission for
    
  2. Security
    - Admin and support can manage permissions
    - Users can only post where they have can_post permission
    - Users can only view where they have can_view permission
*/

-- Enable RLS on subforum_permissions if not already enabled
ALTER TABLE subforum_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on subforum_permissions
DROP POLICY IF EXISTS "Admin and support can view all permissions" ON subforum_permissions;
DROP POLICY IF EXISTS "Admin and support can create permissions" ON subforum_permissions;
DROP POLICY IF EXISTS "Admin and support can update permissions" ON subforum_permissions;
DROP POLICY IF EXISTS "Admin and support can delete permissions" ON subforum_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON subforum_permissions;

-- Subforum permissions policies
CREATE POLICY "Admin and support can view all permissions"
  ON subforum_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can view own permissions"
  ON subforum_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin and support can create permissions"
  ON subforum_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Admin and support can update permissions"
  ON subforum_permissions
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

CREATE POLICY "Admin and support can delete permissions"
  ON subforum_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Update forum_messages policies
DROP POLICY IF EXISTS "Users can post in permitted subforums" ON forum_messages;
DROP POLICY IF EXISTS "Users can view messages in permitted subforums" ON forum_messages;

CREATE POLICY "Users can view messages in permitted subforums"
  ON forum_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
    OR
    EXISTS (
      SELECT 1 FROM subforum_permissions
      WHERE subforum_permissions.subforum_id = forum_messages.subforum_id
      AND subforum_permissions.user_id = auth.uid()
      AND subforum_permissions.can_view = true
    )
  );

CREATE POLICY "Users can post in permitted subforums"
  ON forum_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
    OR
    EXISTS (
      SELECT 1 FROM subforum_permissions
      WHERE subforum_permissions.subforum_id = forum_messages.subforum_id
      AND subforum_permissions.user_id = auth.uid()
      AND subforum_permissions.can_post = true
    )
  );
