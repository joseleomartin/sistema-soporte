/*
  # Add category column to tickets table

  1. Changes
    - Add `category` column to `tickets` table
      - Type: text
      - Not nullable
      - Default value: 'General'
    
  2. Notes
    - This column stores the category/type of each support ticket
    - Helps organize and filter tickets by topic
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'category'
  ) THEN
    ALTER TABLE tickets ADD COLUMN category text NOT NULL DEFAULT 'General';
  END IF;
END $$;
