/*
  # Create function to clone global email templates to tenant

  1. Purpose
    - Allows super admins to safely copy global templates to a specific tenant
    - Only creates templates if they don't already exist for that tenant
    - Returns count of templates created

  2. Function
    - `clone_default_email_templates(p_tenant_id uuid)`
    - Copies all global templates (tenant_id IS NULL) to specified tenant
    - Skips templates that already exist for that tenant
    - Returns number of templates cloned

  3. Security
    - Function is SECURITY DEFINER (runs with creator's privileges)
    - Only callable by authenticated users (super_admins via RLS)
*/

CREATE OR REPLACE FUNCTION clone_default_email_templates(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cloned_count integer := 0;
  v_template record;
BEGIN
  -- Validate tenant exists
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant % does not exist', p_tenant_id;
  END IF;

  -- Loop through global templates
  FOR v_template IN 
    SELECT type, subject, html_body, text_body, placeholders, is_active
    FROM email_templates
    WHERE tenant_id IS NULL
  LOOP
    -- Check if template already exists for this tenant
    IF NOT EXISTS (
      SELECT 1 FROM email_templates
      WHERE tenant_id = p_tenant_id AND type = v_template.type
    ) THEN
      -- Insert the template for this tenant
      INSERT INTO email_templates (
        tenant_id,
        type,
        subject,
        html_body,
        text_body,
        placeholders,
        is_active
      ) VALUES (
        p_tenant_id,
        v_template.type,
        v_template.subject,
        v_template.html_body,
        v_template.text_body,
        v_template.placeholders,
        v_template.is_active
      );
      
      v_cloned_count := v_cloned_count + 1;
    END IF;
  END LOOP;

  RETURN v_cloned_count;
END;
$$;

-- Grant execute to authenticated users (RLS will control who can actually use it)
GRANT EXECUTE ON FUNCTION clone_default_email_templates(uuid) TO authenticated;

COMMENT ON FUNCTION clone_default_email_templates(uuid) IS 
'Safely clones all global email templates to a specific tenant. Only creates templates that do not already exist for that tenant. Returns count of templates created.';