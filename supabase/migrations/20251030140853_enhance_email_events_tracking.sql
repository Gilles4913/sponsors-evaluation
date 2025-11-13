/*
  # Enhance email_events table for comprehensive tracking

  1. Changes
    - Add campaign_id, sponsor_id, email, tenant_id columns
    - Rename type to event_type
    - Rename meta_json to event_data (jsonb)
    - Add indexes for performance
    - Add RLS policies using users table
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_events' AND column_name = 'campaign_id') THEN
    ALTER TABLE email_events ADD COLUMN campaign_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_events' AND column_name = 'sponsor_id') THEN
    ALTER TABLE email_events ADD COLUMN sponsor_id uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_events' AND column_name = 'email') THEN
    ALTER TABLE email_events ADD COLUMN email text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_events' AND column_name = 'event_type') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_events' AND column_name = 'type') THEN
      ALTER TABLE email_events RENAME COLUMN type TO event_type;
    ELSE
      ALTER TABLE email_events ADD COLUMN event_type text NOT NULL DEFAULT 'sent';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_events' AND column_name = 'event_data') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_events' AND column_name = 'meta_json') THEN
      ALTER TABLE email_events RENAME COLUMN meta_json TO event_data;
    ELSE
      ALTER TABLE email_events ADD COLUMN event_data jsonb DEFAULT '{}'::jsonb;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_events' AND column_name = 'tenant_id') THEN
    ALTER TABLE email_events ADD COLUMN tenant_id uuid;
  END IF;
END $$;

UPDATE email_events SET email = '' WHERE email IS NULL;
ALTER TABLE email_events ALTER COLUMN email SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON email_events(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_events_invitation_id ON email_events(invitation_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_tenant_id ON email_events(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club admins can view their email events" ON email_events;
CREATE POLICY "Club admins can view their email events"
  ON email_events
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.tenant_id = email_events.tenant_id
      AND users.role = 'club_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can view all email events" ON email_events;
CREATE POLICY "Super admins can view all email events"
  ON email_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Service role can insert email events" ON email_events;
CREATE POLICY "Service role can insert email events"
  ON email_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
