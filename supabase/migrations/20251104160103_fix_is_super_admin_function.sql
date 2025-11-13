/*
  # Fix is_super_admin function

  1. Changes
    - Update is_super_admin() function to use app_users instead of users table
    - The table was renamed from users to app_users but the function was not updated
    
  2. Security
    - Maintains same security logic: check if user has super_admin role
*/

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_users
    WHERE app_users.id = auth.uid()
    AND app_users.role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
