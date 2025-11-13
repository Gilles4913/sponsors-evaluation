import { useState, useEffect } from 'react';
import { X, Mail, Send, Clock, CheckCircle2, AlertCircle, Loader2, Eye, Calendar, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { highlightText } from '../lib/highlightHelper';
import type { Database } from '../lib/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Sponsor = Database['public']['Tables']['sponsors']['Row'];

interface InviteModalProps {
  sponsors: Sponsor[];
  campaigns: Campaign[];
  onClose: () => void;
  onSuccess: () => void;
}

interface SendingState {
  status: 'idle' | 'sending' | 'success' | 'error';
  current: number;
  total: number;
  message: string;
}

export function InviteModal({ sponsors, campaigns, onClose, onSuccess }: InviteModalProps) {
  const toast = useToast();
  const { profile } = useAuth();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSponsorIds, setSelectedSponsorIds] = useState<string[]>(sponsors.map(s => s.id));
  const [sendingState, setSendingState] = useState<SendingState>({
    status: 'idle',
    current: 0,
    total: 0,
    message: '',
  });

  const [scheduleSettings, setScheduleSettings] = useState({
    enableScheduling: false,
    scheduledDate: '',
    scheduledTime: '',
  });

  const [reminderSettings, setReminderSettings] = useState({
    enableReminders: false,
    reminderDays: [5, 10],
  });

  useEffect(() => {
    if (selectedCampaign) {
      const selectedCampaignData = campaigns.find((c) => c.id === selectedCampaign);
      setCampaign(selectedCampaignData || null);
    } else {
      setCampaign(null);
    }
  }, [selectedCampaign, campaigns]);

  const generateEmailPreview = () => {
    if (!campaign) return '';

    const sponsor = sponsors[0];
    const exampleLink = `${window.location.origin}/respond/EXAMPLE-TOKEN-123`;

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
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                Opportunité de sponsoring
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Bonjour ${sponsor?.contact_name || 'Cher partenaire'},
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
                ${campaign.daily_footfall_estimate ? `
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                  <strong style="color: #1e293b;">Visibilité :</strong> ${campaign.daily_footfall_estimate.toLocaleString()} personnes/jour
                </p>
                ` : ''}
                ${campaign.annual_price_hint ? `
                <p style="margin: 0 0 12px; color: #475569; font-size: 14px;">
                  <strong style="color: #1e293b;">Tarif indicatif :</strong> ${campaign.annual_price_hint.toLocaleString()}€/an
                </p>
                ` : ''}
                ${campaign.description_md ? `
                <p style="margin: 12px 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                  ${campaign.description_md.substring(0, 200)}${campaign.description_md.length > 200 ? '...' : ''}
                </p>
                ` : ''}
              </div>

              <p style="margin: 0 0 30px; color: #475569; font-size: 15px; line-height: 1.6;">
                Nous serions ravis de compter ${sponsor?.company || 'votre entreprise'} parmi nos partenaires.
                Merci de nous faire part de votre intérêt en cliquant sur le lien ci-dessous :
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${exampleLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
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

          <!-- Footer -->
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
  };

  const handleSendInvitations = async () => {
    if (!selectedCampaign) {
      toast.error('Veuillez sélectionner une campagne');
      return;
    }

    if (scheduleSettings.enableScheduling) {
      if (!scheduleSettings.scheduledDate || !scheduleSettings.scheduledTime) {
        toast.error('Veuillez sélectionner une date et une heure');
        return;
      }
      await handleScheduledInvitations();
      return;
    }

    setSendingState({
      status: 'sending',
      current: 0,
      total: selectedSponsors.length,
      message: 'Génération des invitations...',
    });

    try {
      const invitationsToCreate = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < selectedSponsors.length; i++) {
        const sponsor = selectedSponsors[i];

        setSendingState({
          status: 'sending',
          current: i + 1,
          total: selectedSponsors.length,
          message: `Envoi à ${sponsor.company}...`,
        });

        try {
          const token = `inv_${crypto.randomUUID()}`;
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const responseUrl = `${window.location.origin}/respond/${token}`;

          const { data: invitation, error: inviteError } = await supabase
            .from('invitations')
            .insert({
              campaign_id: selectedCampaign,
              sponsor_id: sponsor.id,
              email: sponsor.email,
              token: token,
              status: 'sent',
              expires_at: expiresAt,
            })
            .select()
            .single();

          if (inviteError) throw inviteError;

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`;
          const emailResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              invitation_id: invitation.id,
              sponsor_email: sponsor.email,
              sponsor_name: sponsor.contact_name,
              sponsor_company: sponsor.company,
              campaign_title: campaign?.title,
              campaign_location: campaign?.location,
              campaign_description: campaign?.description_md,
              campaign_price: campaign?.annual_price_hint,
              campaign_footfall: campaign?.daily_footfall_estimate,
              response_url: responseUrl,
            }),
          });

          if (!emailResponse.ok) {
            console.error('Email send failed:', await emailResponse.text());
            errorCount++;
          } else {
            successCount++;
            invitationsToCreate.push(invitation);
          }

          if (reminderSettings.enableReminders) {
            for (const days of reminderSettings.reminderDays) {
              const reminderDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
              await supabase.from('reminders').insert({
                invitation_id: invitation.id,
                scheduled_for: reminderDate.toISOString(),
                status: 'pending',
              });
            }
          }
        } catch (error) {
          console.error(`Error sending to ${sponsor.email}:`, error);
          errorCount++;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (successCount > 0) {
        setSendingState({
          status: 'success',
          current: selectedSponsors.length,
          total: selectedSponsors.length,
          message: `${successCount} invitation(s) envoyée(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`,
        });
        toast.success(`${successCount} invitation(s) envoyée(s)`);
        if (errorCount > 0) {
          toast.error(`${errorCount} erreur(s) lors de l'envoi`);
        }
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        throw new Error('Aucune invitation n\'a pu être envoyée');
      }
    } catch (error: any) {
      setSendingState({
        status: 'error',
        current: 0,
        total: selectedSponsors.length,
        message: error.message || 'Une erreur est survenue',
      });
      toast.error('Erreur lors de l\'envoi: ' + error.message);
    }
  };

  const handleScheduledInvitations = async () => {
    if (!profile?.tenant_id) {
      toast.error('Tenant ID manquant');
      return;
    }

    try {
      const scheduledDateTime = new Date(`${scheduleSettings.scheduledDate}T${scheduleSettings.scheduledTime}:00`);
      const parisTime = new Date(scheduledDateTime.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));

      const payload = {
        sponsors: selectedSponsors.map(s => ({
          id: s.id,
          email: s.email,
          company: s.company,
          contact_name: s.contact_name
        })),
        campaignId: selectedCampaign,
        campaignData: {
          title: campaign?.title,
          location: campaign?.location,
          description: campaign?.description_md,
          price: campaign?.annual_price_hint,
          footfall: campaign?.daily_footfall_estimate
        },
        reminderSettings: reminderSettings.enableReminders ? {
          enabled: true,
          days: reminderSettings.reminderDays
        } : null
      };

      const { error } = await supabase
        .from('scheduled_jobs')
        .insert({
          tenant_id: profile.tenant_id,
          campaign_id: selectedCampaign,
          job_type: 'email_invitation',
          scheduled_at: parisTime.toISOString(),
          status: 'pending',
          payload: payload,
          created_by: profile.id
        });

      if (error) throw error;

      toast.success(`Envoi planifié pour le ${scheduledDateTime.toLocaleDateString('fr-FR')} à ${scheduleSettings.scheduledTime}`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      toast.error('Erreur lors de la planification: ' + error.message);
    }
  };

  const toggleReminderDay = (day: number) => {
    setReminderSettings((prev) => ({
      ...prev,
      reminderDays: prev.reminderDays.includes(day)
        ? prev.reminderDays.filter((d) => d !== day)
        : [...prev.reminderDays, day].sort((a, b) => a - b),
    }));
  };

  const filteredSponsors = sponsors.filter((sponsor) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sponsor.company.toLowerCase().includes(search) ||
      sponsor.contact_name.toLowerCase().includes(search) ||
      sponsor.email.toLowerCase().includes(search)
    );
  });

  const selectedSponsors = sponsors.filter(s => selectedSponsorIds.includes(s.id));

  const toggleSponsor = (sponsorId: string) => {
    setSelectedSponsorIds(prev =>
      prev.includes(sponsorId)
        ? prev.filter(id => id !== sponsorId)
        : [...prev, sponsorId]
    );
  };

  const toggleAll = () => {
    if (selectedSponsorIds.length === filteredSponsors.length) {
      const filteredIds = filteredSponsors.map(s => s.id);
      setSelectedSponsorIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const allFilteredIds = filteredSponsors.map(s => s.id);
      setSelectedSponsorIds(prev => [...new Set([...prev, ...allFilteredIds])]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Envoyer des invitations
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {selectedSponsors.length} sponsor(s) sélectionné(s)
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={sendingState.status === 'sending'}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Rechercher des sponsors
            </label>
            <div className="relative" role="search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom, entreprise ou email..."
                className="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                aria-label="Rechercher un sponsor"
                data-testid="invite-search"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg max-h-64 overflow-y-auto">
            <div className="sticky top-0 bg-slate-50 dark:bg-slate-700/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <input
                type="checkbox"
                checked={filteredSponsors.length > 0 && filteredSponsors.every(s => selectedSponsorIds.includes(s.id))}
                onChange={toggleAll}
                className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Tout sélectionner ({filteredSponsors.length})
              </span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredSponsors.map((sponsor) => (
                <label
                  key={sponsor.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSponsorIds.includes(sponsor.id)}
                    onChange={() => toggleSponsor(sponsor.id)}
                    className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {highlightText(sponsor.company, searchTerm)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {highlightText(sponsor.contact_name, searchTerm)} · {highlightText(sponsor.email, searchTerm)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Campagne *
            </label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              disabled={sendingState.status === 'sending'}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
              data-testid="invite-campaign-select"
            >
              <option value="">Sélectionner une campagne</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
          </div>

          {campaign && (
            <>
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  Détails de la campagne
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Localisation:</span> {campaign.location}
                  </p>
                  {campaign.annual_price_hint && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Tarif indicatif:</span>{' '}
                      {campaign.annual_price_hint.toLocaleString()}€/an
                    </p>
                  )}
                  {campaign.daily_footfall_estimate && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Visibilité:</span>{' '}
                      {campaign.daily_footfall_estimate.toLocaleString()} personnes/jour
                    </p>
                  )}
                </div>
              </div>

              <div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Masquer l\'aperçu' : 'Voir l\'aperçu de l\'email'}
                </button>

                {showPreview && (
                  <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Aperçu de l'email
                      </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 max-h-96 overflow-y-auto">
                      <iframe
                        srcDoc={generateEmailPreview()}
                        className="w-full h-96 border-0"
                        title="Aperçu email"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                    <input
                      type="checkbox"
                      checked={scheduleSettings.enableScheduling}
                      onChange={(e) =>
                        setScheduleSettings({ ...scheduleSettings, enableScheduling: e.target.checked })
                      }
                      disabled={sendingState.status === 'sending'}
                      className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                      data-testid="schedule-checkbox"
                    />
                    Planifier l'envoi
                  </label>
                </div>

                {scheduleSettings.enableScheduling && (
                  <div className="ml-6 space-y-3">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Sélectionnez la date et l'heure d'envoi (fuseau Europe/Paris) :
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={scheduleSettings.scheduledDate}
                          onChange={(e) =>
                            setScheduleSettings({ ...scheduleSettings, scheduledDate: e.target.value })
                          }
                          min={new Date().toISOString().split('T')[0]}
                          disabled={sendingState.status === 'sending'}
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Heure
                        </label>
                        <input
                          type="time"
                          value={scheduleSettings.scheduledTime}
                          onChange={(e) =>
                            setScheduleSettings({ ...scheduleSettings, scheduledTime: e.target.value })
                          }
                          disabled={sendingState.status === 'sending'}
                          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    {scheduleSettings.scheduledDate && scheduleSettings.scheduledTime && (
                      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Envoi prévu le {new Date(`${scheduleSettings.scheduledDate}T${scheduleSettings.scheduledTime}`).toLocaleDateString('fr-FR', { dateStyle: 'full' })} à {scheduleSettings.scheduledTime}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                    <input
                      type="checkbox"
                      checked={reminderSettings.enableReminders}
                      onChange={(e) =>
                        setReminderSettings({ ...reminderSettings, enableReminders: e.target.checked })
                      }
                      disabled={sendingState.status === 'sending'}
                      className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                    />
                    Planifier des relances automatiques
                  </label>
                </div>

                {reminderSettings.enableReminders && (
                  <div className="ml-6 space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      Sélectionnez les jours de relance après l'envoi initial :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[3, 5, 7, 10, 14].map((day) => (
                        <button
                          key={day}
                          onClick={() => toggleReminderDay(day)}
                          disabled={sendingState.status === 'sending'}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            reminderSettings.reminderDays.includes(day)
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-2 border-blue-500'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          J+{day}
                        </button>
                      ))}
                    </div>
                    {reminderSettings.reminderDays.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Relances programmées : {reminderSettings.reminderDays.map((d) => `J+${d}`).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {sendingState.status !== 'idle' && (
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                {sendingState.status === 'sending' && (
                  <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                )}
                {sendingState.status === 'success' && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                )}
                {sendingState.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {sendingState.message}
                  </p>
                  {sendingState.status === 'sending' && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {sendingState.current} / {sendingState.total}
                    </p>
                  )}
                </div>
              </div>
              {sendingState.status === 'sending' && (
                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                    style={{
                      width: `${(sendingState.current / sendingState.total) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex gap-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900 dark:text-amber-300">
                <p className="font-medium mb-1">Informations importantes</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Les sponsors recevront un email avec un lien unique</li>
                  <li>Le lien expire automatiquement dans 30 jours</li>
                  <li>Un token sécurisé est généré pour chaque invitation</li>
                  {reminderSettings.enableReminders && (
                    <li>Les relances seront envoyées automatiquement aux dates programmées</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sendingState.status === 'sending'}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium disabled:opacity-50"
          >
            {sendingState.status === 'success' ? 'Fermer' : 'Annuler'}
          </button>
          {sendingState.status !== 'success' && (
            <button
              onClick={handleSendInvitations}
              disabled={!selectedCampaign || selectedSponsors.length === 0 || sendingState.status === 'sending'}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              data-testid="send-invitations-button"
            >
              {sendingState.status === 'sending' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : scheduleSettings.enableScheduling ? (
                <>
                  <Calendar className="w-4 h-4" />
                  Planifier l'envoi
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Envoyer maintenant
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
