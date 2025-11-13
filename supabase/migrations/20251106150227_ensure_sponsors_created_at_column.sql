/*
  # Ensure sponsors table has created_at column

  1. Changes
    - Add created_at column to sponsors table if it doesn't exist
    - This migration is idempotent and safe to run multiple times

  2. Notes
    - Uses DO block to check if column exists before adding
    - Sets default value to now() for new records
    - Backfills existing records with current timestamp
*/

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
