/*
  # Add attachments support to tickets

  1. Changes
    - Add `attachments` column to `tickets` table
    - Column stores array of attachment objects with file info
    
  2. Structure
    - Each attachment object contains:
      - name: original file name
      - path: storage path
      - size: file size in bytes
      - type: MIME type
*/

-- Add attachments column to tickets
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Add index for faster queries on attachments
CREATE INDEX IF NOT EXISTS idx_tickets_attachments ON tickets USING gin(attachments);













