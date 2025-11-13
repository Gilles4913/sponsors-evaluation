import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScheduledJob {
  id: string;
  tenant_id: string;
  campaign_id: string;
  job_type: string;
  payload: {
    sponsors: Array<{
      id: string;
      email: string;
      company: string;
      contact_name: string;
    }>;
    campaignId: string;
    campaignData: {
      title: string;
      location: string;
      description?: string;
      price?: number;
      footfall?: number;
    };
    reminderSettings?: {
      enabled: boolean;
      days: number[];
    } | null;
  };
}

interface TenantData {
  id: string;
  name: string;
  email_signature_html?: string;
  rgpd_content_md?: string;
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

function generateEmailHTML(
  sponsor: any,
  campaign: any,
  responseUrl: string,
  tenant?: TenantData
): string {
  let emailHtml = `
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
                Bonjour ${sponsor.contact_name},
              </p>

              <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
                Nous avons le plaisir de vous présenter notre nouvelle opportunité de sponsoring :
              </p>

              <div style="background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin: 0 0 30px;">
                <h2 style="margin: 0 0 16px; color: #1e293b; font-size: 22px; font-weight: 700;">
                  ${campaign.title}
                </h2>
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                  <strong style="color: #1e293b;">Localisation :</strong> ${campaign.location}
                </p>
                ${campaign.footfall ? `
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                  <strong style="color: #1e293b;">Visibilité :</strong> ${campaign.footfall.toLocaleString()} personnes/jour
                </p>
                ` : ''}
                ${campaign.price ? `
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                  <strong style="color: #1e293b;">Tarif indicatif :</strong> ${campaign.price.toLocaleString()}€/an
                </p>
                ` : ''}
                ${campaign.description ? `
                <p style="margin: 12px 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  ${campaign.description.substring(0, 200)}${campaign.description.length > 200 ? '...' : ''}
                </p>
                ` : ''}
              </div>

              <p style="margin: 0 0 30px; color: #475569; font-size: 15px; line-height: 1.6;">
                Nous serions ravis de compter ${sponsor.company} parmi nos partenaires.
                Merci de nous faire part de votre intérêt en cliquant sur le lien ci-dessous :
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${responseUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
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

  return emailHtml;
}

async function processJob(job: ScheduledJob, supabase: any): Promise<{ success: boolean; error?: string }> {
  console.log(`Processing job ${job.id} - Type: ${job.job_type}`);

  try {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, email_signature_html, rgpd_content_md')
      .eq('id', job.tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      throw new Error(`Tenant not found: ${tenantError?.message}`);
    }

    const sponsors = job.payload.sponsors;
    const campaignData = job.payload.campaignData;
    let successCount = 0;
    let errorCount = 0;

    for (const sponsor of sponsors) {
      try {
        const token = `inv_${crypto.randomUUID()}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const responseUrl = `${Deno.env.get('SUPABASE_URL')?.replace('https://', 'https://').replace('.supabase.co', '.supabase.co')}/respond/${token}`;

        const { data: invitation, error: inviteError } = await supabase
          .from('invitations')
          .insert({
            campaign_id: job.campaign_id,
            sponsor_id: sponsor.id,
            email: sponsor.email,
            token: token,
            status: 'sent',
            expires_at: expiresAt,
          })
          .select()
          .maybeSingle();

        if (inviteError) {
          console.error(`Error creating invitation for ${sponsor.email}:`, inviteError);
          errorCount++;
          
          await supabase.from('email_events').insert({
            invitation_id: null,
            event_type: 'bounced',
            event_data: {
              error: inviteError.message,
              sponsor_email: sponsor.email,
              job_id: job.id,
              failure_reason: 'invitation_creation_error',
            },
          });
          continue;
        }

        const emailHtml = generateEmailHTML(
          sponsor,
          campaignData,
          responseUrl,
          tenant
        );

        console.log(`Sending email to ${sponsor.email} for campaign ${campaignData.title}`);

        await supabase.from('email_events').insert({
          invitation_id: invitation.id,
          event_type: 'sent',
          event_data: {
            to: sponsor.email,
            subject: `Invitation - ${campaignData.title}`,
            campaign_title: campaignData.title,
            job_id: job.id,
          },
        });

        successCount++;

        if (job.payload.reminderSettings?.enabled && job.payload.reminderSettings.days) {
          for (const days of job.payload.reminderSettings.days) {
            const reminderDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
            await supabase.from('reminders').insert({
              invitation_id: invitation.id,
              scheduled_for: reminderDate.toISOString(),
              status: 'pending',
            });
          }
        }
      } catch (sponsorError: any) {
        console.error(`Error processing sponsor ${sponsor.email}:`, sponsorError);
        errorCount++;
        
        await supabase.from('email_events').insert({
          invitation_id: null,
          event_type: 'bounced',
          event_data: {
            error: sponsorError.message,
            failure_reason: 'sponsor_fetch_error',
            sponsor_email: sponsor.email,
            job_id: job.id,
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`Job ${job.id} completed: ${successCount} success, ${errorCount} errors`);

    return {
      success: successCount > 0,
      error: errorCount > 0 ? `${errorCount} errors occurred` : undefined,
    };
  } catch (error: any) {
    console.error(`Error processing job ${job.id}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
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

    console.log('Job runner started - Checking for pending jobs...');

    const { data: jobs, error: jobsError } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (jobsError) {
      throw new Error(`Error fetching jobs: ${jobsError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      console.log('No pending jobs found');
      return new Response(
        JSON.stringify({ message: 'No pending jobs', processed: 0 }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`Found ${jobs.length} pending job(s)`);

    const results = [];

    for (const job of jobs) {
      await supabase
        .from('scheduled_jobs')
        .update({ status: 'processing' })
        .eq('id', job.id);

      const result = await processJob(job as ScheduledJob, supabase);

      const finalStatus = result.success ? 'completed' : 'failed';
      await supabase
        .from('scheduled_jobs')
        .update({
          status: finalStatus,
          executed_at: new Date().toISOString(),
          error_message: result.error || null,
        })
        .eq('id', job.id);

      results.push({
        job_id: job.id,
        status: finalStatus,
        error: result.error,
      });
    }

    console.log(`Processed ${results.length} job(s)`);

    return new Response(
      JSON.stringify({
        message: 'Jobs processed',
        processed: results.length,
        results: results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in job runner:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
