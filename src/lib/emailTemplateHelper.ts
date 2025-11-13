import { SupabaseClient } from '@supabase/supabase-js';

interface TenantEmailSettings {
  email_signature_html: string;
  rgpd_content_md: string;
}

interface TemplatedEmailData {
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

export async function sendTemplatedEmail(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    recipientEmail: string;
    recipientName: string;
    templateType: string;
    variables: Record<string, string>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('email_signature_html, rgpd_content_md, name, email_contact')
      .eq('id', params.tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('Failed to fetch tenant:', tenantError);
      return { success: false, error: 'Tenant not found' };
    }

    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject, html_body, text_body')
      .eq('type', params.templateType)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      console.error('Template not found:', params.templateType, templateError);
      return { success: false, error: 'Template not found' };
    }

    let subject = template.subject;
    let htmlBody = template.html_body;
    let textBody = template.text_body;

    Object.entries(params.variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(placeholder, value);
      htmlBody = htmlBody.replace(placeholder, value);
      textBody = textBody.replace(placeholder, value);
    });

    if (tenant.email_signature_html && tenant.email_signature_html.trim() !== '') {
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

    if (tenant.rgpd_content_md && tenant.rgpd_content_md.trim() !== '') {
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

    const emailPayload = {
      to: params.recipientEmail,
      subject: subject,
      html: htmlBody,
      text: textBody,
      from_name: tenant.name,
      from_email: tenant.email_contact,
    };

    console.log('Email prepared:', {
      to: params.recipientEmail,
      subject: subject,
      hasSignature: !!tenant.email_signature_html,
      hasRgpd: !!tenant.rgpd_content_md,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error preparing templated email:', error);
    return { success: false, error: error.message };
  }
}

export async function getTenantEmailSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantEmailSettings | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('email_signature_html, rgpd_content_md')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      console.error('Failed to fetch tenant email settings:', error);
      return null;
    }

    return {
      email_signature_html: data.email_signature_html || '',
      rgpd_content_md: data.rgpd_content_md || '',
    };
  } catch (error) {
    console.error('Error fetching tenant email settings:', error);
    return null;
  }
}

export function injectSignatureAndRgpd(
  htmlBody: string,
  textBody: string,
  settings: TenantEmailSettings
): { html: string; text: string } {
  let html = htmlBody;
  let text = textBody;

  if (settings.email_signature_html && settings.email_signature_html.trim() !== '') {
    html += `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        ${settings.email_signature_html}
      </div>
    `;

    const signatureText = settings.email_signature_html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (signatureText) {
      text += `\n\n---\n${signatureText}`;
    }
  }

  if (settings.rgpd_content_md && settings.rgpd_content_md.trim() !== '') {
    const rgpdHtml = markdownToHtml(settings.rgpd_content_md);

    html += `
      <div style="margin-top: 32px; padding: 20px; background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <h4 style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: 600;">Protection des données</h4>
        <div style="font-size: 13px; color: #64748b;">
          ${rgpdHtml}
        </div>
      </div>
    `;

    text += `\n\n--- Protection des données ---\n${settings.rgpd_content_md}`;
  }

  return { html, text };
}
