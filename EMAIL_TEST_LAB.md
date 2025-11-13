# Email Test Lab Documentation

## Overview

The Email Test Lab (`/email-test`) is a diagnostic and testing tool for email templates. It supports multiple database schemas and provides detailed diagnostics for troubleshooting.

## Features

### 1. Flexible Schema Detection

The `loadTemplatesFlex()` function automatically detects which database schema is in use:

#### Schema A (key/subject/html)
- Columns: `id`, `tenant_id`, `key`, `subject`, `html`, `created_at`
- Modern schema with simplified column names
- Detected when columns exist and contain data

#### Schema B (type/subject/html_body)
- Columns: `id`, `tenant_id`, `type`, `subject`, `html_body`, `text_body`, `placeholders`, `is_active`, `updated_at`
- Legacy schema with detailed columns
- Automatically used as fallback if Schema A fails

### 2. Error Handling

The function provides intelligent error detection:

**Column Not Found Errors:**
- Detects PostgreSQL error code `42703`
- Checks for "column" or "does not exist" in error messages
- Automatically tries Schema B

**RLS (Row Level Security) Errors:**
- Detects PostgreSQL error code `42501` or PostgREST code `PGRST301`
- Checks for "permission denied" or "policy" in error messages
- Displays "RLS?" prefix in error diagnostics

**Combined Errors:**
- If both Schema A and B fail, shows detailed error:
  ```
  Schema A failed: column "key" does not exist.
  Schema B failed: RLS? permission denied for table email_templates
  ```

### 3. Enhanced Diagnostics Panel

The diagnostics panel provides comprehensive system and debugging information:

**Environment Information:**
- **Project ID**: Extracted from `VITE_SUPABASE_URL` (e.g., `abcdefgh`)
- **JWT Role**: User role from `app_metadata` or profile (e.g., `super_admin`, `club_admin`)
- **As Tenant ID**: Current masquerading tenant ID or `none`

**Schema Detection:**
- **Schema Mode**: Shows which database schema was detected
  - `Mode A (key/subject/html)` - Modern schema
  - `Mode B (type/subject/html_body)` - Legacy schema
  - `Failed` - Both schemas failed to load

**Template Statistics:**
- **Global Templates**: Count of templates with `tenant_id IS NULL`
- **Tenant Templates**: Count of tenant-specific templates

**RLS Security Testing:**
- **Can Select Tenants?**: Automatic RLS diagnostic test
  - `YES` (green badge) - RLS allows table access
  - `NO (RLS?)` (red badge) - RLS blocking access
  - Shows specific error if blocked
- **Tenants Test Error**: Detailed error from RLS test (code + message)

**Error Diagnostics:**
- **Last Error Code**: PostgreSQL or PostgREST error code
  - `42703` - Column does not exist
  - `42501` - Permission denied (RLS)
  - `PGRST301` - PostgREST RLS violation
- **Last Error Message**: Full error description with context

**Debug Information:**
- **SQL Query**: Shows the actual SQL query used for loading templates

### 4. Template Filtering

Users can filter templates by scope:
- **All Templates**: Shows both global and tenant templates
- **Global Only**: Shows only global templates (tenant_id IS NULL)
- **My Club Only**: Shows only tenant-specific templates

### 5. Campaign & Sponsor Selection (Tenant Context Only)

When viewing as a specific tenant (`asTenantId` is defined), additional selectors appear:

**Campaign Selector:**
- Loads campaigns from the `campaigns` table
- Filters by current `tenant_id`
- Shows: `id`, `title`, `deadline`
- Ordered by deadline (descending)

**Sponsor Selector:**
- Loads sponsors from the `sponsors` table
- Filters by current `tenant_id`
- Shows: `id`, `company`, `contact_name`, `email`
- Ordered by company name (ascending)

**Load Variables Button:**
- Automatically populates the JSON variables based on selections
- Generated variables:
  - `club_name`: From tenant settings
  - `campaign_title`: From selected campaign
  - `deadline`: From selected campaign
  - `sponsor_name`: Contact name or company name
  - `invite_link`: Placeholder URL

### 6. Masquerading Support

For super_admins viewing as another tenant:
- Reads `?asTenant=` from URL or `localStorage('as_tenant_id')`
- Displays "MASQUERADE" badge in header
- Filters templates to show global + masqueraded tenant's templates
- Enables campaign and sponsor selectors

## Usage

### Access
1. Navigate to `/email-test`
2. Login as `super_admin` or `club_admin`

### Testing Email Templates

**Basic Flow:**
1. **Select Template**: Choose from available templates (filtered by scope)
2. **Enter Recipient**: Provide test email address
3. **Configure Variables**: Edit JSON variables for placeholder replacement
4. **Preview**: Click "Preview" to see rendered HTML with signature + RGPD footer
5. **Send Test**: Click "Send Test" to send via Resend API

**Using Campaign & Sponsor Data (Tenant Context):**
1. **Select Campaign**: Choose from dropdown (loads campaign data)
2. **Select Sponsor**: Choose from dropdown (loads sponsor data)
3. **Click "Charger variables"**: Auto-populates JSON with real data
4. **Preview/Send**: Variables are replaced with actual values

### Troubleshooting

**No Templates Loaded:**
- Check "Schema Mode" in diagnostics
- If "Failed", check "Last Error" for details
- Verify RLS policies if error mentions "permission denied"

**Wrong Templates Showing:**
- Verify "Scope Filter" setting
- Check if masquerading is active (MASQUERADE badge)
- Review SQL Query in diagnostics

**Send Test Fails:**
- Ensure `RESEND_API_KEY` is configured (see RESEND_SETUP.md)
- Verify valid email format
- Check browser console for detailed errors

## Technical Details

### Data Flow

```
loadTemplatesFlex()
  ├─→ Try Schema A (key/subject/html)
  │   ├─→ Success? Use Mode A
  │   └─→ Column error? Continue to B
  │
  ├─→ Try Schema B (type/subject/html_body)
  │   ├─→ Success? Use Mode B
  │   └─→ Error? Check for RLS
  │
  └─→ Normalize to common format
      └─→ Display in UI
```

### Normalized Template Format

Both schemas are normalized to:
```typescript
{
  id: string;
  scope: 'global' | 'tenant';
  key: string;                    // from 'key' or 'type'
  subject: string;
  html: string;                   // from 'html' or 'html_body'
  placeholders: Record<string, string>;
  tenant_id: string | null;
}
```

### Console Logging

The function logs detailed information:
```javascript
{
  schemaMode: "Mode A (key/subject/html)",
  rawCount: 15,
  normalizedCount: 15,
  globalCount: 10,
  tenantCount: 5
}
```

## API Integration

The test lab integrates with:

1. **Supabase Edge Function**: `/functions/v1/send-test-email`
   - Requires authentication
   - Validates email format
   - Sends via Resend API

2. **Tenant API**: Loads signature and RGPD content
   - Uses `loadTenantBasics()` utility
   - Applies signature and footer to preview/send

## Security

- Authentication required (super_admin or club_admin)
- RLS policies enforced on template access
- Session validation on email send
- Authorization header passed to edge function

## Related Files

- `/src/components/EmailTestLab.tsx` - Main component
- `/src/lib/tenantContext.ts` - Tenant utilities
- `/src/hooks/useAsTenant.ts` - Masquerading hook
- `/supabase/functions/send-test-email/index.ts` - Email sending endpoint
- `RESEND_SETUP.md` - Resend configuration guide
