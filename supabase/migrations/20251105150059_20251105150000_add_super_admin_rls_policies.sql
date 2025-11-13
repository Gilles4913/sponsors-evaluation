/*
  # Add Super Admin RLS Policies with jwt_role() function

  1. New Functions
    - `jwt_role()` - Helper function to extract role from JWT app_metadata
  
  2. Security Policies
    - **tenants table**
      - `tenants_super_admin_all`: super_admin can perform all operations (SELECT, INSERT, UPDATE, DELETE)
    - **app_users table**  
      - `app_users_super_admin_all`: super_admin can perform all operations (SELECT, INSERT, UPDATE, DELETE)
  
  3. Changes
    - Create `jwt_role()` function to extract role from JWT
    - Add comprehensive super_admin policies using jwt_role()
    - Existing policies remain intact (club_admin SELECT, etc.)
  
  4. Important Notes
    - These policies complement existing policies (not replacing)
    - super_admin bypasses tenant isolation
    - club_admin still restricted to their own tenant
    - Function uses auth.jwt() to extract app_metadata.role
*/

-- Create jwt_role() helper function if not exists
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    (SELECT role FROM app_users WHERE id = auth.uid())
  )::text;
$$;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS tenants_super_admin_all ON public.tenants;
DROP POLICY IF EXISTS app_users_super_admin_all ON public.app_users;

-- Create super_admin policy for tenants (all operations)
CREATE POLICY tenants_super_admin_all ON public.tenants
  FOR ALL
  TO authenticated
  USING (public.jwt_role() = 'super_admin')
  WITH CHECK (public.jwt_role() = 'super_admin');

-- Create super_admin policy for app_users (all operations)
CREATE POLICY app_users_super_admin_all ON public.app_users
  FOR ALL
  TO authenticated
  USING (public.jwt_role() = 'super_admin')
  WITH CHECK (public.jwt_role() = 'super_admin');
