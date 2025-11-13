/*
  # Add Tenant Settings Columns

  1. New Columns
    - `email_signature_html` (text)
      - HTML signature to append to all emails sent by the club
      - Used in invitation, confirmation, and reminder emails
      - Default empty string
    
    - `rgpd_content_md` (text)
      - RGPD/Privacy policy content in Markdown format
      - Displayed to sponsors when they respond to invitations
      - Required for compliance with GDPR regulations
      - Default empty string with basic template

  2. Purpose
    - Allow clubs to customize email signatures with branding
    - Provide RGPD/privacy information to sponsors
    - Maintain compliance with data protection regulations
    - Enhance professional appearance of communications

  3. Usage
    - Editable via SettingsClub page (club_admin only)
    - Email signature automatically appended to emails
    - RGPD content shown on pledge forms
*/

-- Add email_signature_html column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'email_signature_html'
  ) THEN
    ALTER TABLE tenants ADD COLUMN email_signature_html text DEFAULT '';
  END IF;
END $$;

-- Add rgpd_content_md column with default template
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'rgpd_content_md'
  ) THEN
    ALTER TABLE tenants ADD COLUMN rgpd_content_md text DEFAULT '# Protection des données personnelles

## Collecte des données

Dans le cadre de nos campagnes de sponsoring, nous collectons les données suivantes :
- Nom et prénom du contact
- Entreprise
- Adresse email
- Numéro de téléphone
- Informations relatives aux engagements de sponsoring

## Utilisation des données

Vos données sont utilisées uniquement pour :
- Gérer les relations avec nos sponsors
- Traiter les engagements de sponsoring
- Communiquer sur nos campagnes et événements

## Durée de conservation

Vos données sont conservées pendant la durée de notre relation commerciale et jusqu''à 3 ans après la fin de celle-ci.

## Vos droits

Conformément au RGPD, vous disposez des droits suivants :
- Droit d''accès à vos données
- Droit de rectification
- Droit à l''effacement
- Droit d''opposition
- Droit à la portabilité

Pour exercer vos droits, contactez-nous par email.';
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN tenants.email_signature_html IS 
'HTML signature appended to all emails sent by the club. Used in invitations, confirmations, and reminders.';

COMMENT ON COLUMN tenants.rgpd_content_md IS 
'RGPD/Privacy policy content in Markdown format. Displayed to sponsors on pledge forms for GDPR compliance.';
