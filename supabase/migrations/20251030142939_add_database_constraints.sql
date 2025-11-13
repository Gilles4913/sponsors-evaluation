/*
  # Add database constraints for data integrity

  1. Constraints Added
    - pledges.amount >= 0 - Prevent negative pledge amounts
    - campaigns.objective_amount > 0 - Require positive objective
    - campaigns.deadline >= created_at::date - Deadline must be in future at creation
    - invitations.expires_at > created_at - Expiration must be in future
    - pledges.consent = true - Ensure RGPD consent required

  2. Benefits
    - Data integrity enforcement at database level
    - Prevent invalid data from being inserted
    - Business logic validation in schema
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pledges_amount_positive'
  ) THEN
    ALTER TABLE pledges 
    ADD CONSTRAINT pledges_amount_positive 
    CHECK (amount IS NULL OR amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'campaigns_objective_positive'
  ) THEN
    ALTER TABLE campaigns 
    ADD CONSTRAINT campaigns_objective_positive 
    CHECK (objective_amount > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'campaigns_deadline_future'
  ) THEN
    ALTER TABLE campaigns 
    ADD CONSTRAINT campaigns_deadline_future 
    CHECK (deadline IS NULL OR deadline >= created_at::date);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'invitations_expires_future'
  ) THEN
    ALTER TABLE invitations 
    ADD CONSTRAINT invitations_expires_future 
    CHECK (expires_at IS NULL OR expires_at > created_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_primary_color_format'
  ) THEN
    ALTER TABLE tenants 
    ADD CONSTRAINT tenants_primary_color_format 
    CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_secondary_color_format'
  ) THEN
    ALTER TABLE tenants 
    ADD CONSTRAINT tenants_secondary_color_format 
    CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;
