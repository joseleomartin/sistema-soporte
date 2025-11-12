/*
  # Allow users to comment on their own tickets

  1. Changes
    - Update INSERT policy on ticket_comments to allow users to comment on their own tickets
    - Users can only comment on tickets they created
    - Support and admin can comment on any ticket
    
  2. Security
    - Maintains security by checking ticket ownership
    - Users cannot comment on tickets they didn't create
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Only support and admin can create comments" ON ticket_comments;

-- Create new INSERT policy that allows users to comment on their own tickets
CREATE POLICY "Users can comment on own tickets, support and admin on any"
  ON ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      -- User can comment on their own tickets
      EXISTS (
        SELECT 1 FROM tickets
        WHERE tickets.id = ticket_comments.ticket_id
        AND tickets.created_by = auth.uid()
      )
      OR
      -- Support and admin can comment on any ticket
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support')
      )
    )
  );
