/*
  # Add cost_estimate field to campaigns

  1. Changes
    - Add `cost_estimate` column to `campaigns` table
      - Type: numeric (same as objective_amount and annual_price_hint)
      - Default: 0
      - Represents the estimated cost of the equipment/project
      - Used to calculate break-even point and gap analysis

  2. Notes
    - Non-breaking change: existing campaigns will have cost_estimate = 0
    - Can be updated via campaign edit form
    - Used for financial analysis and sponsor target calculations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'cost_estimate'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN cost_estimate numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;
