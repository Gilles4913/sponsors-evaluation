/*
  # Seed Super Admin User

  1. Purpose
    - Create initial super admin user for system administration
    - Allows access to /super route for managing all clubs/tenants
    - Required for initial setup and tenant creation

  2. User Details
    - Email: super@a2display.fr
    - Role: super_admin
    - No tenant association (can manage all tenants)

  3. Security Notes
    - User must be created in auth.users first via Supabase Auth
    - This migration creates the profile in public.users
    - Password must be set separately via Supabase Dashboard or Auth API
    - RLS policies allow super_admin to access all data

  4. Manual Steps Required
    After running this migration:
    1. Go to Supabase Dashboard > Authentication > Users
    2. Create user with email: super@a2display.fr
    3. Set a secure password
    4. Copy the user UUID
    5. Update this migration with the actual UUID
    OR use the seed data approach below

  5. Implementation
    - Creates a function to seed super admin if not exists
    - Can be called manually or via trigger
*/

-- Function to create super admin user in public.users table
-- This assumes the auth.users record already exists
CREATE OR REPLACE FUNCTION seed_super_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id uuid;
BEGIN
  -- Check if super admin already exists
  IF EXISTS (SELECT 1 FROM users WHERE email = 'super@a2display.fr' AND role = 'super_admin') THEN
    RAISE NOTICE 'Super admin user already exists';
    RETURN;
  END IF;

  -- Try to find existing auth user
  SELECT id INTO auth_user_id
  FROM auth.users
  WHERE email = 'super@a2display.fr'
  LIMIT 1;

  -- If auth user exists, create profile
  IF auth_user_id IS NOT NULL THEN
    INSERT INTO users (id, email, name, role, tenant_id)
    VALUES (
      auth_user_id,
      'super@a2display.fr',
      'Super Admin',
      'super_admin',
      NULL
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin', email = 'super@a2display.fr';
    
    RAISE NOTICE 'Super admin profile created for existing auth user: %', auth_user_id;
  ELSE
    RAISE NOTICE 'Auth user not found. Please create auth user first in Supabase Dashboard';
    RAISE NOTICE 'Email: super@a2display.fr';
    RAISE NOTICE 'After creating auth user, run: SELECT seed_super_admin();';
  END IF;
END;
$$;

-- Execute the seed function
SELECT seed_super_admin();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION seed_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION seed_super_admin() TO service_role;

COMMENT ON FUNCTION seed_super_admin() IS 
'Seeds super admin user profile. Auth user must exist first in auth.users. 
Run manually after creating auth user: SELECT seed_super_admin();';