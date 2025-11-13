/*
  # Create email templates table and system

  1. New Tables
    - `email_templates`
      - `id` (uuid, primary key)
      - `type` (text) - Template type: invitation, reminder_5d, reminder_10d, confirmation, sponsor_ack, campaign_summary
      - `subject` (text) - Email subject with placeholders
      - `html_body` (text) - HTML email body with placeholders
      - `text_body` (text) - Plain text fallback
      - `placeholders` (json) - Available placeholders for this template
      - `is_active` (boolean) - Whether this template is active
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, references auth.users)

  2. Security
    - Enable RLS on `email_templates` table
    - Add policies for super admins to manage templates
    - Add policy for all authenticated users to read active templates

  3. Data
    - Insert default email templates with placeholders
*/

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  placeholders json NOT NULL DEFAULT '[]'::json,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT valid_template_type CHECK (
    type IN ('invitation', 'reminder_5d', 'reminder_10d', 'confirmation', 'sponsor_ack', 'campaign_summary')
  )
);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Policies for email_templates
CREATE POLICY "All authenticated users can view active templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins can view all templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can create templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Create index
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);

-- Insert default templates
INSERT INTO email_templates (type, subject, html_body, text_body, placeholders) VALUES
(
  'invitation',
  'Invitation : {{campaign_title}}',
  '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 30px; border-radius: 10px; text-align: center;">
      <h1 style="color: white; margin: 0;">{{tenant_name}}</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc; border-radius: 10px; margin-top: 20px;">
      <h2 style="color: #1e293b;">Bonjour {{contact_name}},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Nous avons le plaisir de vous proposer de participer à notre projet : <strong>{{campaign_title}}</strong>.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        {{campaign_description}}
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{response_url}}" style="background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Répondre à l''invitation
        </a>
      </div>
      <p style="color: #64748b; font-size: 14px;">
        Prix indicatif : {{annual_price}}€/an
      </p>
    </div>
    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
      <p>{{tenant_name}} - {{tenant_email}}</p>
    </div>
  </body></html>',
  'Bonjour {{contact_name}},

Nous avons le plaisir de vous proposer de participer à notre projet : {{campaign_title}}.

{{campaign_description}}

Prix indicatif : {{annual_price}}€/an

Pour répondre à cette invitation, cliquez sur le lien suivant :
{{response_url}}

Cordialement,
{{tenant_name}}
{{tenant_email}}',
  '["tenant_name", "tenant_email", "contact_name", "campaign_title", "campaign_description", "annual_price", "response_url"]'::json
),
(
  'reminder_5d',
  'Rappel : {{campaign_title}} - Votre avis nous intéresse',
  '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #3b82f6 100%); padding: 30px; border-radius: 10px; text-align: center;">
      <h1 style="color: white; margin: 0;">Rappel amical</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc; border-radius: 10px; margin-top: 20px;">
      <h2 style="color: #1e293b;">Bonjour {{contact_name}},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Nous vous avons contacté il y a quelques jours concernant <strong>{{campaign_title}}</strong> et nous n''avons pas encore reçu votre réponse.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Votre participation est importante pour nous. Même un simple "non" nous aide à mieux planifier notre projet.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{response_url}}" style="background: linear-gradient(135deg, #f59e0b 0%, #3b82f6 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Donner mon avis
        </a>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
      <p>{{tenant_name}} - {{tenant_email}}</p>
    </div>
  </body></html>',
  'Bonjour {{contact_name}},

Nous vous avons contacté il y a quelques jours concernant {{campaign_title}} et nous n''avons pas encore reçu votre réponse.

Votre participation est importante pour nous. Même un simple "non" nous aide à mieux planifier notre projet.

Pour répondre, cliquez sur le lien suivant :
{{response_url}}

Cordialement,
{{tenant_name}}',
  '["tenant_name", "tenant_email", "contact_name", "campaign_title", "response_url"]'::json
),
(
  'reminder_10d',
  'Dernière chance : {{campaign_title}}',
  '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #ef4444 0%, #f59e0b 100%); padding: 30px; border-radius: 10px; text-align: center;">
      <h1 style="color: white; margin: 0;">Dernière chance</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc; border-radius: 10px; margin-top: 20px;">
      <h2 style="color: #1e293b;">Bonjour {{contact_name}},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        C''est bientôt la date limite pour participer à <strong>{{campaign_title}}</strong>.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Date limite : <strong>{{deadline}}</strong>
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Ne manquez pas cette opportunité ! Nous aimerions vraiment connaître votre position.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{response_url}}" style="background: linear-gradient(135deg, #ef4444 0%, #f59e0b 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Répondre maintenant
        </a>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
      <p>{{tenant_name}} - {{tenant_email}}</p>
    </div>
  </body></html>',
  'Bonjour {{contact_name}},

C''est bientôt la date limite pour participer à {{campaign_title}}.

Date limite : {{deadline}}

Ne manquez pas cette opportunité ! Nous aimerions vraiment connaître votre position.

Pour répondre, cliquez sur le lien suivant :
{{response_url}}

Cordialement,
{{tenant_name}}',
  '["tenant_name", "tenant_email", "contact_name", "campaign_title", "deadline", "response_url"]'::json
),
(
  'confirmation',
  'Merci pour votre participation - {{campaign_title}}',
  '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px; text-align: center;">
      <h1 style="color: white; margin: 0;">Merci !</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc; border-radius: 10px; margin-top: 20px;">
      <h2 style="color: #1e293b;">Bonjour {{contact_name}},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Nous avons bien reçu votre réponse concernant <strong>{{campaign_title}}</strong>.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Votre réponse : <strong style="color: #10b981;">{{response_status}}</strong>
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Nous vous recontacterons prochainement pour la suite.
      </p>
    </div>
    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
      <p>{{tenant_name}} - {{tenant_email}}</p>
    </div>
  </body></html>',
  'Bonjour {{contact_name}},

Nous avons bien reçu votre réponse concernant {{campaign_title}}.

Votre réponse : {{response_status}}

Nous vous recontacterons prochainement pour la suite.

Cordialement,
{{tenant_name}}',
  '["tenant_name", "tenant_email", "contact_name", "campaign_title", "response_status"]'::json
),
(
  'sponsor_ack',
  'Accusé de réception - {{company}}',
  '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px; text-align: center;">
      <h1 style="color: white; margin: 0;">Accusé de réception</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc; border-radius: 10px; margin-top: 20px;">
      <h2 style="color: #1e293b;">Bonjour,</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Ce message confirme que nous avons bien enregistré <strong>{{company}}</strong> dans notre base de sponsors.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Contact : {{contact_name}}<br>
        Email : {{email}}
      </p>
    </div>
    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
      <p>{{tenant_name}}</p>
    </div>
  </body></html>',
  'Bonjour,

Ce message confirme que nous avons bien enregistré {{company}} dans notre base de sponsors.

Contact : {{contact_name}}
Email : {{email}}

Cordialement,
{{tenant_name}}',
  '["tenant_name", "company", "contact_name", "email"]'::json
),
(
  'campaign_summary',
  'Résumé de campagne : {{campaign_title}}',
  '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); padding: 30px; border-radius: 10px; text-align: center;">
      <h1 style="color: white; margin: 0;">Résumé de campagne</h1>
    </div>
    <div style="padding: 30px; background: #f8fafc; border-radius: 10px; margin-top: 20px;">
      <h2 style="color: #1e293b;">{{campaign_title}}</h2>
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #10b981; margin-top: 0;">Statistiques</h3>
        <p style="color: #475569;">Total invitations : {{total_invitations}}</p>
        <p style="color: #475569;">Réponses Oui : {{yes_count}}</p>
        <p style="color: #475569;">Réponses Peut-être : {{maybe_count}}</p>
        <p style="color: #475569;">Réponses Non : {{no_count}}</p>
        <p style="color: #475569; font-weight: bold; font-size: 18px;">Total promis : {{total_pledged}}€</p>
        <p style="color: #475569;">Objectif : {{objective_amount}}€</p>
        <p style="color: #475569;">Taux d''atteinte : {{achievement_rate}}%</p>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
      <p>{{tenant_name}}</p>
    </div>
  </body></html>',
  'Résumé de campagne : {{campaign_title}}

Statistiques :
- Total invitations : {{total_invitations}}
- Réponses Oui : {{yes_count}}
- Réponses Peut-être : {{maybe_count}}
- Réponses Non : {{no_count}}
- Total promis : {{total_pledged}}€
- Objectif : {{objective_amount}}€
- Taux d''atteinte : {{achievement_rate}}%

{{tenant_name}}',
  '["tenant_name", "campaign_title", "total_invitations", "yes_count", "maybe_count", "no_count", "total_pledged", "objective_amount", "achievement_rate"]'::json
)
ON CONFLICT (type) DO NOTHING;
