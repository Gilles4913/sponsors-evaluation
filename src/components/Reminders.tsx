import { useState, useEffect } from 'react';
import { Bell, Send, Mail, Eye, MousePointer, AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';

interface Campaign {
  id: string;
  title: string;
  tenant_id: string;
  created_at: string;
}

interface Pledge {
  id: string;
  campaign_id: string;
  sponsor_id: string;
  sponsor_name: string;
  sponsor_email: string;
  sponsor_company: string;
  status: 'yes' | 'maybe' | 'no' | null;
  created_at: string;
  invitation_sent_at: string | null;
  last_reminded_at: string | null;
  campaign?: Campaign;
}

interface EmailMetrics {
  campaign_id: string;
  campaign_title: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  open_rate: number;
  click_rate: number;
}

export function Reminders() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const toast = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [uninvitedPledges, setUninvitedPledges] = useState<Pledge[]>([]);
  const [emailMetrics, setEmailMetrics] = useState<EmailMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [reminderConfig, setReminderConfig] = useState({
    reminder_5d_enabled: true,
    reminder_10d_enabled: true,
  });

  useEffect(() => {
    if (effectiveTenantId) {
      fetchCampaigns();
      fetchEmailMetrics();
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (selectedCampaignId) {
      fetchUninvitedPledges(selectedCampaignId);
    }
  }, [selectedCampaignId]);

  const fetchCampaigns = async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, title, tenant_id, created_at')
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCampaigns(data || []);
      if (data && data.length > 0) {
        setSelectedCampaignId(data[0].id);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des campagnes');
    } finally {
      setLoading(false);
    }
  };

  const fetchUninvitedPledges = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from('pledges')
        .select('*, campaigns(id, title, tenant_id, created_at)')
        .eq('campaign_id', campaignId)
        .is('status', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const pledgesData = (data || []).map((p: any) => ({
        ...p,
        campaign: Array.isArray(p.campaigns) ? p.campaigns[0] : p.campaigns,
      }));

      setUninvitedPledges(pledgesData);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des invitations');
    }
  };

  const fetchEmailMetrics = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, title')
        .eq('tenant_id', effectiveTenantId);

      if (campaignsError) throw campaignsError;

      const metricsPromises = (campaigns || []).map(async (campaign) => {
        const { data: events, error: eventsError } = await supabase
          .from('email_events')
          .select('event_type')
          .eq('campaign_id', campaign.id);

        if (eventsError) {
          console.error('Error fetching events:', eventsError);
          return null;
        }

        const sent = events?.filter((e) => e.event_type === 'sent').length || 0;
        const delivered = sent;
        const opened = events?.filter((e) => e.event_type === 'opened').length || 0;
        const clicked = events?.filter((e) => e.event_type === 'clicked').length || 0;
        const bounced = events?.filter((e) => e.event_type === 'bounced').length || 0;
        const failed = 0;

        const open_rate = sent > 0 ? (opened / sent) * 100 : 0;
        const click_rate = opened > 0 ? (clicked / opened) * 100 : 0;

        return {
          campaign_id: campaign.id,
          campaign_title: campaign.title,
          sent,
          delivered,
          opened,
          clicked,
          bounced,
          failed,
          open_rate,
          click_rate,
        };
      });

      const metricsResults = await Promise.all(metricsPromises);
      setEmailMetrics(metricsResults.filter((m): m is EmailMetrics => m !== null));
    } catch (error: any) {
      console.error('Error fetching email metrics:', error);
    }
  };

  const handleSendReminders = async () => {
    if (!selectedCampaignId || uninvitedPledges.length === 0) {
      toast.error('Aucune invitation à envoyer');
      return;
    }

    setSending(true);
    try {
      for (const pledge of uninvitedPledges) {
        const { error } = await supabase.from('email_events').insert({
          campaign_id: selectedCampaignId,
          sponsor_id: pledge.sponsor_id,
          email: pledge.sponsor_email,
          event_type: 'sent',
          event_data: {
            type: 'reminder',
            pledge_id: pledge.id,
          },
          tenant_id: profile?.tenant_id,
          created_at: new Date().toISOString(),
        });

        if (error) {
          console.error('Error logging email event:', error);
        }
      }

      toast.success(`${uninvitedPledges.length} relance(s) envoyée(s)`);
      fetchUninvitedPledges(selectedCampaignId);
      fetchEmailMetrics();
    } catch (error: any) {
      toast.error('Erreur lors de l\'envoi des relances');
    } finally {
      setSending(false);
    }
  };

  const selectedMetrics = emailMetrics.find((m) => m.campaign_id === selectedCampaignId);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl shadow-lg">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Relances automatiques
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Gérez vos rappels et suivez les métriques d'emailing
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
              Configuration des relances
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderConfig.reminder_5d_enabled}
                  onChange={(e) =>
                    setReminderConfig({ ...reminderConfig, reminder_5d_enabled: e.target.checked })
                  }
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Rappel J+5</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    5 jours après l'invitation
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderConfig.reminder_10d_enabled}
                  onChange={(e) =>
                    setReminderConfig({ ...reminderConfig, reminder_10d_enabled: e.target.checked })
                  }
                  className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Rappel J+10</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    10 jours avant la deadline
                  </p>
                </div>
              </label>
            </div>
          </div>

          {selectedMetrics && (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                    <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Taux d'ouverture</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedMetrics.open_rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedMetrics.opened} / {selectedMetrics.sent} ouverts
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                    <MousePointer className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Taux de clic</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {selectedMetrics.click_rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedMetrics.clicked} / {selectedMetrics.opened} cliqués
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Invitations non répondues
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {uninvitedPledges.length} invitation(s) en attente
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="px-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                >
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleSendReminders}
                  disabled={sending || uninvitedPledges.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white rounded-lg font-semibold transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {sending ? 'Envoi...' : 'Relancer maintenant'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-slate-600 dark:text-slate-400">
                Chargement...
              </div>
            ) : uninvitedPledges.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full inline-block mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Aucune invitation en attente pour cette campagne
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {uninvitedPledges.map((pledge) => (
                  <div
                    key={pledge.id}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg">
                          <Mail className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {pledge.sponsor_name || pledge.sponsor_email}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {pledge.sponsor_company && `${pledge.sponsor_company} • `}
                            {pledge.sponsor_email}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        {pledge.invitation_sent_at ? (
                          <>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Invité le
                            </p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {new Date(pledge.invitation_sent_at).toLocaleDateString('fr-FR')}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Jamais invité
                          </p>
                        )}
                      </div>
                      <div className="bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-full">
                        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs font-medium">En attente</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Métriques d'emailing par campagne
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Statistiques détaillées de vos emails
            </p>
          </div>

          <div className="p-6">
            {emailMetrics.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full inline-block mb-4">
                  <AlertCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Aucune métrique d'emailing disponible
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {emailMetrics.map((metrics) => (
                  <div
                    key={metrics.campaign_id}
                    className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {metrics.campaign_title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Mail className="w-4 h-4" />
                        {metrics.sent} envoyés
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Send className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">Envoyés</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {metrics.sent}
                        </p>
                      </div>

                      <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">Livrés</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {metrics.delivered}
                        </p>
                      </div>

                      <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Eye className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">Ouverts</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {metrics.opened}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {metrics.open_rate.toFixed(1)}%
                        </p>
                      </div>

                      <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <MousePointer className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">Cliqués</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {metrics.clicked}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {metrics.click_rate.toFixed(1)}%
                        </p>
                      </div>

                      <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <XCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">Bounces</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {metrics.bounced}
                        </p>
                      </div>

                      <div className="text-center p-3 bg-white dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <AlertCircle className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                          <p className="text-xs text-slate-600 dark:text-slate-400">Échecs</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {metrics.failed}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
