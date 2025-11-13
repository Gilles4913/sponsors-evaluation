# Environment Diagnostics Panel

## Overview

The Environment Diagnostics Panel (`/env-diagnostics`) provides a comprehensive interface for testing and validating the application's environment configuration, including both client-side (public) and server-side (private) variables.

## Features

### 1. Summary Banner

Displays key environment information at a glance:
- **Project ID**: Extracted from `VITE_SUPABASE_URL`
- **Backend Name**: From `VITE_PUBLIC_BACKEND_NAME`
- **Current Origin**: `window.location.origin`
- **BASE_URL Match**: Validates if configured BASE_URL matches current origin

### 2. Public Environment Variables

**Display Table:**
- Shows all public environment variables
- Columns: Variable Name | Value (truncated) | Status
- Status indicators:
  - ✓ Green badge: Variable is set
  - ✗ Red badge: Variable is missing

**Variables Checked:**
- `VITE_PUBLIC_BASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_BACKEND_NAME`

**Actions:**
- **Copy JSON Button**: Copies all public env variables to clipboard as JSON

**Test IDs:**
- `env-public-table`: The public variables table
- `btn-copy-env`: Copy JSON button

### 3. Server Environment Variables

Tests server-side environment variables via the `env-check` edge function.

**Button:** "Test Server Variables"
- Calls: `{SUPABASE_URL}/functions/v1/env-check`
- Returns: Boolean indicators for each server variable

**Variables Tested:**
- `RESEND_API_KEY`: Email service API key
- `SUPABASE_SERVICE_ROLE`: Service role key (with length)
- `NODE_ENV`: Runtime environment
- `BACKEND_NAME`: Backend identifier

**Test IDs:**
- `env-server-test`: Test button
- `env-server-result`: Results container

### 4. Supabase Connection Test

Tests the actual Supabase database connection.

**Button:** "Ping Supabase"
- Executes: `SELECT * FROM tenants LIMIT 1`
- Tests: Authentication, RLS policies, and database connectivity

**Results:**
- ✓ Success: Shows number of tenants found
- ✗ Error: Displays error code and message (e.g., RLS violations)

**Test ID:**
- `env-ping-supabase`: Ping button

### 5. Quick Actions

**Open BASE_URL:**
- Opens the configured `VITE_PUBLIC_BASE_URL` in a new tab
- Falls back to current origin if not set
- Test ID: `btn-open-base`

**Email Test Lab Link:**
- Quick navigation to `/email-test`
- Convenient for testing email functionality after environment setup

## Edge Function: env-check

### Endpoint
```
{SUPABASE_URL}/functions/v1/env-check
```

### Authentication
Requires `Authorization: Bearer {ANON_KEY}` header

### Response Format
```json
{
  "RESEND_API_KEY": true,
  "SUPABASE_SERVICE_ROLE": true,
  "SERVICE_ROLE_LENGTH": 267,
  "NODE_ENV": "production",
  "BACKEND_NAME": "MyBackend"
}
```

### Status Codes
- `200`: Success
- `500`: Server error

### Implementation Details
- Built with Deno runtime
- Checks environment variables without exposing actual values
- Returns boolean indicators and metadata only
- Full CORS support for cross-origin requests

## Usage

### Accessing the Panel

Navigate to `/env-diagnostics` - no authentication required.

### Typical Workflow

1. **Verify Public Variables**
   - Check that all required public variables are set
   - Ensure Supabase URL and anon key are present
   - Validate BASE_URL matches current origin

2. **Test Server Variables**
   - Click "Test Server Variables"
   - Verify RESEND_API_KEY is configured
   - Confirm SUPABASE_SERVICE_ROLE is set
   - Check service role key length is reasonable (>200 chars)

3. **Test Database Connection**
   - Click "Ping Supabase"
   - Verify successful connection
   - Check for RLS policy issues if errors occur

4. **Validate URLs**
   - Click "Open BASE_URL" to test configured URL
   - Ensure it opens the correct application instance

5. **Test Email System** (optional)
   - Click "Email Test Lab" link
   - Verify email sending functionality

## Troubleshooting

### Public Variables Missing
- Check `.env` file in project root
- Ensure variables start with `VITE_` prefix
- Restart dev server after changes

### Server Variables Not Set
- Verify edge function environment variables in Supabase Dashboard
- Check: Project Settings > Edge Functions > Secrets
- Required secrets:
  - `RESEND_API_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Supabase Connection Fails
**Common Issues:**

1. **RLS Policy Blocking**
   - Error: `42501` or `PGRST301`
   - Solution: Review RLS policies on `tenants` table

2. **Invalid Credentials**
   - Error: `401 Unauthorized`
   - Solution: Verify `VITE_SUPABASE_ANON_KEY` is correct

3. **Network Issues**
   - Error: `Failed to fetch`
   - Solution: Check `VITE_SUPABASE_URL` is correct and accessible

### BASE_URL Mismatch
- Update `VITE_PUBLIC_BASE_URL` in `.env`
- Ensure it matches your deployment URL
- For local dev: `http://localhost:5173`
- For production: `https://yourdomain.com`

## Security Notes

1. **Public Variables**: Safe to expose in client bundle
2. **Server Variables**: Only boolean indicators returned, never actual values
3. **Service Role Key**: Never exposed to client, only length reported
4. **CORS**: Edge function allows cross-origin requests for testing

## Integration

The panel integrates with:
- **EmailTestLab**: Quick link for email testing
- **Supabase**: Direct database connection testing
- **Edge Functions**: Server-side environment validation

## Test IDs Reference

| Element | Test ID | Description |
|---------|---------|-------------|
| Public env table | `env-public-table` | Table showing public variables |
| Copy JSON button | `btn-copy-env` | Copies public env to clipboard |
| Server test button | `env-server-test` | Tests server variables |
| Server results | `env-server-result` | Server test results container |
| Supabase ping button | `env-ping-supabase` | Tests database connection |
| Open BASE_URL button | `btn-open-base` | Opens configured BASE_URL |

## Example Output

**Healthy Environment:**
```
✓ VITE_PUBLIC_BASE_URL: https://app.example.com
✓ VITE_SUPABASE_URL: https://umjewxduvq...
✓ VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUz...
✓ VITE_PUBLIC_BACKEND_NAME: Production

Server Variables:
✓ RESEND_API_KEY: Set
✓ SUPABASE_SERVICE_ROLE: Set (length: 267)

Supabase Connection:
✓ Success! Found 1 tenant(s)

BASE_URL matches origin: ✓ Yes
```

**Problematic Environment:**
```
✓ VITE_PUBLIC_BASE_URL: https://app.example.com
✓ VITE_SUPABASE_URL: https://umjewxduvq...
✗ VITE_SUPABASE_ANON_KEY: Missing
✗ VITE_PUBLIC_BACKEND_NAME: Missing

Server Variables:
✗ RESEND_API_KEY: Missing
✓ SUPABASE_SERVICE_ROLE: Set (length: 267)

Supabase Connection:
✗ Error: 42501: permission denied for table tenants

BASE_URL matches origin: ✗ No (BASE_URL: https://app.example.com)
```
