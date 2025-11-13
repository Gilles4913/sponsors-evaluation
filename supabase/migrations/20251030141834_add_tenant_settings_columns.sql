/*
  # Add tenant settings columns

  1. Changes to tenants table
    - Add address (text) - Full club address
    - Add phone (text) - Club phone number
    - Add primary_color (text) - Brand primary color hex
    - Add secondary_color (text) - Brand secondary color hex
    - Add email_domain (text) - Custom email sending domain
    - Add email_domain_verified (boolean) - DKIM/SPF/DMARC verification status
    - Add opt_out_default (boolean) - Default opt-out checkbox state
    - Add rgpd_text (text) - RGPD compliance text

  2. Default values
    - Set sensible defaults for new columns
    - primary_color: #3b82f6 (blue)
    - secondary_color: #10b981 (green)
    - opt_out_default: false (not checked by default)
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'address') THEN
    ALTER TABLE tenants ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'phone') THEN
    ALTER TABLE tenants ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'primary_color') THEN
    ALTER TABLE tenants ADD COLUMN primary_color text DEFAULT '#3b82f6';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'secondary_color') THEN
    ALTER TABLE tenants ADD COLUMN secondary_color text DEFAULT '#10b981';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'email_domain') THEN
    ALTER TABLE tenants ADD COLUMN email_domain text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'email_domain_verified') THEN
    ALTER TABLE tenants ADD COLUMN email_domain_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'opt_out_default') THEN
    ALTER TABLE tenants ADD COLUMN opt_out_default boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'rgpd_text') THEN
    ALTER TABLE tenants ADD COLUMN rgpd_text text DEFAULT 'En soumettant ce formulaire, vous acceptez que vos données personnelles soient utilisées pour traiter votre demande de sponsoring. Conformément au RGPD, vous disposez d''un droit d''accès, de rectification et de suppression de vos données.';
  END IF;
END $$;

UPDATE tenants
SET 
  primary_color = COALESCE(primary_color, '#3b82f6'),
  secondary_color = COALESCE(secondary_color, '#10b981'),
  opt_out_default = COALESCE(opt_out_default, false),
  rgpd_text = COALESCE(rgpd_text, 'En soumettant ce formulaire, vous acceptez que vos données personnelles soient utilisées pour traiter votre demande de sponsoring. Conformément au RGPD, vous disposez d''un droit d''accès, de rectification et de suppression de vos données.')
WHERE primary_color IS NULL 
   OR secondary_color IS NULL 
   OR opt_out_default IS NULL 
   OR rgpd_text IS NULL;
