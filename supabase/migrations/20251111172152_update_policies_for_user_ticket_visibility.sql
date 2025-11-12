/*
  # Update policies for user ticket visibility

  1. Changes
    - Update SELECT policy on tickets to allow users to view their own tickets
    - Update SELECT policy on ticket_comments to allow users to view comments on their tickets
    
  2. Security
    - Users can view only their own tickets (created_by)
    - Support and admin can view all tickets
    - Users can view comments on their own tickets
    - Support and admin can view all comments
*/

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Only support and admin can view tickets" ON tickets;
DROP POLICY IF EXISTS "Only support and admin can view comments" ON ticket_comments;

-- Create new SELECT policy for tickets
CREATE POLICY "Users can view own tickets, support and admin view all"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Create new SELECT policy for comments
CREATE POLICY "Users can view comments on own tickets, support and admin view all"
  ON ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'support')
        )
      )
    )
  );
