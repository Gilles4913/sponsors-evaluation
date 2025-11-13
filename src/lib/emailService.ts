import { supabase } from './supabase';

interface EmailTemplateData {
  type: string;
  variables: Record<string, string>;
}

export async function renderEmailTemplate(
  templateType: string,
  variables: Record<string, string>,
  tenantId?: string
): Promise<{ subject: string; html_body: string; text_body: string } | null> {
  const { data: template, error } = await supabase
    .from('email_templates')
    .select('subject, html_body, text_body')
    .eq('type', templateType)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !template) {
    console.error('Template not found:', templateType, error);
    return null;
  }

  let subject = template.subject;
  let htmlBody = template.html_body;
  let textBody = template.text_body;

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(placeholder, value);
    htmlBody = htmlBody.replace(placeholder, value);
    textBody = textBody.replace(placeholder, value);
  });

  if (tenantId) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('email_signature_html, rgpd_content_md')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenant) {
      const signature = tenant.email_signature_html || '';
      const rgpdExcerpt = extractRGPDExcerpt(tenant.rgpd_content_md);

      const footer = `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
          ${signature}
        </div>
        ${rgpdExcerpt ? `
          <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #3b82f6; font-size: 12px; color: #6b7280;">
            <strong style="color: #1f2937;">Protection des données (RGPD)</strong>
            <p style="margin: 5px 0 0 0;">${rgpdExcerpt}</p>
          </div>
        ` : ''}
      `;

      htmlBody = htmlBody + footer;
    }
  }

  return {
    subject,
    html_body: htmlBody,
    text_body: textBody,
  };
}

function extractRGPDExcerpt(rgpdContentMd: string | null): string {
  if (!rgpdContentMd) return '';

  const lines = rgpdContentMd.split('\n').filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#');
  });

  const firstParagraph = lines[0] || '';
  if (firstParagraph.length > 200) {
    return firstParagraph.substring(0, 197) + '...';
  }
  return firstParagraph;
}

export function getInvitationVariables(
  tenant: any,
  campaign: any,
  sponsor: any,
  invitation: any
): Record<string, string> {
  const responseUrl = `${window.location.origin}/invite/${invitation.token}`;

  return {
    tenant_name: tenant.name || '',
    tenant_email: tenant.email_contact || '',
    contact_name: sponsor.contact_name || '',
    campaign_title: campaign.title || '',
    campaign_description: campaign.description_md || '',
    annual_price: campaign.annual_price_hint?.toString() || '0',
    response_url: responseUrl,
  };
}

export function getReminderVariables(
  tenant: any,
  campaign: any,
  sponsor: any,
  invitation: any,
  reminderType: 'reminder_5d' | 'reminder_10d'
): Record<string, string> {
  const responseUrl = `${window.location.origin}/invite/${invitation.token}`;

  const variables: Record<string, string> = {
    tenant_name: tenant.name || '',
    tenant_email: tenant.email_contact || '',
    contact_name: sponsor.contact_name || '',
    campaign_title: campaign.title || '',
    response_url: responseUrl,
  };

  if (reminderType === 'reminder_10d' && campaign.deadline) {
    variables.deadline = new Date(campaign.deadline).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return variables;
}

export function getConfirmationVariables(
  tenant: any,
  campaign: any,
  sponsor: any,
  pledge: any
): Record<string, string> {
  const statusLabels: Record<string, string> = {
    yes: 'Oui, je participe',
    maybe: 'Peut-être',
    no: 'Non, pas cette fois',
  };

  return {
    tenant_name: tenant.name || '',
    tenant_email: tenant.email_contact || '',
    contact_name: sponsor.contact_name || '',
    campaign_title: campaign.title || '',
    response_status: statusLabels[pledge.status] || pledge.status,
  };
}

export function getSponsorAckVariables(
  tenant: any,
  sponsor: any
): Record<string, string> {
  return {
    tenant_name: tenant.name || '',
    company: sponsor.company || '',
    contact_name: sponsor.contact_name || '',
    email: sponsor.email || '',
  };
}

export function getCampaignSummaryVariables(
  tenant: any,
  campaign: any,
  stats: {
    total_invitations: number;
    yes_count: number;
    maybe_count: number;
    no_count: number;
    total_pledged: number;
    achievement_rate: number;
  }
): Record<string, string> {
  return {
    tenant_name: tenant.name || '',
    campaign_title: campaign.title || '',
    total_invitations: stats.total_invitations.toString(),
    yes_count: stats.yes_count.toString(),
    maybe_count: stats.maybe_count.toString(),
    no_count: stats.no_count.toString(),
    total_pledged: stats.total_pledged.toLocaleString('fr-FR'),
    objective_amount: campaign.objective_amount?.toLocaleString('fr-FR') || '0',
    achievement_rate: stats.achievement_rate.toFixed(1),
  };
}
