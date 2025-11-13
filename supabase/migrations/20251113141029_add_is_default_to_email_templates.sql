/*
  # Add is_default column to email_templates

  ## Changes
    - Add `is_default` boolean column to `email_templates` table
    - Default value is `false`
    - This flag indicates if a template is available as default for clubs to use

  ## Notes
    - Templates marked as `is_default = true` can be cloned/used by clubs
    - Super admin can control which templates are available to clubs
    - This is different from `tenant_id IS NULL` (global templates)
*/

-- Add is_default column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN is_default boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Mark existing canonical templates as default
UPDATE email_templates
SET is_default = true
WHERE tenant_id IS NULL
  AND type IN ('invitation', 'confirmation', 'reminder', 'pledge_yes', 'pledge_no');