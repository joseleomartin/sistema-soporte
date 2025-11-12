/*
  # Create notification trigger for new comments

  1. New Functions
    - `create_comment_notification` - Creates notifications when comments are added
    
  2. Triggers
    - Trigger on ticket_comments insert to create notifications
    
  3. Logic
    - When a user comments on a ticket, notify:
      - The ticket creator (if they're not the commenter)
      - All support and admin users (if commenter is a regular user)
*/

-- Function to create notifications when a new comment is added
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  ticket_creator_id uuid;
  ticket_title text;
  commenter_name text;
  commenter_role text;
BEGIN
  -- Get ticket creator and title
  SELECT created_by, title INTO ticket_creator_id, ticket_title
  FROM tickets WHERE id = NEW.ticket_id;
  
  -- Get commenter info
  SELECT full_name, role INTO commenter_name, commenter_role
  FROM profiles WHERE id = NEW.created_by;
  
  -- Notify ticket creator if they're not the one commenting
  IF ticket_creator_id != NEW.created_by THEN
    INSERT INTO notifications (user_id, ticket_id, comment_id, type, message)
    VALUES (
      ticket_creator_id,
      NEW.ticket_id,
      NEW.id,
      'new_comment',
      commenter_name || ' comentó en tu ticket: "' || ticket_title || '"'
    );
  END IF;
  
  -- If commenter is a regular user, notify all support and admin
  IF commenter_role = 'user' THEN
    INSERT INTO notifications (user_id, ticket_id, comment_id, type, message)
    SELECT 
      p.id,
      NEW.ticket_id,
      NEW.id,
      'new_comment',
      commenter_name || ' comentó en el ticket: "' || ticket_title || '"'
    FROM profiles p
    WHERE p.role IN ('admin', 'support')
      AND p.id != NEW.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_comment_created ON ticket_comments;
CREATE TRIGGER on_comment_created
  AFTER INSERT ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();
