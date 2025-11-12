/*
  # Create forum messages table for bulletin board chat

  1. New Tables
    - `forum_messages` - Messages within a subforum (bulletin board style)
      - `id` (uuid, primary key)
      - `subforum_id` (uuid, foreign key to subforums)
      - `content` (text) - message content
      - `created_by` (uuid, foreign key to profiles)
      - `attachments` (jsonb) - array of attachment objects
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
  2. Changes to existing tables
    - No changes needed, forum_threads can coexist for pinned announcements
    
  3. Security
    - Enable RLS on `forum_messages` table
    - Users can view messages from subforums they have access to
    - All authenticated users can post messages in subforums
    - Users can edit/delete their own messages
    - Admin and support can moderate (edit/delete any message)
    
  4. Notes
    - This creates a shared bulletin board style chat
    - Subforums are created by admin/support
    - Regular users can post and share files
    - Attachments stored inline as JSON
*/

CREATE TABLE IF NOT EXISTS forum_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subforum_id uuid NOT NULL REFERENCES subforums(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE forum_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from accessible subforums"
  ON forum_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM subforum_permissions
      WHERE subforum_id = forum_messages.subforum_id AND can_view = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can post messages in subforums"
  ON forum_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM subforum_permissions
      WHERE subforum_id = forum_messages.subforum_id AND can_post = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can update own messages"
  ON forum_messages
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE POLICY "Users can delete own messages or moderators can delete any"
  ON forum_messages
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'support')
    )
  );

CREATE INDEX IF NOT EXISTS idx_forum_messages_subforum_id ON forum_messages(subforum_id);
CREATE INDEX IF NOT EXISTS idx_forum_messages_created_by ON forum_messages(created_by);
CREATE INDEX IF NOT EXISTS idx_forum_messages_created_at ON forum_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_messages_attachments ON forum_messages USING gin(attachments);
