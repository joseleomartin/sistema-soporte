/*
  # Add delete permissions for admin and support

  1. Changes
    - Update forum_messages DELETE policy to allow admin/support to delete any message
    - Ensure subforums DELETE policy allows admin/support to delete forums
    
  2. Security
    - Admin and support can delete any message in any subforum
    - Admin and support can delete any subforum
    - Users can still delete their own messages
*/

-- Drop existing delete policy on forum_messages
DROP POLICY IF EXISTS "Users can delete own messages or moderators can delete any" ON forum_messages;

-- Create new delete policy that allows admin/support to delete any message
CREATE POLICY "Users can delete own messages, admin and support can delete any"
  ON forum_messages
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

-- Update subforums delete policy to allow support as well
DROP POLICY IF EXISTS "Admin can delete subforums" ON subforums;
DROP POLICY IF EXISTS "Admin and support can delete subforums" ON subforums;

CREATE POLICY "Admin and support can delete subforums"
  ON subforums
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );
