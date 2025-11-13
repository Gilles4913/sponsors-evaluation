# Cron Job Setup for job-runner Edge Function

This guide explains how to set up a cron trigger to automatically execute scheduled jobs.

## Overview

The `job-runner` Edge Function processes scheduled jobs from the `scheduled_jobs` table. It should be triggered every minute via a cron job to check for pending jobs and execute them.

## Edge Function Details

**Function Name**: `job-runner`
**Purpose**: Process scheduled email invitations and other jobs
**Trigger**: Cron (every minute)

### What it does:

1. Queries `scheduled_jobs` for pending jobs where `scheduled_at <= now()`
2. For each job:
   - Updates status to `processing`
   - Creates invitations in the database
   - Generates and logs email sending
   - Records events in `email_events` table
   - Creates reminders if configured
   - Updates job status to `completed` or `failed`
   - Sets `executed_at` timestamp

## Setup Options

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Database > Functions**
3. Click **"Create a new function"**
4. Use the following configuration:

```sql
-- Create a cron job to run every minute
SELECT cron.schedule(
  'job-runner-cron',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-runner',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

5. Replace:
   - `YOUR_PROJECT_REF` with your Supabase project reference (e.g., `xepxazfhpzahcntimwyr`)
   - `YOUR_SERVICE_ROLE_KEY` with your service role key from Settings > API

### Option 2: External Cron Service

You can use external services like:
- **GitHub Actions** (free for public repos)
- **Vercel Cron** (if deployed on Vercel)
- **Cron-job.org** (free service)
- **Your own server's crontab**

#### Example: GitHub Actions Workflow

Create `.github/workflows/job-runner.yml`:

```yaml
name: Scheduled Job Runner

on:
  schedule:
    # Runs every minute
    - cron: '* * * * *'
  workflow_dispatch:

jobs:
  run-jobs:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger job-runner
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-runner
```

Add `SUPABASE_SERVICE_ROLE_KEY` to your GitHub repository secrets.

#### Example: crontab (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Add this line (runs every minute)
* * * * * curl -X POST -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" -H "Content-Type: application/json" https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-runner
```

### Option 3: pg_cron Extension (Database-level)

1. Enable pg_cron extension in Supabase Dashboard
2. Run this SQL:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job
SELECT cron.schedule(
  'job-runner',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Cron Schedule Syntax

The cron expression `* * * * *` means:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Examples**:
- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour at minute 0
- `0 9 * * *` - Every day at 9:00 AM
- `0 9 * * 1` - Every Monday at 9:00 AM

## Monitoring

### Check Job Execution

Query scheduled jobs status:

```sql
SELECT
  id,
  job_type,
  status,
  scheduled_at,
  executed_at,
  error_message,
  created_at
FROM scheduled_jobs
ORDER BY scheduled_at DESC
LIMIT 20;
```

### Check Email Events

View email sending logs:

```sql
SELECT
  ee.id,
  ee.event_type,
  ee.event_data,
  ee.created_at,
  i.email as recipient_email
FROM email_events ee
LEFT JOIN invitations i ON i.id = ee.invitation_id
WHERE ee.event_data->>'job_id' IS NOT NULL
ORDER BY ee.created_at DESC
LIMIT 20;
```

### Check Pending Jobs

See what jobs are waiting to be executed:

```sql
SELECT
  id,
  job_type,
  scheduled_at,
  payload->>'campaignData'->>'title' as campaign_title,
  jsonb_array_length(payload->'sponsors') as sponsor_count
FROM scheduled_jobs
WHERE status = 'pending'
  AND scheduled_at <= NOW()
ORDER BY scheduled_at ASC;
```

## Troubleshooting

### Issue: Jobs not being processed

**Check**:
1. Verify cron job is running (check logs in your cron service)
2. Check Edge Function logs in Supabase Dashboard > Edge Functions > job-runner
3. Verify `scheduled_at` timestamps are in the past
4. Check job status is 'pending'

**Solution**:
```sql
-- Reset stuck jobs
UPDATE scheduled_jobs
SET status = 'pending'
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '5 minutes';
```

### Issue: Jobs marked as failed

**Check**:
1. Review `error_message` column in scheduled_jobs
2. Check email_events for detailed error logs

```sql
SELECT
  id,
  job_type,
  error_message,
  payload,
  executed_at
FROM scheduled_jobs
WHERE status = 'failed'
ORDER BY executed_at DESC
LIMIT 10;
```

### Issue: Cron not triggering

**Verify**:
1. Cron expression is correct
2. Authorization header includes valid service role key
3. Edge Function URL is correct
4. Service role key has not expired

**Test manually**:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-runner
```

## Performance Considerations

### Batch Size

The job-runner processes up to 10 jobs per execution (configurable in the function):

```typescript
.limit(10)  // Adjust this value as needed
```

For high-volume scenarios:
- Increase limit for more jobs per run
- Decrease cron interval (e.g., every 30 seconds)
- Add multiple workers with different filters

### Rate Limiting

The function includes a 100ms delay between sponsors:

```typescript
await new Promise((resolve) => setTimeout(resolve, 100));
```

Adjust based on email provider rate limits.

## Security

### Service Role Key

- Never expose service role key in client-side code
- Store securely in environment variables or secrets management
- Rotate keys periodically
- Use restricted keys if available

### Function Authentication

The job-runner function has `verify_jwt: false` because it's triggered by cron, not users. Ensure:
1. Only your cron service can call it (use IP restrictions if possible)
2. Service role key is kept secure
3. Function validates data from database

## Testing

### Manual Trigger

Test the function manually:

```bash
# Using curl
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-runner

# Expected response:
{
  "message": "Jobs processed",
  "processed": 2,
  "results": [
    { "job_id": "uuid", "status": "completed" },
    { "job_id": "uuid", "status": "completed" }
  ]
}
```

### Create Test Job

```sql
-- Insert a test job (scheduled for now)
INSERT INTO scheduled_jobs (
  tenant_id,
  campaign_id,
  job_type,
  scheduled_at,
  status,
  payload
)
SELECT
  t.id as tenant_id,
  c.id as campaign_id,
  'email_invitation',
  NOW() - INTERVAL '1 minute',
  'pending',
  jsonb_build_object(
    'sponsors', jsonb_build_array(
      jsonb_build_object(
        'id', s.id,
        'email', s.email,
        'company', s.company,
        'contact_name', s.contact_name
      )
    ),
    'campaignId', c.id,
    'campaignData', jsonb_build_object(
      'title', c.title,
      'location', c.location,
      'description', c.description_md,
      'price', c.annual_price_hint,
      'footfall', c.daily_footfall_estimate
    )
  )
FROM tenants t
CROSS JOIN campaigns c
CROSS JOIN sponsors s
WHERE t.id = c.tenant_id
  AND s.tenant_id = t.id
LIMIT 1;
```

## Next Steps

After setting up the cron job:

1. Test with a scheduled job to verify execution
2. Monitor logs for the first few runs
3. Set up alerts for failed jobs (optional)
4. Document your specific cron setup for your team

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
- [Cron Expression Generator](https://crontab.guru/)
