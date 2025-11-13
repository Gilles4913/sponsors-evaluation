/*
  # Force PostgREST schema cache reload

  1. Changes
    - Sends NOTIFY signal to reload PostgREST schema cache
    - This forces PostgREST to recognize the sponsors.created_at column
    
  2. Notes
    - PostgREST caches the database schema for performance
    - When columns are added, PostgREST may not see them until cache is cleared
    - This migration forces an immediate schema reload
*/

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Also ensure the column definitely exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'sponsors'
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE sponsors ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
END $$;
