/*
  # Create email_test_logs table

  1. New Tables
    - `email_test_logs`
      - `id` (uuid, primary key) - Unique identifier for each test log
      - `user_id` (uuid, foreign key) - References app_users who initiated the test
      - `to_email` (text) - Recipient email address
      - `status` (text) - Status of the email test (sent, failed)
      - `response_json` (jsonb) - Response data from Resend API
      - `created_at` (timestamptz) - Timestamp of the test

  2. Security
    - Enable RLS on `email_test_logs` table
    - Add policy for super_admin users to view all logs
    - Add policy for authenticated users to view their own logs
*/

CREATE TABLE IF NOT EXISTS email_test_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  response_json jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all email test logs"
  ON email_test_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users
      WHERE app_users.id = auth.uid()
      AND app_users.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their own email test logs"
  ON email_test_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert email test logs"
  ON email_test_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_test_logs_user_id ON email_test_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_test_logs_created_at ON email_test_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_test_logs_status ON email_test_logs(status);
