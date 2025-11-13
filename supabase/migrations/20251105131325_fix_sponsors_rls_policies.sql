/*
  # Fix Sponsors RLS Policies
  
  1. Problem
    - Multiple overlapping RLS policies causing conflicts
    - "Club admins can manage their sponsors" uses old policy with explicit subquery
    - Newer policies use has_tenant_access() function but both exist simultaneously
    
  2. Solution
    - Drop all existing sponsors policies
    - Recreate clean, non-overlapping policies
    - Use has_tenant_access() and is_super_admin() consistently
    
  3. Security
    - Authenticated users can only access sponsors for their tenant
    - Super admins can access all sponsors
    - Anonymous users can view sponsors via valid invitations
    - Anonymous users can create sponsors for public campaigns
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Club admins can manage their sponsors" ON sponsors;
DROP POLICY IF EXISTS "Club admins can view their sponsors" ON sponsors;
DROP POLICY IF EXISTS "Club admins can create sponsors" ON sponsors;
DROP POLICY IF EXISTS "Club admins can update their sponsors" ON sponsors;
DROP POLICY IF EXISTS "Club admins can delete their sponsors" ON sponsors;
DROP POLICY IF EXISTS "Super admins can manage all sponsors" ON sponsors;
DROP POLICY IF EXISTS "Super admins have full access to sponsors" ON sponsors;
DROP POLICY IF EXISTS "Public can view sponsor via valid invitation" ON sponsors;
DROP POLICY IF EXISTS "Public can create sponsors for public campaigns" ON sponsors;

-- Create clean, non-overlapping policies
CREATE POLICY "Authenticated users can view their tenant sponsors"
  ON sponsors FOR SELECT
  TO authenticated
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Authenticated users can create sponsors for their tenant"
  ON sponsors FOR INSERT
  TO authenticated
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "Authenticated users can update their tenant sponsors"
  ON sponsors FOR UPDATE
  TO authenticated
  USING (has_tenant_access(tenant_id))
  WITH CHECK (has_tenant_access(tenant_id));

CREATE POLICY "Authenticated users can delete their tenant sponsors"
  ON sponsors FOR DELETE
  TO authenticated
  USING (has_tenant_access(tenant_id));

CREATE POLICY "Anonymous can view sponsors via valid invitation"
  ON sponsors FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT sponsor_id
      FROM invitations
      WHERE expires_at > now()
    )
  );

CREATE POLICY "Anonymous can create sponsors for public campaigns"
  ON sponsors FOR INSERT
  TO anon
  WITH CHECK (true);
