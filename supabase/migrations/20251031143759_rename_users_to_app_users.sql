/*
  # Rename users table to app_users

  1. Changes
    - Rename public.users table to public.app_users
    - All foreign keys and constraints remain intact
    - All RLS policies are automatically transferred
    - No data loss occurs during rename

  2. Security
    - RLS policies remain active after rename
    - All existing access controls preserved
*/

ALTER TABLE IF EXISTS public.users RENAME TO app_users;
