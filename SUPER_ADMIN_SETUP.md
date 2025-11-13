# Super Admin Setup Guide

This guide explains how to set up the Super Admin user for the Sponsoring Management Platform.

## Overview

The Super Admin role has the highest level of access and can:
- Manage all clubs/tenants in the system
- Create and configure new tenants
- Access global email templates
- View system-wide statistics
- Access the protected `/super` route

## Initial Setup

### Step 1: Run Database Migration

The migration `seed_super_admin_user` has been applied, which creates a helper function to seed the super admin profile.

### Step 2: Create Auth User in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Authentication > Users**
3. Click **"Add user"** or **"Invite user"**
4. Fill in the details:
   - **Email**: `super@a2display.fr`
   - **Password**: Choose a strong password (e.g., generate with password manager)
   - **Auto Confirm User**: Check this box (important!)
5. Click **"Create user"** or **"Send invitation"**

### Step 3: Seed Super Admin Profile

After creating the auth user, you need to create the profile in the `users` table.

**Option A: Automatic (Recommended)**

The migration automatically tries to seed the super admin when you create the auth user. If it doesn't work automatically, proceed to Option B.

**Option B: Manual SQL**

1. Go to Supabase Dashboard > **SQL Editor**
2. Run this query:

```sql
SELECT seed_super_admin();
```

This will create the super admin profile linked to the auth user.

**Option C: Manual Insert (if function doesn't work)**

1. First, get the UUID of the auth user you created:

```sql
SELECT id, email FROM auth.users WHERE email = 'super@a2display.fr';
```

2. Copy the UUID, then insert the profile:

```sql
INSERT INTO users (id, email, name, role, tenant_id)
VALUES (
  'YOUR-AUTH-USER-UUID-HERE',
  'super@a2display.fr',
  'Super Admin',
  'super_admin',
  NULL
);
```

### Step 4: Verify Setup

1. Visit your application login page
2. Login with:
   - Email: `super@a2display.fr`
   - Password: (the one you set in Step 2)
3. You should be redirected to the Super Admin Dashboard
4. Navigate to `/super` or click "Clubs" in the navigation
5. You should see the SuperAdminClubs page with access to all tenants

## Protected Routes

The following routes are protected by AuthGuard with `allow=['super_admin']`:

- `/super` - Super Admin Clubs Management
- `/clubs` - Alias for `/super`
- `/email-templates` - Global Email Templates
- `/` - Super Admin Dashboard (when logged in as super_admin)

### AuthGuard Component

The `AuthGuard` component provides role-based access control:

```tsx
<AuthGuard allow={['super_admin']}>
  <SuperAdminClubs />
</AuthGuard>
```

**Features**:
- Shows loading state while checking authentication
- Redirects to `/login` if not authenticated
- Shows "Access Denied" message if role doesn't match
- Displays required role vs. user's actual role
- Provides "Return Home" button for unauthorized access

## Testing Access Control

### Test 1: Super Admin Access
1. Login as `super@a2display.fr`
2. Navigate to `/super`
3. **Expected**: See SuperAdminClubs page with tenant list

### Test 2: Club Admin Blocked
1. Create a club admin user
2. Login as club admin
3. Try to navigate to `/super`
4. **Expected**: See "Access Denied" message

### Test 3: Unauthenticated Access
1. Logout
2. Try to navigate to `/super`
3. **Expected**: Redirect to `/login`

## Troubleshooting

### Issue: "Auth user not found" message

**Solution**: You need to create the auth user first in Supabase Dashboard > Authentication > Users

### Issue: Login works but redirected to "Role not recognized"

**Cause**: The profile in `users` table wasn't created or role is incorrect

**Solution**:
1. Check if user exists in `users` table:
```sql
SELECT * FROM users WHERE email = 'super@a2display.fr';
```

2. If not found, run `SELECT seed_super_admin();`

3. If exists but wrong role, update:
```sql
UPDATE users
SET role = 'super_admin'
WHERE email = 'super@a2display.fr';
```

### Issue: "Access Denied" when accessing `/super`

**Cause**: User role is not 'super_admin'

**Solution**: Check user role and update if needed:
```sql
-- Check current role
SELECT email, role FROM users WHERE email = 'super@a2display.fr';

-- Update role
UPDATE users
SET role = 'super_admin'
WHERE email = 'super@a2display.fr';
```

### Issue: Profile not found after login

**Cause**: RLS policies may be blocking access

**Solution**: Verify RLS policies allow super_admin to read their own profile:
```sql
-- Check RLS policies on users table
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Temporarily disable RLS for testing (not recommended for production)
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

## Security Considerations

1. **Strong Password**: Use a strong, unique password for super admin
2. **MFA**: Consider enabling MFA in Supabase Auth settings
3. **Access Logs**: Monitor super admin access in Supabase logs
4. **IP Restrictions**: Consider IP allowlisting for super admin access
5. **Limited Users**: Only create super admin accounts when absolutely necessary
6. **Regular Audits**: Review super admin actions periodically

## Additional Super Admin Users

To create additional super admin users:

1. Create auth user in Supabase Dashboard with desired email
2. Run the seed function with custom email:

```sql
-- Create custom seed function or manual insert
INSERT INTO users (id, email, name, role, tenant_id)
SELECT
  id,
  'additional-admin@example.com',
  'Additional Admin',
  'super_admin',
  NULL
FROM auth.users
WHERE email = 'additional-admin@example.com';
```

## Development vs Production

### Development
- Use test email like `super@example.com`
- Simple password acceptable
- Can use Supabase test mode

### Production
- Use company domain email (e.g., `admin@a2display.fr`)
- Strong password (min 16 chars, mixed case, numbers, symbols)
- Enable MFA
- Regularly rotate passwords
- Monitor access logs

## Next Steps

After setting up super admin:

1. Create your first tenant/club in SuperAdminClubs
2. Create club admin users for each tenant
3. Configure email templates
4. Set up campaigns and sponsors

## Support

If you encounter issues not covered in this guide:

1. Check Supabase logs in Dashboard > Logs
2. Check browser console for errors
3. Verify database migrations are up to date
4. Review RLS policies for users table
