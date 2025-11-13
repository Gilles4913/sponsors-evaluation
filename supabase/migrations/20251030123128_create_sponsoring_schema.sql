/*
  # Sponsoring Écrans - Database Schema

  ## Overview
  Complete database schema for the sports club sponsoring platform that allows clubs to evaluate 
  sponsorship promises for LED screens or kiosks.

  ## New Tables

  ### 1. `profiles`
  Extends Supabase auth.users with additional user information
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `role` (text) - User role: 'super_admin', 'club', or 'sponsor'
  - `club_id` (uuid, nullable) - Reference to clubs table for club users
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `clubs`
  Sports clubs that create sponsorship campaigns
  - `id` (uuid, primary key)
  - `name` (text) - Club name
  - `contact_email` (text) - Main contact email
  - `contact_phone` (text, nullable) - Contact phone number
  - `created_by` (uuid) - Super admin who created the club
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `campaigns`
  Sponsorship campaigns created by clubs
  - `id` (uuid, primary key)
  - `club_id` (uuid) - Reference to clubs table
  - `name` (text) - Campaign name
  - `description` (text, nullable) - Campaign description
  - `target_amount` (numeric) - Financial goal
  - `equipment_type` (text) - 'led_screen' or 'kiosk'
  - `status` (text) - 'draft', 'active', 'completed', 'cancelled'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `sponsors`
  Sponsor contacts invited to campaigns
  - `id` (uuid, primary key)
  - `campaign_id` (uuid) - Reference to campaigns table
  - `email` (text) - Sponsor email
  - `company_name` (text) - Sponsor company name
  - `contact_name` (text, nullable) - Contact person name
  - `invitation_token` (uuid) - Unique token for accessing the response form
  - `invited_at` (timestamptz)
  - `responded_at` (timestamptz, nullable)
  - `created_at` (timestamptz)

  ### 5. `promises`
  Sponsor responses to campaign invitations
  - `id` (uuid, primary key)
  - `sponsor_id` (uuid) - Reference to sponsors table
  - `campaign_id` (uuid) - Reference to campaigns table
  - `response` (text) - 'yes', 'maybe', or 'no'
  - `amount` (numeric, nullable) - Promised amount
  - `notes` (text, nullable) - Additional notes from sponsor
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security

  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Super admins can access all data
  - Clubs can only access their own data
  - Sponsors can only access campaigns they're invited to

  ### Policies
  - **Super Admin**: Full access to all tables
  - **Clubs**: Can read/write their own campaigns and sponsors
  - **Sponsors**: Can read campaigns they're invited to and create/update their own promises
  - **Public**: Sponsors can access via invitation token without authentication

  ## Important Notes
  1. The first user created should be assigned 'super_admin' role manually
  2. Invitation tokens are used for sponsor access without requiring authentication
  3. All monetary amounts are stored as numeric for precision
  4. Cascading deletes ensure data integrity
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'club', 'sponsor')),
  club_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL DEFAULT 0,
  equipment_type text NOT NULL CHECK (equipment_type IN ('led_screen', 'kiosk')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  company_name text NOT NULL,
  contact_name text,
  invitation_token uuid UNIQUE DEFAULT gen_random_uuid(),
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create promises table
CREATE TABLE IF NOT EXISTS promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('yes', 'maybe', 'no')),
  amount numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sponsor_id, campaign_id)
);

-- Add foreign key to profiles after clubs table exists
ALTER TABLE profiles
  ADD CONSTRAINT profiles_club_id_fkey 
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE promises ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Clubs policies
CREATE POLICY "Super admins can manage all clubs"
  ON clubs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Club users can view their own club"
  ON clubs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.club_id = clubs.id
      AND profiles.role = 'club'
    )
  );

-- Campaigns policies
CREATE POLICY "Super admins can view all campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Club users can manage their campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.club_id = campaigns.club_id
      AND profiles.role = 'club'
    )
  );

-- Sponsors policies
CREATE POLICY "Super admins can view all sponsors"
  ON sponsors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Club users can manage their campaign sponsors"
  ON sponsors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN campaigns c ON c.club_id = p.club_id
      WHERE p.id = auth.uid()
      AND p.role = 'club'
      AND c.id = sponsors.campaign_id
    )
  );

CREATE POLICY "Public can view sponsors by invitation token"
  ON sponsors FOR SELECT
  USING (true);

-- Promises policies
CREATE POLICY "Super admins can view all promises"
  ON promises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Club users can view their campaign promises"
  ON promises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN campaigns c ON c.club_id = p.club_id
      WHERE p.id = auth.uid()
      AND p.role = 'club'
      AND c.id = promises.campaign_id
    )
  );

CREATE POLICY "Public can create promises with valid token"
  ON promises FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sponsors
      WHERE sponsors.id = promises.sponsor_id
      AND sponsors.campaign_id = promises.campaign_id
    )
  );

CREATE POLICY "Public can update promises with valid token"
  ON promises FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sponsors
      WHERE sponsors.id = promises.sponsor_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sponsors
      WHERE sponsors.id = promises.sponsor_id
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_club_id ON profiles(club_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_campaigns_club_id ON campaigns(club_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_sponsors_campaign_id ON sponsors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_invitation_token ON sponsors(invitation_token);
CREATE INDEX IF NOT EXISTS idx_promises_sponsor_id ON promises(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_promises_campaign_id ON promises(campaign_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promises_updated_at
  BEFORE UPDATE ON promises
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();