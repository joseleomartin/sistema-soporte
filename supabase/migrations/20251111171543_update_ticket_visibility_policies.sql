/*
  # Update ticket visibility policies

  1. Changes
    - Drop existing SELECT policy for tickets
    - Create new SELECT policy that only allows support and admin to view tickets
    - Keep INSERT policy for users to create tickets
    - Users can create tickets but cannot view them (only support/admin can)
    
  2. Security
    - Basic users can submit tickets but cannot see the ticket list
    - Only support and admin roles can view all tickets
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own tickets or assigned tickets" ON tickets;

-- Create new restrictive SELECT policy
CREATE POLICY "Only support and admin can view tickets"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );
