/*
  # Create reminders table for scheduled follow-ups

  1. New Tables
    - `reminders`
      - `id` (uuid, primary key)
      - `invitation_id` (uuid, foreign key to invitations)
      - `scheduled_for` (timestamptz) - When the reminder should be sent
      - `sent_at` (timestamptz, nullable) - When the reminder was actually sent
      - `status` (text) - pending, sent, failed, cancelled
      - `error_message` (text, nullable) - Error details if failed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on invitation_id for fast lookups
    - Index on scheduled_for + status for reminder processing
    - Index on status for filtering pending reminders

  3. Security
    - Enable RLS on `reminders` table
    - Add policies for club_admin to manage their reminders
    - Add policy for service role to process reminders

  4. Additional Changes
    - Add token column to invitations table if not exists
    - Add index on invitations.token for fast lookups
*/

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_invitation_id ON reminders(invitation_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_status ON reminders(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can view their reminders"
  ON reminders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invitations i
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN profiles p ON p.tenant_id = c.tenant_id
      WHERE i.id = reminders.invitation_id
      AND p.user_id = auth.uid()
      AND p.role = 'club_admin'
    )
  );

CREATE POLICY "Club admins can insert their reminders"
  ON reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invitations i
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN profiles p ON p.tenant_id = c.tenant_id
      WHERE i.id = reminders.invitation_id
      AND p.user_id = auth.uid()
      AND p.role = 'club_admin'
    )
  );

CREATE POLICY "Club admins can update their reminders"
  ON reminders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invitations i
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN profiles p ON p.tenant_id = c.tenant_id
      WHERE i.id = reminders.invitation_id
      AND p.user_id = auth.uid()
      AND p.role = 'club_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invitations i
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN profiles p ON p.tenant_id = c.tenant_id
      WHERE i.id = reminders.invitation_id
      AND p.user_id = auth.uid()
      AND p.role = 'club_admin'
    )
  );

CREATE POLICY "Club admins can delete their reminders"
  ON reminders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invitations i
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN profiles p ON p.tenant_id = c.tenant_id
      WHERE i.id = reminders.invitation_id
      AND p.user_id = auth.uid()
      AND p.role = 'club_admin'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'token'
  ) THEN
    ALTER TABLE invitations ADD COLUMN token text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token) WHERE token IS NOT NULL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reminders_updated_at ON reminders;
CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
