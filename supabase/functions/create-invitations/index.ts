import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface InvitationRequest {
  campaign_id: string;
  sponsor_ids: string[];
  expires_in_days?: number;
  send_emails?: boolean;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { campaign_id, sponsor_ids, expires_in_days = 30, send_emails = true }: InvitationRequest = await req.json();

    if (!campaign_id || !sponsor_ids || sponsor_ids.length === 0) {
      throw new Error('campaign_id and sponsor_ids are required');
    }

    const { data: campaign, error: campaignError } = await supabaseClient
      .from('campaigns')
      .select('*, tenants(*)')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    const { data: sponsors, error: sponsorsError } = await supabaseClient
      .from('sponsors')
      .select('*')
      .in('id', sponsor_ids);

    if (sponsorsError || !sponsors || sponsors.length === 0) {
      throw new Error('Sponsors not found');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    const invitations = sponsors.map((sponsor) => ({
      campaign_id: campaign.id,
      sponsor_id: sponsor.id,
      email: sponsor.email,
      token: crypto.randomUUID(),
      status: 'sent',
      expires_at: expiresAt.toISOString(),
    }));

    const { data: createdInvitations, error: invitationError } = await supabaseClient
      .from('invitations')
      .insert(invitations)
      .select();

    if (invitationError) {
      throw new Error('Failed to create invitations: ' + invitationError.message);
    }

    const results = {
      created: createdInvitations.length,
      invitations: createdInvitations,
      emails_sent: 0,
      errors: [] as string[],
    };

    if (send_emails) {
      const { data: template } = await supabaseClient
        .from('email_templates')
        .select('*')
        .eq('type', 'invitation')
        .eq('is_active', true)
        .single();

      if (template) {
        for (const invitation of createdInvitations) {
          try {
            const sponsor = sponsors.find(s => s.id === invitation.sponsor_id);
            if (!sponsor) continue;

            const responseUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '')}/response/${invitation.token}`;

            let emailHtml = template.html_body
              .replace(/{{sponsor_name}}/g, sponsor.contact_name)
              .replace(/{{campaign_title}}/g, campaign.title)
              .replace(/{{tenant_name}}/g, campaign.tenants?.name || '')
              .replace(/{{response_url}}/g, responseUrl)
              .replace(/{{deadline}}/g, campaign.deadline || 'Non définie');

            let emailText = template.text_body
              .replace(/{{sponsor_name}}/g, sponsor.contact_name)
              .replace(/{{campaign_title}}/g, campaign.title)
              .replace(/{{tenant_name}}/g, campaign.tenants?.name || '')
              .replace(/{{response_url}}/g, responseUrl)
              .replace(/{{deadline}}/g, campaign.deadline || 'Non définie');

            let subject = template.subject
              .replace(/{{campaign_title}}/g, campaign.title)
              .replace(/{{tenant_name}}/g, campaign.tenants?.name || '');

            console.log(`Would send email to ${sponsor.email}:`, { subject, responseUrl });

            await supabaseClient.from('email_events').insert({
              invitation_id: invitation.id,
              campaign_id: campaign.id,
              sponsor_id: sponsor.id,
              email: sponsor.email,
              tenant_id: campaign.tenant_id,
              event_type: 'sent',
              event_data: { subject, to: sponsor.email },
            });

            results.emails_sent++;
          } catch (emailError: any) {
            console.error('Email send error:', emailError);
            results.errors.push(`Failed to send email to ${invitation.email}: ${emailError.message}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify(results),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      }
    );
  }
});
