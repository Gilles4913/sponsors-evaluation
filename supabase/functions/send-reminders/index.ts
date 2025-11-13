import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailTemplate {
  subject: string;
  html_body: string;
  text_body: string;
}

function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  return markdown
    .split('\n')
    .map(line => {
      if (line.startsWith('# ')) {
        return `<h1 style="font-size: 24px; font-weight: bold; margin-top: 16px; margin-bottom: 8px; color: #1e293b;">${line.substring(2)}</h1>`;
      }
      if (line.startsWith('## ')) {
        return `<h2 style="font-size: 20px; font-weight: bold; margin-top: 12px; margin-bottom: 8px; color: #334155;">${line.substring(3)}</h2>`;
      }
      if (line.startsWith('### ')) {
        return `<h3 style="font-size: 18px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; color: #475569;">${line.substring(4)}</h3>`;
      }
      if (line.startsWith('- ')) {
        return `<li style="margin-left: 20px; margin-bottom: 4px; color: #64748b;">${line.substring(2)}</li>`;
      }
      if (line.trim() === '') {
        return '<br />';
      }
      return `<p style="margin-bottom: 8px; color: #475569; line-height: 1.6;">${line}</p>`;
    })
    .join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    let sentCount = 0;
    const results: any[] = [];

    const { data: invitations, error: invError } = await supabase
      .from('invitations')
      .select(`
        *,
        campaigns!inner(*, tenants!inner(*)),
        sponsors!inner(*)
      `)
      .is('campaigns.deadline', null)
      .eq('status', 'sent');

    if (invError) throw invError;

    for (const invitation of invitations || []) {
      const { data: pledgeExists } = await supabase
        .from('pledges')
        .select('id')
        .eq('campaign_id', invitation.campaign_id)
        .eq('sponsor_id', invitation.sponsor_id)
        .maybeSingle();

      if (pledgeExists) continue;

      const invitationDate = new Date(invitation.created_at);
      const daysSinceInvitation = Math.floor(
        (now.getTime() - invitationDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceInvitation === 5) {
        const { data: template } = await supabase
          .from('email_templates')
          .select('subject, html_body, text_body')
          .eq('type', 'reminder_5d')
          .eq('is_active', true)
          .maybeSingle();

        if (template) {
          const email = await renderTemplateWithTenant(supabase, template, invitation);
          console.log('Sending 5-day reminder to:', invitation.sponsors.email);
          console.log('Has signature:', !!email.has_signature);
          console.log('Has RGPD:', !!email.has_rgpd);

          results.push({
            type: 'reminder_5d',
            to: invitation.sponsors.email,
            campaign: invitation.campaigns.title,
          });
          sentCount++;
        }
      }
    }

    const { data: deadlineInvitations, error: deadlineError } = await supabase
      .from('invitations')
      .select(`
        *,
        campaigns!inner(*, tenants!inner(*)),
        sponsors!inner(*)
      `)
      .not('campaigns.deadline', 'is', null)
      .eq('status', 'sent');

    if (deadlineError) throw deadlineError;

    for (const invitation of deadlineInvitations || []) {
      const { data: pledgeExists } = await supabase
        .from('pledges')
        .select('id')
        .eq('campaign_id', invitation.campaign_id)
        .eq('sponsor_id', invitation.sponsor_id)
        .maybeSingle();

      if (pledgeExists) continue;

      const deadline = new Date(invitation.campaigns.deadline);
      const daysUntilDeadline = Math.floor(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilDeadline === 10) {
        const { data: template } = await supabase
          .from('email_templates')
          .select('subject, html_body, text_body')
          .eq('type', 'reminder_10d')
          .eq('is_active', true)
          .maybeSingle();

        if (template) {
          const email = await renderTemplateWithTenant(supabase, template, invitation);
          console.log('Sending 10-day deadline reminder to:', invitation.sponsors.email);
          console.log('Has signature:', !!email.has_signature);
          console.log('Has RGPD:', !!email.has_rgpd);

          results.push({
            type: 'reminder_10d',
            to: invitation.sponsors.email,
            campaign: invitation.campaigns.title,
          });
          sentCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: sentCount,
        results: results,
        message: `Processed ${sentCount} reminder emails`,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function renderTemplateWithTenant(
  supabase: any,
  template: EmailTemplate,
  invitation: any
): Promise<any> {
  const responseUrl = `${Deno.env.get('SUPABASE_URL')}/invite/${invitation.token}`;

  const variables: Record<string, string> = {
    tenant_name: invitation.campaigns.tenants?.name || '',
    tenant_email: invitation.campaigns.tenants?.email_contact || '',
    contact_name: invitation.sponsors.contact_name || '',
    campaign_title: invitation.campaigns.title || '',
    response_url: responseUrl,
  };

  if (invitation.campaigns.deadline) {
    variables.deadline = new Date(invitation.campaigns.deadline).toLocaleDateString('fr-FR');
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

  const tenant = invitation.campaigns.tenants;
  let hasSignature = false;
  let hasRgpd = false;

  if (tenant?.email_signature_html && tenant.email_signature_html.trim() !== '') {
    hasSignature = true;
    htmlBody += `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        ${tenant.email_signature_html}
      </div>
    `;

    const signatureText = tenant.email_signature_html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (signatureText) {
      textBody += `\n\n---\n${signatureText}`;
    }
  }

  if (tenant?.rgpd_content_md && tenant.rgpd_content_md.trim() !== '') {
    hasRgpd = true;
    const rgpdHtml = markdownToHtml(tenant.rgpd_content_md);

    htmlBody += `
      <div style="margin-top: 32px; padding: 20px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <h4 style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: 600;">Protection des données</h4>
        <div style="font-size: 13px; color: #64748b;">
          ${rgpdHtml}
        </div>
      </div>
    `;

    textBody += `\n\n--- Protection des données ---\n${tenant.rgpd_content_md}`;
  }

  return {
    subject,
    html_body: htmlBody,
    text_body: textBody,
    has_signature: hasSignature,
    has_rgpd: hasRgpd,
  };
}
