/*
  # Add attachments support to ticket comments

  1. Changes
    - Add `attachments` column to `ticket_comments` table
    - Column stores array of attachment objects with file info
    
  2. Structure
    - Each attachment object contains:
      - name: original file name
      - path: storage path
      - size: file size in bytes
      - type: MIME type
*/

-- Add attachments column to ticket_comments
ALTER TABLE ticket_comments 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Add index for faster queries on attachments
CREATE INDEX IF NOT EXISTS idx_ticket_comments_attachments ON ticket_comments USING gin(attachments);
