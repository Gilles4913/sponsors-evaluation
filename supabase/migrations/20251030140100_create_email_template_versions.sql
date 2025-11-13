/*
  # Create email template versions table

  1. New Tables
    - `email_template_versions`
      - `id` (uuid, primary key)
      - `template_id` (uuid, references email_templates)
      - `version_number` (integer) - Sequential version number
      - `subject` (text) - Email subject at this version
      - `html_body` (text) - HTML body at this version
      - `text_body` (text) - Text body at this version
      - `placeholders` (json) - Placeholders at this version
      - `created_at` (timestamptz) - When this version was created
      - `created_by` (uuid, references auth.users) - Who created this version
      - `change_notes` (text) - Optional notes about changes

  2. Security
    - Enable RLS on `email_template_versions` table
    - Add policies for super admins to manage versions
    - Add policy for authenticated users to view versions

  3. Indexes
    - Index on template_id and version_number for fast lookups
*/

CREATE TABLE IF NOT EXISTS email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  placeholders json NOT NULL DEFAULT '[]'::json,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_notes text,
  UNIQUE (template_id, version_number)
);

ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view template versions"
  ON email_template_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can create template versions"
  ON email_template_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON email_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_created_at ON email_template_versions(created_at DESC);

CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO email_template_versions (
    template_id,
    version_number,
    subject,
    html_body,
    text_body,
    placeholders,
    created_by,
    change_notes
  )
  SELECT
    NEW.id,
    COALESCE((
      SELECT MAX(version_number) + 1
      FROM email_template_versions
      WHERE template_id = NEW.id
    ), 1),
    NEW.subject,
    NEW.html_body,
    NEW.text_body,
    NEW.placeholders,
    NEW.updated_by,
    'Version created automatically'
  WHERE NOT EXISTS (
    SELECT 1 FROM email_template_versions
    WHERE template_id = NEW.id
    AND version_number = 1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_create_template_version'
  ) THEN
    CREATE TRIGGER trigger_create_template_version
      AFTER UPDATE ON email_templates
      FOR EACH ROW
      WHEN (
        OLD.subject IS DISTINCT FROM NEW.subject OR
        OLD.html_body IS DISTINCT FROM NEW.html_body OR
        OLD.text_body IS DISTINCT FROM NEW.text_body
      )
      EXECUTE FUNCTION create_template_version();
  END IF;
END $$;
