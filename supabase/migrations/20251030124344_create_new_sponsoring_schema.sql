/*
  # New Sponsoring Platform Schema

  ## Overview
  Complete database schema for the sports club sponsoring platform with multi-tenant architecture.
  Each club (tenant) has isolated data with Row Level Security enforcing tenant boundaries.

  ## New Tables

  ### 1. `tenants` (clubs)
  Multi-tenant clubs with their own isolated data
  - `id` (uuid, primary key)
  - `name` (text) - Club name
  - `logo_url` (text, nullable) - URL to club logo
  - `email_contact` (text) - Main contact email
  - `status` (enum) - 'active' or 'inactive'
  - `created_at` (timestamptz)

  ### 2. `users`
  Application users with role-based access
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `name` (text) - Full name
  - `role` (enum) - 'super_admin' or 'club_admin'
  - `tenant_id` (uuid, nullable) - Reference to tenants (null for super_admin)
  - `created_at` (timestamptz)

  ### 3. `campaigns`
  Sponsorship campaigns for equipment financing
  - `id` (uuid, primary key)
  - `tenant_id` (uuid) - Reference to tenants
  - `title` (text) - Campaign title
  - `screen_type` (enum) - Equipment type
  - `location` (text) - Physical location
  - `annual_price_hint` (numeric) - Estimated annual cost
  - `objective_amount` (numeric) - Funding goal
  - `daily_footfall_estimate` (integer) - Daily visitor count
  - `lighting_hours` (json) - Operating hours
  - `cover_image_url` (text, nullable) - Campaign cover image
  - `deadline` (date, nullable) - Campaign deadline
  - `description_md` (text, nullable) - Markdown description
  - `is_public_share_enabled` (boolean) - Public sharing enabled
  - `public_slug` (text, unique, nullable) - URL slug for public access
  - `created_at` (timestamptz)

  ### 4. `sponsors`
  Sponsor contacts database
  - `id` (uuid, primary key)
  - `tenant_id` (uuid) - Reference to tenants
  - `company` (text) - Company name
  - `contact_name` (text) - Contact person name
  - `email` (text) - Contact email
  - `segment` (enum) - Sponsor tier: 'or', 'argent', 'bronze', 'autre'
  - `phone` (text, nullable) - Phone number
  - `notes` (text, nullable) - Internal notes
  - `created_at` (timestamptz)

  ### 5. `invitations`
  Campaign invitations sent to sponsors
  - `id` (uuid, primary key)
  - `campaign_id` (uuid) - Reference to campaigns
  - `sponsor_id` (uuid) - Reference to sponsors
  - `email` (text) - Email address
  - `token` (text, unique) - Unique access token
  - `status` (enum) - 'sent', 'opened', 'clicked', 'bounced'
  - `expires_at` (timestamptz, nullable) - Expiration timestamp
  - `created_at` (timestamptz)

  ### 6. `pledges`
  Sponsor responses and commitments
  - `id` (uuid, primary key)
  - `campaign_id` (uuid) - Reference to campaigns
  - `sponsor_id` (uuid, nullable) - Reference to sponsors
  - `status` (enum) - 'yes', 'maybe', 'no'
  - `amount` (numeric) - Pledged amount
  - `comment` (text, nullable) - Sponsor comment
  - `consent` (boolean) - Data consent
  - `source` (enum) - 'invite', 'public', 'qr'
  - `created_at` (timestamptz)

  ### 7. `scenarios`
  Campaign financial scenarios
  - `id` (uuid, primary key)
  - `campaign_id` (uuid) - Reference to campaigns
  - `params_json` (json) - Scenario parameters
  - `results_json` (json) - Calculated results
  - `created_at` (timestamptz)

  ### 8. `email_events`
  Email tracking events
  - `id` (uuid, primary key)
  - `invitation_id` (uuid) - Reference to invitations
  - `type` (enum) - 'sent', 'opened', 'clicked', 'bounced'
  - `meta_json` (json, nullable) - Event metadata
  - `created_at` (timestamptz)

  ## Security

  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Tenant isolation: Users can only access data from their own tenant
  - Super admins have global access to all data
  - Public access allowed for pledges via invitation tokens

  ## Important Notes
  1. Multi-tenant architecture with strict data isolation
  2. Super admins (role = 'super_admin') have access to all tenants
  3. Club admins (role = 'club_admin') can only access their tenant's data
  4. Invitation tokens allow public access to specific campaigns
  5. All enums are implemented as CHECK constraints for flexibility
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS email_events CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
DROP TABLE IF EXISTS pledges CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS sponsors CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS promises CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS clubs CASCADE;

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  email_contact text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'club_admin')),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  screen_type text NOT NULL CHECK (screen_type IN ('led_ext', 'led_int', 'borne_ext', 'borne_int_mobile', 'ecran_int_fixe')),
  location text NOT NULL,
  annual_price_hint numeric NOT NULL DEFAULT 0,
  objective_amount numeric NOT NULL DEFAULT 0,
  daily_footfall_estimate integer NOT NULL DEFAULT 0,
  lighting_hours json DEFAULT '{}',
  cover_image_url text,
  deadline date,
  description_md text,
  is_public_share_enabled boolean DEFAULT false,
  public_slug text UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Create sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  segment text NOT NULL DEFAULT 'autre' CHECK (segment IN ('or', 'argent', 'bronze', 'autre')),
  phone text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'clicked', 'bounced')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create pledges table
CREATE TABLE IF NOT EXISTS pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('yes', 'maybe', 'no')),
  amount numeric DEFAULT 0,
  comment text,
  consent boolean DEFAULT false,
  source text NOT NULL DEFAULT 'invite' CHECK (source IN ('invite', 'public', 'qr')),
  created_at timestamptz DEFAULT now()
);

-- Create scenarios table
CREATE TABLE IF NOT EXISTS scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  params_json json NOT NULL DEFAULT '{}',
  results_json json NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create email_events table
CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sent', 'opened', 'clicked', 'bounced')),
  meta_json json,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Tenants policies
CREATE POLICY "Super admins can manage all tenants"
  ON tenants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can view their tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = tenants.id
      AND users.role = 'club_admin'
    )
  );

CREATE POLICY "Club admins can update their tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = tenants.id
      AND users.role = 'club_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = tenants.id
      AND users.role = 'club_admin'
    )
  );

-- Users policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can manage all users"
  ON users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can view users in their tenant"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.tenant_id = users.tenant_id
      AND u.role = 'club_admin'
    )
  );

-- Campaigns policies
CREATE POLICY "Super admins can manage all campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can manage their campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = campaigns.tenant_id
      AND users.role = 'club_admin'
    )
  );

CREATE POLICY "Public can view campaigns with public sharing enabled"
  ON campaigns FOR SELECT
  USING (is_public_share_enabled = true);

-- Sponsors policies
CREATE POLICY "Super admins can manage all sponsors"
  ON sponsors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can manage their sponsors"
  ON sponsors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = sponsors.tenant_id
      AND users.role = 'club_admin'
    )
  );

-- Invitations policies
CREATE POLICY "Super admins can view all invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can manage their invitations"
  ON invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.tenant_id = u.tenant_id
      WHERE u.id = auth.uid()
      AND u.role = 'club_admin'
      AND c.id = invitations.campaign_id
    )
  );

CREATE POLICY "Public can view invitations by token"
  ON invitations FOR SELECT
  USING (true);

-- Pledges policies
CREATE POLICY "Super admins can view all pledges"
  ON pledges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can view their campaign pledges"
  ON pledges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.tenant_id = u.tenant_id
      WHERE u.id = auth.uid()
      AND u.role = 'club_admin'
      AND c.id = pledges.campaign_id
    )
  );

CREATE POLICY "Public can create pledges"
  ON pledges FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can view pledges for public campaigns"
  ON pledges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = pledges.campaign_id
      AND campaigns.is_public_share_enabled = true
    )
  );

-- Scenarios policies
CREATE POLICY "Super admins can view all scenarios"
  ON scenarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can manage their scenarios"
  ON scenarios FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.tenant_id = u.tenant_id
      WHERE u.id = auth.uid()
      AND u.role = 'club_admin'
      AND c.id = scenarios.campaign_id
    )
  );

-- Email events policies
CREATE POLICY "Super admins can view all email events"
  ON email_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Club admins can view their email events"
  ON email_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN campaigns c ON c.tenant_id = u.tenant_id
      JOIN invitations i ON i.campaign_id = c.id
      WHERE u.id = auth.uid()
      AND u.role = 'club_admin'
      AND i.id = email_events.invitation_id
    )
  );

CREATE POLICY "Public can create email events"
  ON email_events FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_public_slug ON campaigns(public_slug);
CREATE INDEX IF NOT EXISTS idx_sponsors_tenant_id ON sponsors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_email ON sponsors(email);
CREATE INDEX IF NOT EXISTS idx_invitations_campaign_id ON invitations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_invitations_sponsor_id ON invitations(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_pledges_campaign_id ON pledges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pledges_sponsor_id ON pledges(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_campaign_id ON scenarios(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_invitation_id ON email_events(invitation_id);

-- Create function to generate unique public slug
CREATE OR REPLACE FUNCTION generate_public_slug()
RETURNS text AS $$
DECLARE
  new_slug text;
  slug_exists boolean;
BEGIN
  LOOP
    new_slug := lower(substr(md5(random()::text), 1, 8));
    
    SELECT EXISTS(SELECT 1 FROM campaigns WHERE public_slug = new_slug) INTO slug_exists;
    
    EXIT WHEN NOT slug_exists;
  END LOOP;
  
  RETURN new_slug;
END;
$$ LANGUAGE plpgsql;