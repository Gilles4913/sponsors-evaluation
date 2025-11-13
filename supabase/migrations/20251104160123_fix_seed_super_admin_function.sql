/*
  # Fix seed_super_admin function

  1. Changes
    - Update seed_super_admin() function to use app_users instead of users table
    - The table was renamed from users to app_users but the function was not updated
    
  2. Security
    - Maintains same functionality for seeding super admin user
*/

CREATE OR REPLACE FUNCTION seed_super_admin()
RETURNS void AS $$
DECLARE
  auth_user_id uuid;
BEGIN
  -- Check if super admin already exists
  IF EXISTS (SELECT 1 FROM app_users WHERE email = 'super@a2display.fr' AND role = 'super_admin') THEN
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
    INSERT INTO app_users (id, email, name, role, tenant_id)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
