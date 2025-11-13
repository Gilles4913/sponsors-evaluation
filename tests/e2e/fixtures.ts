import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

interface TestFixtures {
  tenant: Database['public']['Tables']['tenants']['Row'];
  user: Database['public']['Tables']['users']['Row'];
  campaign: Database['public']['Tables']['campaigns']['Row'];
  sponsor: Database['public']['Tables']['sponsors']['Row'];
  invitation: Database['public']['Tables']['invitations']['Row'];
}

export async function createTestFixtures(): Promise<TestFixtures> {
  const tenantName = `Test Tenant ${Date.now()}`;
  const userEmail = `test-${Date.now()}@example.com`;
  const sponsorEmail = `sponsor-${Date.now()}@example.com`;
  const token = `test_token_${Date.now()}`;

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: tenantName,
      billing_email: userEmail,
      max_campaigns: 10,
      max_invitations_per_month: 1000,
    })
    .select()
    .single();

  if (tenantError) throw new Error(`Failed to create tenant: ${tenantError.message}`);

  const { data: authUser } = await supabase.auth.signUp({
    email: userEmail,
    password: 'TestPassword123!',
  });

  if (!authUser.user) throw new Error('Failed to create auth user');

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      id: authUser.user.id,
      email: userEmail,
      name: 'Test User',
      tenant_id: tenant.id,
      role: 'club_admin',
    })
    .select()
    .single();

  if (userError) throw new Error(`Failed to create user: ${userError.message}`);

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      tenant_id: tenant.id,
      title: 'Test Campaign',
      screen_type: 'led_ext',
      location: 'Test Location',
      annual_price_hint: 5000,
      objective_amount: 10000,
      daily_footfall_estimate: 500,
      lighting_hours: 12,
      description_md: 'Test campaign description',
      is_public_share_enabled: false,
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (campaignError) throw new Error(`Failed to create campaign: ${campaignError.message}`);

  const { data: sponsor, error: sponsorError } = await supabase
    .from('sponsors')
    .insert({
      tenant_id: tenant.id,
      company: 'Test Company',
      contact_name: 'Test Contact',
      email: sponsorEmail,
      phone: '+33123456789',
      segment: 'or',
      notes: 'Test sponsor notes',
    })
    .select()
    .single();

  if (sponsorError) throw new Error(`Failed to create sponsor: ${sponsorError.message}`);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error: invitationError } = await supabase
    .from('invitations')
    .insert({
      campaign_id: campaign.id,
      sponsor_id: sponsor.id,
      email: sponsorEmail,
      token: token,
      status: 'sent',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (invitationError) throw new Error(`Failed to create invitation: ${invitationError.message}`);

  return {
    tenant,
    user,
    campaign,
    sponsor,
    invitation,
  };
}

export async function cleanupTestFixtures(fixtures: Partial<TestFixtures>) {
  if (fixtures.invitation?.id) {
    await supabase.from('invitations').delete().eq('id', fixtures.invitation.id);
  }

  if (fixtures.sponsor?.id) {
    await supabase.from('sponsors').delete().eq('id', fixtures.sponsor.id);
  }

  if (fixtures.campaign?.id) {
    await supabase.from('campaigns').delete().eq('id', fixtures.campaign.id);
  }

  if (fixtures.user?.id) {
    await supabase.from('users').delete().eq('id', fixtures.user.id);
  }

  if (fixtures.tenant?.id) {
    await supabase.from('tenants').delete().eq('id', fixtures.tenant.id);
  }

  if (fixtures.user?.id) {
    await supabase.auth.admin.deleteUser(fixtures.user.id);
  }
}

export async function createMinimalFixtures() {
  const tenantName = `Minimal Tenant ${Date.now()}`;
  const sponsorEmail = `sponsor-${Date.now()}@example.com`;
  const token = `token_${Date.now()}`;

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: tenantName,
      billing_email: `billing-${Date.now()}@example.com`,
      max_campaigns: 10,
      max_invitations_per_month: 1000,
    })
    .select()
    .single();

  if (tenantError) throw new Error(`Failed to create tenant: ${tenantError.message}`);

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      tenant_id: tenant.id,
      title: 'Minimal Campaign',
      screen_type: 'led_ext',
      location: 'Test Location',
      annual_price_hint: 3000,
      objective_amount: 5000,
      description_md: 'Minimal test campaign',
    })
    .select()
    .single();

  if (campaignError) throw new Error(`Failed to create campaign: ${campaignError.message}`);

  const { data: sponsor, error: sponsorError } = await supabase
    .from('sponsors')
    .insert({
      tenant_id: tenant.id,
      company: 'Minimal Company',
      contact_name: 'Minimal Contact',
      email: sponsorEmail,
      segment: 'bronze',
    })
    .select()
    .single();

  if (sponsorError) throw new Error(`Failed to create sponsor: ${sponsorError.message}`);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error: invitationError } = await supabase
    .from('invitations')
    .insert({
      campaign_id: campaign.id,
      sponsor_id: sponsor.id,
      email: sponsorEmail,
      token: token,
      status: 'sent',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (invitationError) throw new Error(`Failed to create invitation: ${invitationError.message}`);

  return {
    tenant,
    campaign,
    sponsor,
    invitation,
    token,
  };
}

export async function getPledgesByInvitation(invitationId: string) {
  const { data, error } = await supabase
    .from('pledges')
    .select('*')
    .eq('invitation_id', invitationId);

  if (error) throw new Error(`Failed to get pledges: ${error.message}`);
  return data;
}

export async function getCampaignStats(campaignId: string) {
  const { data: pledges, error } = await supabase
    .from('pledges')
    .select('amount, status')
    .eq('campaign_id', campaignId);

  if (error) throw new Error(`Failed to get campaign stats: ${error.message}`);

  const totalPledged = pledges?.reduce((sum, p) => {
    if (p.status === 'yes') {
      return sum + (p.amount || 0);
    }
    return sum;
  }, 0) || 0;

  const yesCount = pledges?.filter((p) => p.status === 'yes').length || 0;
  const maybeCount = pledges?.filter((p) => p.status === 'maybe').length || 0;
  const noCount = pledges?.filter((p) => p.status === 'no').length || 0;

  return {
    totalPledges: pledges?.length || 0,
    totalPledged,
    yesCount,
    maybeCount,
    noCount,
  };
}
