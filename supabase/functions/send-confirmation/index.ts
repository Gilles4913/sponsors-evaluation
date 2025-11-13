import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConfirmationPayload {
  sponsor_email: string;
  sponsor_name: string;
  campaign_title: string;
  status: 'yes' | 'maybe' | 'no';
  amount?: number;
  comment?: string;
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

    const payload: ConfirmationPayload = await req.json();

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('email_signature_html, rgpd_content_md')
      .eq('id', payload.tenant_id)
      .single();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
    }

    let emailHtml = generateConfirmationEmail(payload);

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

    console.log(`Sending confirmation email to ${payload.sponsor_email}`);
    console.log(`Has signature: ${!!tenant?.email_signature_html}`);
    console.log(`Has RGPD: ${!!tenant?.rgpd_content_md}`);

    const emailData = {
      to: payload.sponsor_email,
      subject: `Confirmation de votre réponse - ${payload.campaign_title}`,
      html: emailHtml,
      from_name: payload.tenant_name,
    };

    console.log("Confirmation email prepared successfully", {
      to: emailData.to,
      subject: emailData.subject,
      status: payload.status,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Confirmation email queued",
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
    console.error("Error sending confirmation:", error);

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

function generateConfirmationEmail(payload: ConfirmationPayload): string {
  const statusLabels = {
    yes: { text: 'Oui, je suis intéressé', color: '#10b981', bgColor: '#d1fae5' },
    maybe: { text: 'Peut-être', color: '#f59e0b', bgColor: '#fef3c7' },
    no: { text: 'Non, pas pour le moment', color: '#ef4444', bgColor: '#fee2e2' },
  };

  const statusInfo = statusLabels[payload.status];

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
                Confirmation de votre réponse
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Bonjour ${payload.sponsor_name},
              </p>

              <p style="margin: 0 0 30px; color: #475569; font-size: 15px; line-height: 1.6;">
                Nous accusons réception de votre réponse concernant l'opportunité de sponsoring suivante :
              </p>

              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin: 0 0 30px;">
                <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 20px; font-weight: 700;">
                  ${payload.campaign_title}
                </h2>

                <div style="background-color: ${statusInfo.bgColor}; border-left: 4px solid ${statusInfo.color}; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
                  <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">
                    Votre réponse :
                  </p>
                  <p style="margin: 8px 0 0; color: ${statusInfo.color}; font-size: 18px; font-weight: 700;">
                    ${statusInfo.text}
                  </p>
                </div>

                ${payload.status === 'yes' && payload.amount ? `
                <div style="background-color: #d1fae5; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
                  <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 600;">
                    Montant envisagé :
                  </p>
                  <p style="margin: 8px 0 0; color: #10b981; font-size: 24px; font-weight: 700;">
                    ${payload.amount.toLocaleString('fr-FR')}€
                  </p>
                </div>
                ` : ''}

                ${payload.comment ? `
                <div style="background-color: #e0f2fe; border-radius: 8px; padding: 16px;">
                  <p style="margin: 0 0 8px; color: #1e293b; font-size: 14px; font-weight: 600;">
                    Vos commentaires :
                  </p>
                  <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">
                    ${payload.comment}
                  </p>
                </div>
                ` : ''}
              </div>

              <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
                ${payload.status === 'yes'
                  ? 'Nous vous remercions vivement pour votre engagement. Notre équipe prendra contact avec vous très prochainement pour finaliser les détails de ce partenariat.'
                  : payload.status === 'maybe'
                  ? 'Nous vous remercions pour votre intérêt. Nous reviendrons vers vous avec plus d\'informations qui pourraient vous aider dans votre décision.'
                  : 'Nous vous remercions d\'avoir pris le temps d\'examiner cette opportunité. N\'hésitez pas à nous recontacter si vous changez d\'avis ou pour de futures opportunités.'
                }
              </p>

              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                Cet email est une copie de confirmation pour vos dossiers. Si vous avez des questions, n'hésitez pas à nous contacter.
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
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
