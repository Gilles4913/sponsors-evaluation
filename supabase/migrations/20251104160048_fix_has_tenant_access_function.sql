/*
  # Fix has_tenant_access function

  1. Changes
    - Update has_tenant_access() function to use app_users instead of users table
    - The table was renamed from users to app_users but the function was not updated
    
  2. Security
    - Maintains same security logic: check if user is super_admin or has matching tenant_id
*/

CREATE OR REPLACE FUNCTION has_tenant_access(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_users
    WHERE app_users.id = auth.uid()
    AND (app_users.role = 'super_admin' OR app_users.tenant_id = tenant_uuid)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
