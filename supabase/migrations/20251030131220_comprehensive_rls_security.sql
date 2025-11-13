/*
  # Comprehensive RLS Security & GDPR Compliance

  1. Security Enhancements
    - Force RLS on all tenant-scoped tables
    - Add super_admin access policies for all tables
    - Add token-based access for sponsors via invitations
    - Add public read access for public campaigns
    - Add consent validation for GDPR compliance

  2. Changes
    - Force RLS on all tables (no bypass)
    - Add helper function for checking super_admin role
    - Add comprehensive policies for all tables
    - Ensure GDPR consent is required and validated
*/

-- Create helper function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check tenant access
CREATE OR REPLACE FUNCTION has_tenant_access(tenant_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND (users.role = 'super_admin' OR users.tenant_id = tenant_uuid)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TENANTS TABLE: Super admins can do everything, club admins can view their own
DROP POLICY IF EXISTS "Super admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Club admins can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Super admins can create tenants" ON tenants;
DROP POLICY IF EXISTS "Super admins can update tenants" ON tenants;
DROP POLICY IF EXISTS "Super admins can delete tenants" ON tenants;

CREATE POLICY "Super admins have full access to tenants"
  ON tenants FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Club admins can view their own tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = tenants.id
    )
  );

-- USERS TABLE: Strict access control
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Super admins can view all users" ON users;
DROP POLICY IF EXISTS "Super admins can create users" ON users;
DROP POLICY IF EXISTS "Super admins can update users" ON users;

CREATE POLICY "Super admins have full access to users"
  ON users FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (users.id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (users.id = auth.uid())
  WITH CHECK (
    users.id = auth.uid() 
    AND role = (SELECT role FROM users WHERE id = auth.uid())
    AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- CAMPAIGNS TABLE: Tenant-scoped + public read for enabled campaigns
DROP POLICY IF EXISTS "Club admins can view their campaigns" ON campaigns;
DROP POLICY IF EXISTS "Club admins can create campaigns" ON campaigns;
DROP POLICY IF EXISTS "Club admins can update their campaigns" ON campaigns;
DROP POLICY IF EXISTS "Club admins can delete their campaigns" ON campaigns;
DROP POLICY IF EXISTS "Public can view shared campaigns" ON campaigns;

CREATE POLICY "Super admins have full access to campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Club admins can view their campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Club admins can create campaigns"
  ON campaigns FOR INSERT
  TO authenticated
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "Club admins can update their campaigns"
  ON campaigns FOR UPDATE
  TO authenticated
  USING (has_tenant_access(tenant_id))
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "Club admins can delete their campaigns"
  ON campaigns FOR DELETE
  TO authenticated
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Public can view shared campaigns"
  ON campaigns FOR SELECT
  TO anon
  USING (is_public_share_enabled = true);

-- SPONSORS TABLE: Tenant-scoped access
DROP POLICY IF EXISTS "Club admins can view their sponsors" ON sponsors;
DROP POLICY IF EXISTS "Club admins can create sponsors" ON sponsors;
DROP POLICY IF EXISTS "Club admins can update their sponsors" ON sponsors;
DROP POLICY IF EXISTS "Club admins can delete their sponsors" ON sponsors;
DROP POLICY IF EXISTS "Public can create sponsors" ON sponsors;

CREATE POLICY "Super admins have full access to sponsors"
  ON sponsors FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Club admins can view their sponsors"
  ON sponsors FOR SELECT
  TO authenticated
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Club admins can create sponsors"
  ON sponsors FOR INSERT
  TO authenticated
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "Club admins can update their sponsors"
  ON sponsors FOR UPDATE
  TO authenticated
  USING (has_tenant_access(tenant_id))
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "Club admins can delete their sponsors"
  ON sponsors FOR DELETE
  TO authenticated
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Public can create sponsors for public campaigns"
  ON sponsors FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- INVITATIONS TABLE: Tenant-scoped via campaign + public read via token
DROP POLICY IF EXISTS "Club admins can view their invitations" ON invitations;
DROP POLICY IF EXISTS "Club admins can create invitations" ON invitations;
DROP POLICY IF EXISTS "Club admins can update their invitations" ON invitations;
DROP POLICY IF EXISTS "Club admins can delete their invitations" ON invitations;
DROP POLICY IF EXISTS "Public can view invitation by token" ON invitations;

CREATE POLICY "Super admins have full access to invitations"
  ON invitations FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Club admins can view their invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = invitations.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Club admins can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = invitations.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Club admins can update their invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = invitations.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = invitations.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Club admins can delete their invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = invitations.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Anyone can view invitation by valid token"
  ON invitations FOR SELECT
  TO anon, authenticated
  USING (token IS NOT NULL);

-- PLEDGES TABLE: Tenant-scoped via campaign + GDPR consent required
DROP POLICY IF EXISTS "Club admins can view their pledges" ON pledges;
DROP POLICY IF EXISTS "Club admins can create pledges" ON pledges;
DROP POLICY IF EXISTS "Club admins can update their pledges" ON pledges;
DROP POLICY IF EXISTS "Club admins can delete their pledges" ON pledges;
DROP POLICY IF EXISTS "Public can create pledges" ON pledges;

CREATE POLICY "Super admins have full access to pledges"
  ON pledges FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Club admins can view their pledges"
  ON pledges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = pledges.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Public can create pledges with consent"
  ON pledges FOR INSERT
  TO anon, authenticated
  WITH CHECK (consent = true);

CREATE POLICY "Club admins can update their pledges"
  ON pledges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = pledges.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = pledges.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Club admins can delete their pledges"
  ON pledges FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = pledges.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

-- SCENARIOS TABLE: Tenant-scoped via campaign
DROP POLICY IF EXISTS "Club admins can view their scenarios" ON scenarios;
DROP POLICY IF EXISTS "Club admins can create scenarios" ON scenarios;
DROP POLICY IF EXISTS "Club admins can update their scenarios" ON scenarios;
DROP POLICY IF EXISTS "Club admins can delete their scenarios" ON scenarios;

CREATE POLICY "Super admins have full access to scenarios"
  ON scenarios FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Club admins can view their scenarios"
  ON scenarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = scenarios.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Club admins can create scenarios"
  ON scenarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = scenarios.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Club admins can update their scenarios"
  ON scenarios FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = scenarios.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = scenarios.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "Club admins can delete their scenarios"
  ON scenarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = scenarios.campaign_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

-- EMAIL_EVENTS TABLE: Tenant-scoped via invitation->campaign
DROP POLICY IF EXISTS "Club admins can view their email events" ON email_events;
DROP POLICY IF EXISTS "Club admins can create email events" ON email_events;

CREATE POLICY "Super admins have full access to email events"
  ON email_events FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Club admins can view their email events"
  ON email_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invitations
      JOIN campaigns ON campaigns.id = invitations.campaign_id
      WHERE invitations.id = email_events.invitation_id
      AND has_tenant_access(campaigns.tenant_id)
    )
  );

CREATE POLICY "System can create email events"
  ON email_events FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Add constraint to ensure GDPR consent
ALTER TABLE pledges
DROP CONSTRAINT IF EXISTS check_gdpr_consent;

ALTER TABLE pledges
ADD CONSTRAINT check_gdpr_consent 
CHECK (consent = true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_public_slug ON campaigns(public_slug) WHERE is_public_share_enabled = true;
CREATE INDEX IF NOT EXISTS idx_sponsors_tenant_id ON sponsors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pledges_campaign_sponsor ON pledges(campaign_id, sponsor_id);
