/*
  # Add tenant_id to email_templates

  1. Changes
    - Add `tenant_id` column to `email_templates` table (nullable)
    - When NULL: global template (accessible by all tenants)
    - When set: tenant-specific template override
    - Remove UNIQUE constraint on `type` to allow per-tenant overrides
    - Add composite UNIQUE constraint on (tenant_id, type)
    
  2. Security
    - Update RLS policies to handle both global and tenant-specific templates
    - Super admins can manage global templates (tenant_id IS NULL)
    - Club admins can only view/use templates for their tenant
    
  3. Notes
    - Existing templates will have tenant_id = NULL (become global templates)
    - Each tenant can override global templates by creating their own version
*/

-- Add tenant_id column (nullable, allows NULL for global templates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop the existing UNIQUE constraint on type
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_type_key;

-- Add composite UNIQUE constraint for (tenant_id, type)
-- This allows the same type to exist multiple times (once per tenant + once global)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_tenant_type 
  ON email_templates(tenant_id, type);

-- Also create partial unique index for global templates (tenant_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_global_type 
  ON email_templates(type) WHERE tenant_id IS NULL;

-- Update RLS policies
-- Drop old policies
DROP POLICY IF EXISTS "All authenticated users can view active templates" ON email_templates;
DROP POLICY IF EXISTS "Super admins can view all templates" ON email_templates;
DROP POLICY IF EXISTS "Super admins can create templates" ON email_templates;
DROP POLICY IF EXISTS "Super admins can update templates" ON email_templates;
DROP POLICY IF EXISTS "Super admins can delete templates" ON email_templates;

-- New policies for global templates (tenant_id IS NULL)
CREATE POLICY "Super admins can view all templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can view their templates and global templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = email_templates.tenant_id
      AND users.role = 'club_admin'
    )
  );

CREATE POLICY "Super admins can insert global templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IS NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can insert their own templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = email_templates.tenant_id
      AND users.role = 'club_admin'
    )
  );

CREATE POLICY "Super admins can update global templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IS NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    tenant_id IS NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can update their own templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = email_templates.tenant_id
      AND users.role = 'club_admin'
    )
  )
  WITH CHECK (
    tenant_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = email_templates.tenant_id
      AND users.role = 'club_admin'
    )
  );

CREATE POLICY "Super admins can delete global templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IS NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can delete their own templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = email_templates.tenant_id
      AND users.role = 'club_admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant_id ON email_templates(tenant_id);

COMMENT ON COLUMN email_templates.tenant_id IS 
'NULL for global templates (managed by super_admins), set for tenant-specific template overrides';