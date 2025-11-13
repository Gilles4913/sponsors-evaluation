import { useState, useEffect, useRef } from 'react';
import { Target, Plus, TrendingUp, Calendar, MapPin, Users, CheckCircle, Clock, XCircle, Calculator, QrCode, Share2, Download, Copy, FileText, FileDown, Bell, Settings } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';
import { ForecastPanel } from './ForecastPanel';
import { CampaignKPIs } from './CampaignKPIs';
import { exportToCsv, exportToPdfWithStorage } from '../lib/exportUtils';
import type { Database } from '../lib/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Pledge = Database['public']['Tables']['pledges']['Row'];

interface RecentPledge extends Pledge {
  campaign_name?: string;
  sponsor_name?: string;
}

interface CampaignWithStats extends Campaign {
  pledges_count?: number;
  total_pledged?: number;
  progress_percentage?: number;
  yes_count?: number;
  maybe_count?: number;
  no_count?: number;
}

const SCREEN_TYPE_LABELS = {
  led_ext: 'LED Extérieur',
  led_int: 'LED Intérieur',
  borne_ext: 'Borne Extérieur',
  borne_int_mobile: 'Borne Intérieur Mobile',
  ecran_int_fixe: 'Écran Intérieur Fixe',
};

export function ClubDashboard() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [recentPledges, setRecentPledges] = useState<RecentPledge[]>([]);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showForecast, setShowForecast] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [newCampaign, setNewCampaign] = useState({
    title: '',
    screen_type: 'led_ext' as keyof typeof SCREEN_TYPE_LABELS,
    location: '',
    annual_price_hint: '',
    objective_amount: '',
    daily_footfall_estimate: '',
    lighting_hours: { start: '08:00', end: '20:00' },
    cover_image_url: '',
    deadline: '',
    description_md: '',
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    if (!effectiveTenantId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('tenant_id', effectiveTenantId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const campaignsWithStats = await Promise.all(
        data.map(async (campaign) => {
          const { data: pledgesData } = await supabase
            .from('pledges')
            .select('amount, status')
            .eq('campaign_id', campaign.id);

          const totalPledged = pledgesData?.reduce((sum, p) => {
            if (p.status === 'yes') {
              return sum + (p.amount || 0);
            }
            return sum;
          }, 0) || 0;

          const yesCount = pledgesData?.filter(p => p.status === 'yes').length || 0;
          const maybeCount = pledgesData?.filter(p => p.status === 'maybe').length || 0;
          const noCount = pledgesData?.filter(p => p.status === 'no').length || 0;

          const progressPercentage = campaign.objective_amount > 0
            ? Math.round((totalPledged / campaign.objective_amount) * 100)
            : 0;

          return {
            ...campaign,
            pledges_count: pledgesData?.length || 0,
            total_pledged: totalPledged,
            progress_percentage: progressPercentage,
            yes_count: yesCount,
            maybe_count: maybeCount,
            no_count: noCount,
          };
        })
      );

      setCampaigns(campaignsWithStats);

      const campaignIds = data.map((c) => c.id);
      if (campaignIds.length > 0) {
        const { data: pledgesData } = await supabase
          .from('pledges')
          .select('*, campaigns!inner(title)')
          .in('campaign_id', campaignIds)
          .order('created_at', { ascending: false })
          .limit(20);

        if (pledgesData) {
          const pledgesWithCampaignName = pledgesData.map((pledge: any) => ({
            ...pledge,
            campaign_name: pledge.campaigns?.title || 'Campagne inconnue',
            sponsor_name: pledge.sponsor_name || pledge.sponsor_email,
          }));
          setRecentPledges(pledgesWithCampaignName);
        }
      }
    }
    setLoading(false);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveTenantId) {
      toast.error('Impossible de créer une campagne : tenant_id manquant');
      return;
    }

    try {
      const { error } = await supabase.from('campaigns').insert({
        tenant_id: effectiveTenantId,
        title: newCampaign.title,
        screen_type: newCampaign.screen_type,
        location: newCampaign.location,
        annual_price_hint: parseFloat(newCampaign.annual_price_hint) || 0,
        objective_amount: parseFloat(newCampaign.objective_amount) || 0,
        daily_footfall_estimate: parseInt(newCampaign.daily_footfall_estimate) || 0,
        lighting_hours: newCampaign.lighting_hours,
        cover_image_url: newCampaign.cover_image_url || null,
        deadline: newCampaign.deadline || null,
        description_md: newCampaign.description_md || null,
        is_public_share_enabled: false,
      });

      if (error) throw error;

      setNewCampaign({
        title: '',
        screen_type: 'led_ext',
        location: '',
        annual_price_hint: '',
        objective_amount: '',
        daily_footfall_estimate: '',
        lighting_hours: { start: '08:00', end: '20:00' },
        cover_image_url: '',
        deadline: '',
        description_md: '',
      });
      setShowCreateCampaign(false);
      fetchCampaigns();
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleEnablePublicShare = async (campaignId: string) => {
    const slug = `campaign-${Date.now()}`;

    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          is_public_share_enabled: true,
          public_slug: slug,
        })
        .eq('id', campaignId);

      if (error) throw error;

      await fetchCampaigns();
      handleShowQR(campaignId);
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleShowQR = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign?.public_slug) {
      await handleEnablePublicShare(campaignId);
      return;
    }

    const publicUrl = `${window.location.origin}/p/${campaign.public_slug}`;
    setQrCodeUrl(publicUrl);
    setShowQRModal(campaignId);

    setTimeout(async () => {
      if (qrCanvasRef.current) {
        try {
          await QRCode.toCanvas(qrCanvasRef.current, publicUrl, {
            width: 300,
            margin: 2,
            color: {
              dark: '#1e293b',
              light: '#ffffff',
            },
          });
        } catch (error) {
          console.error('QR Code generation error:', error);
        }
      }
    }, 100);
  };

  const handleDownloadQR = () => {
    if (qrCanvasRef.current) {
      const url = qrCanvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'qr-code-campagne.png';
      link.href = url;
      link.click();
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(qrCodeUrl);
    toast.success('URL copiée dans le presse-papier');
  };

  const handleExportAllPledges = async () => {
    if (!profile?.tenant_id) return;

    try {
      const campaignIds = campaigns.map((c) => c.id);
      const { data: pledges, error } = await supabase
        .from('pledges')
        .select('*, campaigns!inner(title)')
        .in('campaign_id', campaignIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (pledges && pledges.length > 0) {
        const csvData = pledges.map((p: any) => ({
          Campagne: p.campaigns?.title || '',
          Sponsor: p.sponsor_name || p.sponsor_email,
          Entreprise: p.sponsor_company || '',
          Email: p.sponsor_email,
          Téléphone: p.sponsor_phone || '',
          Montant: p.amount || 0,
          Statut: p.status === 'yes' ? 'Oui' : p.status === 'maybe' ? 'Peut-être' : 'Non',
          Date: new Date(p.created_at || '').toLocaleDateString('fr-FR'),
        }));

        const headers = Object.keys(csvData[0]);
        const csvContent = [
          headers.join(','),
          ...csvData.map((row) =>
            headers.map((header) => `"${row[header as keyof typeof row]}"`).join(',')
          ),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `promesses-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        toast.success('Export CSV terminé');
      } else {
        toast.info('Aucune promesse à exporter');
      }
    } catch (error: any) {
      toast.error('Erreur lors de l\'export: ' + error.message);
    }
  };

  const handleViewCampaignFromPledge = (campaignId: string) => {
    const campaignElement = document.getElementById(`campaign-${campaignId}`);
    if (campaignElement) {
      campaignElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      campaignElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50');
      setTimeout(() => {
        campaignElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50');
      }, 2000);
    }
  };

  const handleExportCsv = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    const { data: pledges } = await supabase
      .from('pledges')
      .select('*, sponsors(*)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (pledges) {
      exportToCsv(campaign, pledges);
    }
  };

  const handleExportPdf = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    const { data: pledges } = await supabase
      .from('pledges')
      .select('*, sponsors(*)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (pledges && profile?.tenant_id) {
      const stats = {
        total_pledged: campaign.total_pledged || 0,
        yes_count: campaign.yes_count || 0,
        maybe_count: campaign.maybe_count || 0,
        no_count: campaign.no_count || 0,
        progress_percentage: campaign.progress_percentage || 0,
      };

      toast.info('Génération du PDF en cours...');
      const result = await exportToPdfWithStorage(campaign, pledges, stats, profile.tenant_id);

      if (result.success) {
        toast.success('PDF généré et sauvegardé avec succès');
      } else {
        toast.error(result.error || 'Erreur lors de la génération du PDF');
      }
    }
  };

  return (
    <Layout>
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h2>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Vue d'ensemble de vos campagnes</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = '/settings'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition font-medium"
              >
                <Settings className="w-5 h-5" />
                <span>Paramètres</span>
              </button>
              <button
                onClick={() => window.location.href = '/reminders'}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition font-medium"
              >
                <Bell className="w-5 h-5" />
                <span>Relances</span>
              </button>
              <button
                onClick={() => setShowCreateCampaign(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition font-medium shadow-lg"
              >
                <Plus className="w-5 h-5" />
                <span>Nouvelle campagne</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Chargement...</div>
          ) : (
            <>
              <CampaignKPIs
                campaigns={campaigns}
                recentPledges={recentPledges}
                onExportCSV={handleExportAllPledges}
                onViewCampaign={handleViewCampaignFromPledge}
              />

              <div className="mt-8">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  Mes campagnes
                </h3>
              </div>
            </>
          )}

          {!loading && campaigns.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
              <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Aucune campagne
              </h3>
              <p className="text-slate-600 mb-6">
                Créez votre première campagne pour commencer à collecter des promesses
              </p>
              <button
                onClick={() => setShowCreateCampaign(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
              >
                <Plus className="w-5 h-5" />
                Créer une campagne
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  id={`campaign-${campaign.id}`}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition"
                >
                  {campaign.cover_image_url && (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={campaign.cover_image_url}
                        alt={campaign.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                          {campaign.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">
                            {SCREEN_TYPE_LABELS[campaign.screen_type]}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleShowQR(campaign.id)}
                          className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition"
                          title="Partager via QR code"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setShowForecast(campaign.id)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                          title="Ouvrir la simulation"
                        >
                          <Calculator className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                      <MapPin className="w-4 h-4" />
                      <span>{campaign.location}</span>
                    </div>

                    {campaign.deadline && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Échéance: {new Date(campaign.deadline).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <p className="text-xs font-medium text-slate-600 mb-1">
                              Objectif atteint à
                            </p>
                            <p className="text-3xl font-bold text-green-700">
                              {campaign.progress_percentage}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-600 mb-1">Promis / Objectif</p>
                            <p className="text-lg font-bold text-slate-900">
                              {(campaign.total_pledged || 0).toLocaleString('fr-FR')}€
                            </p>
                            <p className="text-xs text-slate-500">
                              sur {campaign.objective_amount.toLocaleString('fr-FR')}€
                            </p>
                          </div>
                        </div>

                        <div className="w-full bg-slate-200 rounded-full h-3 mb-3">
                          <div
                            className={`h-3 rounded-full transition-all ${
                              campaign.progress_percentage >= 100
                                ? 'bg-gradient-to-r from-green-500 to-green-600'
                                : 'bg-gradient-to-r from-green-600 to-blue-600'
                            }`}
                            style={{ width: `${Math.min(campaign.progress_percentage || 0, 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-1.5 text-green-700">
                            <CheckCircle className="w-4 h-4" />
                            <span className="font-semibold">{campaign.yes_count || 0} Oui</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-700">
                            <Clock className="w-4 h-4" />
                            <span className="font-semibold">{campaign.maybe_count || 0} Peut-être</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-red-700">
                            <XCircle className="w-4 h-4" />
                            <span className="font-semibold">{campaign.no_count || 0} Non</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-slate-200">
                        <button
                          onClick={() => handleExportCsv(campaign.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-sm font-medium"
                        >
                          <FileText className="w-4 h-4" />
                          CSV
                        </button>
                        <button
                          onClick={() => handleExportPdf(campaign.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-sm font-medium"
                        >
                          <FileDown className="w-4 h-4" />
                          PDF
                        </button>
                      </div>

                      {campaign.daily_footfall_estimate > 0 && (
                        <div className="pt-3 border-t border-slate-200">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <TrendingUp className="w-4 h-4" />
                            <span>
                              {campaign.daily_footfall_estimate.toLocaleString('fr-FR')} passages/jour
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {showCreateCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Créer une nouvelle campagne
            </h2>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Titre de la campagne
                  </label>
                  <input
                    type="text"
                    required
                    value={newCampaign.title}
                    onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Ex: Financement écran LED stade"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Type d'équipement
                  </label>
                  <select
                    value={newCampaign.screen_type}
                    onChange={(e) =>
                      setNewCampaign({
                        ...newCampaign,
                        screen_type: e.target.value as keyof typeof SCREEN_TYPE_LABELS,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    {Object.entries(SCREEN_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Localisation
                  </label>
                  <input
                    type="text"
                    required
                    value={newCampaign.location}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, location: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Ex: Entrée principale"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Prix indicatif annuel (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCampaign.annual_price_hint}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, annual_price_hint: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="15000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Objectif de financement (€)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newCampaign.objective_amount}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, objective_amount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="50000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Estimation passages/jour
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newCampaign.daily_footfall_estimate}
                    onChange={(e) =>
                      setNewCampaign({
                        ...newCampaign,
                        daily_footfall_estimate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="5000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date limite (optionnel)
                  </label>
                  <input
                    type="date"
                    value={newCampaign.deadline}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, deadline: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URL de l'image de couverture (optionnel)
                  </label>
                  <input
                    type="url"
                    value={newCampaign.cover_image_url}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, cover_image_url: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="https://exemple.com/image.jpg"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description (Markdown supporté)
                  </label>
                  <textarea
                    value={newCampaign.description_md}
                    onChange={(e) =>
                      setNewCampaign({ ...newCampaign, description_md: e.target.value })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                    placeholder="Décrivez votre projet..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateCampaign(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
                >
                  Créer la campagne
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForecast && (
        <ForecastPanel
          campaignId={showForecast}
          objectiveAmount={campaigns.find(c => c.id === showForecast)?.objective_amount || 0}
          currentPledged={campaigns.find(c => c.id === showForecast)?.total_pledged || 0}
          onClose={() => setShowForecast(null)}
        />
      )}

      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Share2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Partager la campagne
              </h2>
              <p className="text-slate-600 text-sm">
                Scannez ce QR code ou partagez le lien public
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-6 flex justify-center">
              <canvas ref={qrCanvasRef} className="rounded-lg shadow-sm" />
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
              <p className="text-xs text-blue-700 font-medium mb-2">URL publique</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={qrCodeUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 focus:outline-none"
                />
                <button
                  onClick={handleCopyUrl}
                  className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                  title="Copier l'URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDownloadQR}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold"
              >
                <Download className="w-4 h-4" />
                Télécharger QR
              </button>
              <button
                onClick={() => setShowQRModal(null)}
                className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-semibold"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                Les visiteurs pourront participer à votre campagne via cette page publique
              </p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
