/*
  # Create scheduled_jobs table for email scheduling

  1. New Tables
    - `scheduled_jobs`
      - `id` (uuid, primary key) - Unique job identifier
      - `tenant_id` (uuid, foreign key) - Associated tenant/club
      - `campaign_id` (uuid, foreign key, nullable) - Associated campaign if applicable
      - `job_type` (text) - Type of job: 'email_invitation', 'email_reminder', etc.
      - `scheduled_at` (timestamptz) - When the job should execute
      - `executed_at` (timestamptz, nullable) - When the job was executed
      - `status` (text) - Job status: 'pending', 'processing', 'completed', 'failed', 'cancelled'
      - `payload` (jsonb) - Job data: { sponsors: [ids], templateId, subject, etc. }
      - `error_message` (text, nullable) - Error details if job failed
      - `created_at` (timestamptz) - Job creation timestamp
      - `created_by` (uuid, foreign key) - User who created the job
      - `updated_at` (timestamptz) - Last update timestamp

  2. Indexes
    - Index on tenant_id for fast tenant-based queries
    - Index on scheduled_at for job scheduling queries
    - Index on status for filtering pending/failed jobs
    - Composite index on (status, scheduled_at) for scheduler queries

  3. Security
    - Enable RLS on `scheduled_jobs` table
    - Users can view jobs for their tenant
    - Users can create jobs for their tenant
    - Users can update jobs they created (cancel/reschedule)
    - Super admins can view all jobs

  4. Notes
    - Timezone handling: All timestamps stored in UTC, converted to Europe/Paris in app
    - Job execution: Handled by edge function or cron job
    - Payload structure validates before insert
    - Status transitions: pending → processing → completed/failed
*/

-- Create scheduled_jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('email_invitation', 'email_reminder', 'email_followup', 'email_custom')),
  scheduled_at timestamptz NOT NULL,
  executed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_tenant_id ON scheduled_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_at ON scheduled_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status_scheduled ON scheduled_jobs(status, scheduled_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view jobs for their tenant
CREATE POLICY "Users can view own tenant jobs"
  ON scheduled_jobs FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Users can create jobs for their tenant
CREATE POLICY "Users can create jobs for own tenant"
  ON scheduled_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can update their own jobs (cancel/reschedule)
CREATE POLICY "Users can update own jobs"
  ON scheduled_jobs FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Policy: Super admins can delete jobs
CREATE POLICY "Super admins can delete jobs"
  ON scheduled_jobs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_scheduled_jobs_updated_at ON scheduled_jobs;
CREATE TRIGGER set_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_jobs_updated_at();
