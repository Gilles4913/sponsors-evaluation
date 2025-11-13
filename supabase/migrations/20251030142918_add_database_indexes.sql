/*
  # Add database indexes for performance optimization

  1. Indexes Added
    - campaigns(tenant_id) - Fast lookups of campaigns by tenant
    - campaigns(public_slug) - Unique index for public URLs
    - pledges(campaign_id) - Fast filtering by campaign
    - pledges(campaign_id, status) - Composite index for filtered aggregations
    - pledges(sponsor_id) - Fast lookups by sponsor
    - invitations(token) - Fast token validation (unique)
    - invitations(campaign_id, sponsor_id) - Fast lookups
    - sponsors(tenant_id, email) - Unique constraint + fast lookup
    - email_events indexes for fast tracking

  2. Benefits
    - Faster query performance on large datasets
    - Unique constraints prevent duplicates
    - Composite indexes optimize complex queries
    - Partial indexes for conditional queries
*/

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id 
  ON campaigns(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_public_slug 
  ON campaigns(public_slug) 
  WHERE public_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at 
  ON campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pledges_campaign_id 
  ON pledges(campaign_id);

CREATE INDEX IF NOT EXISTS idx_pledges_campaign_status 
  ON pledges(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_pledges_sponsor_id 
  ON pledges(sponsor_id);

CREATE INDEX IF NOT EXISTS idx_pledges_created_at 
  ON pledges(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pledges_status 
  ON pledges(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token 
  ON invitations(token);

CREATE INDEX IF NOT EXISTS idx_invitations_campaign_id 
  ON invitations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_invitations_sponsor_id 
  ON invitations(sponsor_id);

CREATE INDEX IF NOT EXISTS idx_invitations_status 
  ON invitations(status);

CREATE INDEX IF NOT EXISTS idx_invitations_expires_at 
  ON invitations(expires_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_sponsors_tenant_id 
  ON sponsors(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsors_tenant_email 
  ON sponsors(tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_sponsors_email 
  ON sponsors(email);

CREATE INDEX IF NOT EXISTS idx_email_events_invitation_id 
  ON email_events(invitation_id);

CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id 
  ON email_events(campaign_id);

CREATE INDEX IF NOT EXISTS idx_email_events_type 
  ON email_events(event_type);

CREATE INDEX IF NOT EXISTS idx_email_events_created_at 
  ON email_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id 
  ON users(tenant_id);

CREATE INDEX IF NOT EXISTS idx_email_templates_type 
  ON email_templates(type);

CREATE INDEX IF NOT EXISTS idx_scenarios_campaign_id 
  ON scenarios(campaign_id);
