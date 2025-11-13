# Resend Email Configuration

This project uses Resend for sending test emails via the `/email-test` page.

## Prerequisites

1. Create a Resend account at https://resend.com
2. Verify your domain or use the Resend test domain
3. Generate an API key from the Resend dashboard

## Configuration

### Supabase Edge Function Environment Variables

The `send-test-email` edge function requires the following environment variables:

#### Required:
- `RESEND_API_KEY` - Your Resend API key (starts with `re_`)

#### Optional:
- `FROM_EMAIL` - Custom sender email address (default: `No-Reply <noreply@a2display.fr>`)

### Setting Environment Variables

You can set environment variables for Supabase Edge Functions in two ways:

#### 1. Via Supabase Dashboard (Recommended for Production)

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Click on **Environment Variables**
4. Add the following variables:
   - Name: `RESEND_API_KEY`, Value: `re_your_api_key_here`
   - Name: `FROM_EMAIL`, Value: `Your Name <email@yourdomain.com>` (optional)

#### 2. Via Supabase CLI (For Local Development)

Create a `.env.local` file in your project root:

```bash
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=Your Name <email@yourdomain.com>
```

Then run the function locally:
```bash
supabase functions serve send-test-email --env-file .env.local
```

## Verifying Domain in Resend

To send emails from your own domain:

1. Go to Resend Dashboard → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `a2display.fr`)
4. Add the provided DNS records to your domain:
   - MX record
   - TXT record (SPF)
   - TXT record (DKIM)
5. Wait for verification (can take up to 48 hours)
6. Update `FROM_EMAIL` to use your verified domain

## Testing the Configuration

1. Navigate to `/email-test` in your application
2. Log in as a super_admin or club_admin
3. Select a template
4. Enter a recipient email
5. Click **Send Test**

If the `RESEND_API_KEY` is not configured, you'll receive a clear error message:
```json
{
  "error": "Email service not configured",
  "message": "RESEND_API_KEY environment variable is missing"
}
```

## API Response Codes

The `send-test-email` endpoint returns:

- **200** - Email sent successfully
  ```json
  {
    "id": "resend_email_id",
    "success": true,
    "message": "Test email sent successfully"
  }
  ```

- **400** - Invalid request (missing fields or invalid email format)
  ```json
  {
    "error": "Missing required fields: to, subject, html"
  }
  ```

- **401** - Unauthorized (not logged in)
  ```json
  {
    "error": "Unauthorized - invalid session"
  }
  ```

- **500** - Server error (Resend API key missing or Resend API error)
  ```json
  {
    "error": "Email service not configured",
    "message": "RESEND_API_KEY environment variable is missing"
  }
  ```

## Security

- The endpoint requires authentication via Supabase session
- Only logged-in users (super_admin or club_admin) can send test emails
- The Authorization header is validated before sending emails
- All email sends are logged with user context for audit purposes

## Logs

Check the Supabase Edge Function logs to see email activity:

```
Sending test email via Resend: {
  to: "recipient@example.com",
  subject: "Test Email",
  from: "noreply@a2display.fr",
  htmlLength: 2500,
  userId: "user-uuid",
  userEmail: "admin@example.com",
  meta: { templateId: "...", scope: "global", tenantId: "..." }
}

Test email sent successfully: {
  resendId: "re_abc123...",
  to: "recipient@example.com",
  userId: "user-uuid",
  meta: { ... }
}
```

## Troubleshooting

### Error: "Email service not configured"
- Solution: Add `RESEND_API_KEY` to your Supabase Edge Function environment variables

### Error: "Failed to send email"
- Check that your Resend API key is valid
- Verify your domain in Resend if using a custom domain
- Check Resend dashboard for API errors or rate limits

### Error: "Unauthorized - invalid session"
- Make sure you're logged in
- Check that your session hasn't expired
- Verify the Authorization header is being sent correctly
