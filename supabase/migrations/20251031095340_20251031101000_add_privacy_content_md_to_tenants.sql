/*
  # Add privacy_content_md column to tenants

  1. Changes
    - Add `privacy_content_md` (text, nullable) to tenants table
    - For storing privacy policy in Markdown format

  2. Notes
    - This completes the legal content columns set
    - Other legal columns already exist: rgpd_content_md, cgu_content_md, email_signature_html
*/

-- Add privacy_content_md column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'privacy_content_md'
  ) THEN
    ALTER TABLE tenants ADD COLUMN privacy_content_md text;
  END IF;
END $$;

COMMENT ON COLUMN tenants.privacy_content_md IS 
'Privacy policy content in Markdown format';