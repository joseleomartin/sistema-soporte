/*
  # Enable Realtime for forum_messages table

  1. Changes
    - Enable realtime replication for forum_messages table
    - This allows real-time subscriptions to work properly
    
  2. Notes
    - Required for live chat functionality
    - Users will see new messages instantly without refreshing
*/

-- Enable realtime for forum_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE forum_messages;
