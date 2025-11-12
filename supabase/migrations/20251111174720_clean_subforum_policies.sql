/*
  # Clean up subforum policies

  1. Changes
    - Remove duplicate and conflicting policies on subforums table
    - Create clean, simple policies for users to view subforums they have access to
    
  2. Security
    - Admin and support can view all subforums
    - Users can view subforums where they have can_view permission
*/

-- Drop all existing policies on subforums
DROP POLICY IF EXISTS "Admin and support can create subforums" ON subforums;
DROP POLICY IF EXISTS "Admin and support can update subforums" ON subforums;
DROP POLICY IF EXISTS "Admin and support can view all subforums" ON subforums;
DROP POLICY IF EXISTS "Admin can create subforums" ON subforums;
DROP POLICY IF EXISTS "Admin can delete subforums" ON subforums;
DROP POLICY IF EXISTS "Admin can update subforums" ON subforums;
DROP POLICY IF EXISTS "Users can view accessible subforums" ON subforums;
DROP POLICY IF EXISTS "Users can view subforums they have access to" ON subforums;

-- Create clean policies
CREATE POLICY "Anyone authenticated can view subforums"
  ON subforums
  FOR SELECT
  TO authenticated
  USING (true);

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
