/*
  # Create email template versions table for history tracking

  1. New Tables
    - `email_template_versions`
      - Version history for global email templates
      - Keeps last 5 versions per template
      - Immutable snapshots for rollback capability

  2. Security
    - RLS enabled
    - Super admins can view and insert versions
    - No updates/deletes (versions are immutable)

  3. Trigger
    - Auto-create version on template insert/update
    - Auto-cleanup old versions (keep only 5)
*/

-- Drop existing objects if they exist
DROP TRIGGER IF EXISTS trg_email_template_version_on_insert ON email_templates;
DROP TRIGGER IF EXISTS trg_email_template_version_on_update ON email_templates;
DROP FUNCTION IF EXISTS create_email_template_version();
DROP TABLE IF EXISTS email_template_versions CASCADE;

-- Create the email_template_versions table
CREATE TABLE email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  placeholders json NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  version_number integer NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_email_template_versions_template_id 
  ON email_template_versions(template_id);
CREATE INDEX idx_email_template_versions_created_at 
  ON email_template_versions(created_at DESC);

-- Enable RLS
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can view all template versions"
  ON email_template_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert template versions"
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

-- Function to create a version snapshot
CREATE FUNCTION create_email_template_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_version integer;
BEGIN
  -- Get the current max version number for this template
  SELECT COALESCE(MAX(version_number), 0) INTO v_max_version
  FROM email_template_versions
  WHERE template_id = NEW.id;

  -- Insert new version
  INSERT INTO email_template_versions (
    template_id,
    template_type,
    subject,
    html_body,
    text_body,
    placeholders,
    is_active,
    version_number,
    changed_by
  ) VALUES (
    NEW.id,
    NEW.type,
    NEW.subject,
    NEW.html_body,
    NEW.text_body,
    NEW.placeholders,
    NEW.is_active,
    v_max_version + 1,
    auth.uid()
  );

  -- Keep only last 5 versions
  DELETE FROM email_template_versions
  WHERE template_id = NEW.id
  AND id NOT IN (
    SELECT id
    FROM email_template_versions
    WHERE template_id = NEW.id
    ORDER BY version_number DESC
    LIMIT 5
  );

  RETURN NEW;
END;
$$;

-- Create triggers (only for global templates: tenant_id IS NULL)
CREATE TRIGGER trg_email_template_version_on_insert
  AFTER INSERT ON email_templates
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NULL)
  EXECUTE FUNCTION create_email_template_version();

CREATE TRIGGER trg_email_template_version_on_update
  AFTER UPDATE ON email_templates
  FOR EACH ROW
  WHEN (
    NEW.tenant_id IS NULL AND (
      OLD.subject IS DISTINCT FROM NEW.subject OR
      OLD.html_body IS DISTINCT FROM NEW.html_body OR
      OLD.text_body IS DISTINCT FROM NEW.text_body OR
      OLD.is_active IS DISTINCT FROM NEW.is_active
    )
  )
  EXECUTE FUNCTION create_email_template_version();

COMMENT ON TABLE email_template_versions IS 
'Stores version history for global email templates. Automatically keeps last 5 versions per template.';