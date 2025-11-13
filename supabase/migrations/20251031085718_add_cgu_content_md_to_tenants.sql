/*
  # Add CGU Content to Tenants Table

  1. Changes
    - Add `cgu_content_md` column to `tenants` table for storing terms of service content in markdown format
  
  2. Security
    - No RLS changes needed as existing tenant policies cover this column
  
  3. Notes
    - This column will store legal terms and conditions in markdown format
    - Default value is empty string to ensure data consistency
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'cgu_content_md'
  ) THEN
    ALTER TABLE tenants ADD COLUMN cgu_content_md text DEFAULT '';
  END IF;
END $$;