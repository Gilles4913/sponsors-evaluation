import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationPayload {
  invitation_id: string;
  sponsor_email: string;
  sponsor_name: string;
  sponsor_company: string;
  campaign_title: string;
  campaign_location: string;
  campaign_description?: string;
  campaign_price?: number;
  campaign_footfall?: number;
  response_url: string;
  tenant_id: string;
  tenant_name: string;
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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: InvitationPayload = await req.json();

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('email_signature_html, rgpd_content_md')
      .eq('id', payload.tenant_id)
      .single();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
    }

    let emailHtml = generateEmailHTML(payload);

    if (tenant?.email_signature_html && tenant.email_signature_html.trim() !== '') {
      emailHtml = emailHtml.replace(
        '</table>\n  </body>',
        `
          <tr>
            <td style="padding: 30px; border-top: 1px solid #e2e8f0;">
              ${tenant.email_signature_html}
            </td>
          </tr>
        </table>
      </body>`
      );
    }

    if (tenant?.rgpd_content_md && tenant.rgpd_content_md.trim() !== '') {
      const rgpdHtml = markdownToHtml(tenant.rgpd_content_md);

      emailHtml = emailHtml.replace(
        '</table>\n  </body>',
        `
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <h4 style="margin: 0 0 12px 0; color: #1e40af; font-size: 14px; font-weight: 600;">Protection des données</h4>
              <div style="font-size: 13px; color: #64748b;">
                ${rgpdHtml}
              </div>
            </td>
          </tr>
        </table>
      </body>`
      );
    }

    console.log(`Sending invitation email to ${payload.sponsor_email}`);
    console.log(`Response URL: ${payload.response_url}`);
    console.log(`Campaign: ${payload.campaign_title}`);
    console.log(`Has signature: ${!!tenant?.email_signature_html}`);
    console.log(`Has RGPD: ${!!tenant?.rgpd_content_md}`);

    const emailData = {
      to: payload.sponsor_email,
      subject: `Invitation - ${payload.campaign_title}`,
      html: emailHtml,
      from_name: payload.tenant_name,
    };

    console.log("Email prepared successfully", {
      to: emailData.to,
      subject: emailData.subject,
      htmlLength: emailData.html.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation email queued",
        invitation_id: payload.invitation_id,
        email: payload.sponsor_email,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending invitation:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

function generateEmailHTML(payload: InvitationPayload): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                Opportunité de sponsoring
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Bonjour ${payload.sponsor_name},
              </p>

              <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
                Nous avons le plaisir de vous présenter notre nouvelle opportunité de sponsoring :
              </p>

              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin: 0 0 30px;">
                <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 700;">
                  ${payload.campaign_title}
                </h2>
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                  <strong style="color: #1e293b;">Localisation :</strong> ${payload.campaign_location}
                </p>
                ${payload.campaign_footfall ? `
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                  <strong style="color: #1e293b;">Visibilité :</strong> ${payload.campaign_footfall.toLocaleString()} personnes/jour
                </p>
                ` : ''}
                ${payload.campaign_price ? `
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                  <strong style="color: #1e293b;">Tarif indicatif :</strong> ${payload.campaign_price.toLocaleString()}€/an
                </p>
                ` : ''}
                ${payload.campaign_description ? `
                <p style="margin: 12px 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  ${payload.campaign_description.substring(0, 200)}${payload.campaign_description.length > 200 ? '...' : ''}
                </p>
                ` : ''}
              </div>

              <p style="margin: 0 0 30px; color: #475569; font-size: 15px; line-height: 1.6;">
                Nous serions ravis de compter ${payload.sponsor_company} parmi nos partenaires.
                Merci de nous faire part de votre intérêt en cliquant sur le lien ci-dessous :
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${payload.response_url}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
                      Répondre à l'invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 10px; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                Ce lien est personnel et expire dans 30 jours.
              </p>

              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                Si vous avez des questions, n'hésitez pas à nous contacter.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">
                Plateforme de sponsoring sportif
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © ${new Date().getFullYear()} - Tous droits réservés
              </p>
            </td>
          </tr>
        </table>
      </body>
</html>
  `.trim();
}
