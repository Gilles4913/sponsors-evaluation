# Edge Functions Documentation

This document describes all Edge Functions deployed in the Sponsoring Management Platform.

## Overview

Edge Functions are serverless functions that handle backend operations like sending emails, recording events, and generating exports.

## Available Functions

### 1. create-invitations

**Purpose**: Generate invitation tokens, insert invitations into database, and send invitation emails to sponsors.

**Endpoint**: `POST /functions/v1/create-invitations`

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "campaign_id": "uuid",
  "sponsor_ids": ["uuid1", "uuid2", "uuid3"],
  "expires_in_days": 30,
  "send_emails": true
}
```

**Response**:
```json
{
  "created": 3,
  "invitations": [
    {
      "id": "uuid",
      "campaign_id": "uuid",
      "sponsor_id": "uuid",
      "email": "sponsor@example.com",
      "token": "unique-token",
      "status": "sent",
      "expires_at": "2025-11-30T12:00:00Z"
    }
  ],
  "emails_sent": 3,
  "errors": []
}
```

**Usage Example**:
```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/create-invitations`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    campaign_id: campaignId,
    sponsor_ids: selectedSponsorIds,
    expires_in_days: 30,
    send_emails: true,
  }),
});

const result = await response.json();
```

**Features**:
- Generates unique token per invitation
- Sets expiration date based on `expires_in_days`
- Fetches campaign and sponsor details
- Loads email template from `email_templates` table
- Replaces template placeholders with actual data
- Records email events in `email_events` table
- Returns detailed results with success/error counts

---

### 2. record-email-event

**Purpose**: Webhook endpoint for email service providers to record email events (sent, opened, clicked, bounced).

**Endpoint**: `POST /functions/v1/record-email-event`

**Authentication**: Not required (public webhook)

**Request Body**:
```json
{
  "event_type": "opened",
  "email": "sponsor@example.com",
  "invitation_token": "unique-token",
  "timestamp": "2025-10-30T14:30:00Z",
  "metadata": {
    "user_agent": "Mozilla/5.0...",
    "ip_address": "192.168.1.1"
  }
}
```

**Event Types**:
- `sent` / `delivered` - Email successfully sent
- `opened` - Recipient opened the email
- `clicked` - Recipient clicked a link in the email
- `bounced` / `complained` - Email bounced or marked as spam

**Response**:
```json
{
  "success": true,
  "event_recorded": true,
  "invitation_id": "uuid",
  "event_type": "opened"
}
```

**Usage Example**:
```typescript
// Configure your email service provider webhook to POST to:
// https://your-project.supabase.co/functions/v1/record-email-event

// Example webhook payload from email provider:
await fetch(`${supabaseUrl}/functions/v1/record-email-event`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    event_type: 'opened',
    email: 'sponsor@example.com',
    invitation_token: tokenFromEmail,
    timestamp: new Date().toISOString(),
  }),
});
```

**Features**:
- Accepts events from email service providers
- Finds invitation by token, invitation_id, or email
- Records event in `email_events` table
- Updates invitation status automatically
- Maps provider-specific events to standard types
- Handles missing invitations gracefully
- No authentication required for webhook compatibility

**Invitation Status Updates**:
- `opened` event → Update invitation status to "opened"
- `clicked` event → Update invitation status to "clicked"
- `bounced` event → Update invitation status to "bounced"

---

### 3. export-pdf

**Purpose**: Generate print-ready HTML from campaign data and store in Supabase Storage for PDF conversion.

**Endpoint**: `POST /functions/v1/export-pdf`

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "campaign_id": "uuid",
  "html_content": "<div><h2>Campaign Report</h2><p>Details...</p></div>",
  "filename": "campaign-report-2025.pdf",
  "format": "a4",
  "orientation": "portrait"
}
```

**Parameters**:
- `campaign_id` (required): Campaign UUID
- `html_content` (required): HTML content to convert
- `filename` (optional): Output filename (default: `campaign-{id}-{timestamp}.pdf`)
- `format` (optional): Page format - `a4` or `letter` (default: `a4`)
- `orientation` (optional): Page orientation - `portrait` or `landscape` (default: `portrait`)

**Response**:
```json
{
  "success": true,
  "message": "HTML prepared for PDF generation",
  "html_url": "https://...supabase.co/storage/v1/object/public/exports/tenant-id/exports/file.html",
  "storage_path": "tenant-id/exports/campaign-report.html",
  "campaign_id": "uuid",
  "campaign_title": "Campaign Title",
  "note": "HTML file generated and stored. Use browser Print to PDF or external PDF service.",
  "usage": {
    "browser": "Open html_url in browser, press Ctrl+P (or Cmd+P), and select 'Save as PDF'",
    "api": "POST html_url to a PDF generation service (e.g., Puppeteer, WeasyPrint, PDFShift)",
    "client": "Use html2pdf.js or similar library on the frontend to convert"
  }
}
```

**Usage Example**:
```typescript
// Prepare HTML content with campaign data
const htmlContent = `
  <div>
    <h2>Campaign: ${campaign.title}</h2>
    <p>Objective: ${campaign.objective_amount}€</p>
    <table>
      <tr><th>Sponsor</th><th>Status</th><th>Amount</th></tr>
      ${pledges.map(p => `
        <tr>
          <td>${p.sponsor_name}</td>
          <td>${p.status}</td>
          <td>${p.amount}€</td>
        </tr>
      `).join('')}
    </table>
  </div>
`;

// Call Edge Function
const response = await fetch(`${supabaseUrl}/functions/v1/export-pdf`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    campaign_id: campaignId,
    html_content: htmlContent,
    filename: 'campaign-report.pdf',
    format: 'a4',
    orientation: 'portrait',
  }),
});

const result = await response.json();

// Open HTML in new tab for print
window.open(result.html_url, '_blank');
```

**Features**:
- Validates user has access to campaign
- Wraps HTML with print-optimized styles
- Sets proper page size and margins
- Adds header with campaign title and date
- Adds footer with metadata
- Uploads HTML to Supabase Storage
- Returns public URL for conversion
- Supports A4 and Letter formats
- Supports portrait and landscape orientation

**PDF Conversion Options**:

1. **Browser Print** (Easiest):
   - Open `html_url` in browser
   - Press `Ctrl+P` / `Cmd+P`
   - Select "Save as PDF"

2. **Client-side Library**:
   ```typescript
   import html2pdf from 'html2pdf.js';

   const element = document.createElement('div');
   element.innerHTML = htmlContent;
   html2pdf().from(element).save('report.pdf');
   ```

3. **External PDF Service**:
   - Use services like Puppeteer, WeasyPrint, PDFShift
   - POST the `html_url` to their API
   - Receive generated PDF

---

### 4. send-invitation

**Purpose**: Send a single invitation email to a sponsor.

**Endpoint**: `POST /functions/v1/send-invitation`

**Authentication**: Required (JWT)

**Usage**: Called by `create-invitations` or manually for individual invitations.

---

### 5. send-confirmation

**Purpose**: Send confirmation email to sponsor after they submit a pledge.

**Endpoint**: `POST /functions/v1/send-confirmation`

**Authentication**: Not required (called from public pledge form)

**Usage**: Called automatically after successful pledge submission.

---

### 6. send-reminders

**Purpose**: Send reminder emails to sponsors who haven't responded.

**Endpoint**: `POST /functions/v1/send-reminders`

**Authentication**: Required (JWT)

**Usage**: Called by scheduled job or manual trigger from reminders dashboard.

---

## Common Patterns

### Error Handling

All functions return consistent error format:
```json
{
  "error": "Error message description"
}
```

### CORS Headers

All functions include CORS headers for cross-origin requests:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
```

### Authentication

Functions requiring authentication check JWT token:
```typescript
const authHeader = req.headers.get('Authorization');
const token = authHeader.replace('Bearer ', '');
const { data: { user } } = await supabaseClient.auth.getUser(token);
```

## Environment Variables

All functions have automatic access to:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `SUPABASE_ANON_KEY` - Anonymous key for public operations

## Deployment

Functions are deployed using the Supabase CLI or MCP tools:

```bash
# List deployed functions
supabase functions list

# Deploy a function
supabase functions deploy function-name

# View function logs
supabase functions logs function-name
```

## Security Considerations

1. **Authentication**: Functions with `verify_jwt: true` require valid user token
2. **RLS Policies**: All database operations respect Row Level Security policies
3. **Service Role**: Used only for operations that bypass RLS (like sending emails)
4. **Tenant Isolation**: All operations validate tenant_id matches user's tenant
5. **Input Validation**: All inputs are validated before processing
6. **Token Expiration**: Invitation tokens automatically expire based on `expires_at`

## Monitoring

Monitor function execution in Supabase Dashboard:
- Function Logs: Real-time execution logs
- Metrics: Request count, error rate, execution time
- Alerts: Configure alerts for errors or high latency

## Best Practices

1. Always validate required parameters
2. Use try-catch for error handling
3. Return meaningful error messages
4. Log important events for debugging
5. Keep functions focused on single responsibility
6. Use service role key only when necessary
7. Test with both success and error scenarios
8. Document expected request/response formats
