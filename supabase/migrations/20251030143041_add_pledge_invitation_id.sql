/*
  # Add invitation_id to pledges table

  1. Changes
    - Add invitation_id column to pledges
    - Add foreign key constraint
    - Create index for fast lookups

  2. Purpose
    - Track which invitation generated each pledge
    - Enable token-based RLS policies
    - Support analytics on invitation effectiveness
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pledges' AND column_name = 'invitation_id'
  ) THEN
    ALTER TABLE pledges ADD COLUMN invitation_id uuid;
    
    ALTER TABLE pledges 
    ADD CONSTRAINT pledges_invitation_id_fkey 
    FOREIGN KEY (invitation_id) 
    REFERENCES invitations(id) 
    ON DELETE SET NULL;
    
    CREATE INDEX idx_pledges_invitation_id 
    ON pledges(invitation_id);
  END IF;
END $$;
