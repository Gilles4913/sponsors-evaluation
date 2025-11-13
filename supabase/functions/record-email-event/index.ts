import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailEventWebhook {
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  email: string;
  invitation_token?: string;
  invitation_id?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
  webhook_signature?: string;
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

    const payload: EmailEventWebhook = await req.json();

    if (!payload.event_type || !payload.email) {
      throw new Error('event_type and email are required');
    }

    const validEventTypes = ['sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'];
    if (!validEventTypes.includes(payload.event_type)) {
      throw new Error(`Invalid event_type. Must be one of: ${validEventTypes.join(', ')}`);
    }

    let invitationId = payload.invitation_id;

    if (!invitationId && payload.invitation_token) {
      const { data: invitation } = await supabaseClient
        .from('invitations')
        .select('id, campaign_id, sponsor_id, tenant_id')
        .eq('token', payload.invitation_token)
        .single();

      if (invitation) {
        invitationId = invitation.id;
      }
    }

    if (!invitationId && payload.email) {
      const { data: invitation } = await supabaseClient
        .from('invitations')
        .select('id, campaign_id, sponsor_id, tenant_id')
        .eq('email', payload.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (invitation) {
        invitationId = invitation.id;
      }
    }

    if (!invitationId) {
      console.warn('No invitation found for email event:', payload.email);
      return new Response(
        JSON.stringify({ warning: 'No invitation found', processed: false }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          status: 200,
        }
      );
    }

    const { data: invitation } = await supabaseClient
      .from('invitations')
      .select('*, campaigns(tenant_id)')
      .eq('id', invitationId)
      .single();

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    const emailEventData = {
      invitation_id: invitationId,
      campaign_id: invitation.campaign_id,
      sponsor_id: invitation.sponsor_id,
      email: payload.email,
      tenant_id: invitation.campaigns?.tenant_id,
      event_type: payload.event_type === 'delivered' ? 'sent' : 
                  payload.event_type === 'complained' ? 'bounced' : 
                  payload.event_type,
      event_data: {
        timestamp: payload.timestamp || new Date().toISOString(),
        metadata: payload.metadata || {},
        original_event: payload.event_type,
      },
    };

    const { error: eventError } = await supabaseClient
      .from('email_events')
      .insert(emailEventData);

    if (eventError) {
      throw new Error('Failed to record email event: ' + eventError.message);
    }

    const statusMap: Record<string, string> = {
      'opened': 'opened',
      'clicked': 'clicked',
      'bounced': 'bounced',
      'complained': 'bounced',
    };

    const newStatus = statusMap[payload.event_type];
    if (newStatus && invitation.status === 'sent') {
      await supabaseClient
        .from('invitations')
        .update({ status: newStatus })
        .eq('id', invitationId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_recorded: true,
        invitation_id: invitationId,
        event_type: payload.event_type,
      }),
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
