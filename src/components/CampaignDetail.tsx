import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Target,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Mail,
  FileDown,
  Share2,
  QrCode,
  Copy,
  Calculator,
  Save,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';
import { QRCodeGenerator } from './QRCodeGenerator';
import { exportToCsv, exportToPdfWithStorage } from '../lib/exportUtils';
import type { Database } from '../lib/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Pledge = Database['public']['Tables']['pledges']['Row'];

interface CampaignWithStats extends Campaign {
  pledges_count?: number;
  total_pledged?: number;
  progress_percentage?: number;
  yes_count?: number;
  maybe_count?: number;
  no_count?: number;
}

interface PledgeWithSponsor extends Pledge {
  sponsor_name_display?: string;
}

interface CampaignDetailProps {
  campaignId: string;
  onBack: () => void;
}

const SCREEN_TYPE_LABELS = {
  led_ext: 'LED Extérieur',
  led_int: 'LED Intérieur',
  borne_ext: 'Borne Extérieur',
  borne_int_mobile: 'Borne Intérieur Mobile',
  ecran_int_fixe: 'Écran Intérieur Fixe',
};

export function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
  const { profile } = useAuth();
  const toast = useToast();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [campaign, setCampaign] = useState<CampaignWithStats | null>(null);
  const [pledges, setPledges] = useState<PledgeWithSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showForecast, setShowForecast] = useState(false);

  const [forecastData, setForecastData] = useState({
    price_hint: 0,
    expected_interested_sponsors: 0,
    cost_estimate: 0,
  });

  useEffect(() => {
    fetchCampaignDetails();
  }, [campaignId]);

  const fetchCampaignDetails = async () => {
    setLoading(true);
    try {
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*, tenants(*)')
        .eq('id', campaignId)
        .single();

      if (campaignError) throw campaignError;

      const tenant = Array.isArray(campaignData.tenants)
        ? campaignData.tenants[0]
        : campaignData.tenants;

      const { data: pledgesData, error: pledgesError } = await supabase
        .from('pledges')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('amount', { ascending: false });

      if (pledgesError) throw pledgesError;

      const totalPledged = pledgesData?.reduce((sum, p) => {
        if (p.status === 'yes') {
          return sum + (p.amount || 0);
        }
        return sum;
      }, 0) || 0;

      const yesCount = pledgesData?.filter((p) => p.status === 'yes').length || 0;
      const maybeCount = pledgesData?.filter((p) => p.status === 'maybe').length || 0;
      const noCount = pledgesData?.filter((p) => p.status === 'no').length || 0;

      const progressPercentage = campaignData.objective_amount
        ? (totalPledged / campaignData.objective_amount) * 100
        : 0;

      setCampaign({
        ...campaignData,
        tenant,
        pledges_count: pledgesData?.length || 0,
        total_pledged: totalPledged,
        progress_percentage: progressPercentage,
        yes_count: yesCount,
        maybe_count: maybeCount,
        no_count: noCount,
      });

      const pledgesWithNames = pledgesData?.map((pledge) => ({
        ...pledge,
        sponsor_name_display: pledge.sponsor_name || pledge.sponsor_email,
      }));

      setPledges(pledgesWithNames || []);

      setForecastData({
        price_hint: campaignData.annual_price_hint || 0,
        expected_interested_sponsors: yesCount + maybeCount,
        cost_estimate: campaignData.cost_estimate || 0,
      });
    } catch (error: any) {
      toast.error('Erreur lors du chargement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!campaign) return;

    const publicUrl = `${window.location.origin}/p/${campaign.slug || campaign.id}`;
    setQrCodeUrl(publicUrl);

    try {
      if (qrCanvasRef.current) {
        await QRCode.toCanvas(qrCanvasRef.current, publicUrl, {
          width: 300,
          margin: 2,
        });
      }
      setShowQRModal(true);
    } catch (error) {
      toast.error('Erreur lors de la génération du QR code');
    }
  };

  const handleDownloadQR = () => {
    if (qrCanvasRef.current) {
      const url = qrCanvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `qr-${campaign?.slug || campaign?.id}.png`;
      link.href = url;
      link.click();
      toast.success('QR code téléchargé');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(qrCodeUrl);
    toast.success('URL copiée dans le presse-papier');
  };

  const handleExportCSV = () => {
    if (!campaign || !pledges) return;

    const pledgesWithSponsors = pledges.map((p) => ({
      ...p,
      sponsors: {
        company: p.sponsor_company,
        contact_name: p.sponsor_name_display,
        email: p.sponsor_email,
        phone: p.sponsor_phone,
      },
    }));

    exportToCsv(campaign, pledgesWithSponsors as any);
    toast.success('Export CSV terminé');
  };

  const handleExportPDF = async () => {
    if (!campaign || !pledges || !profile?.tenant_id) return;

    toast.info('Génération du PDF en cours...');

    const pledgesWithSponsors = pledges.map((p) => ({
      ...p,
      sponsors: {
        company: p.sponsor_company,
        contact_name: p.sponsor_name_display,
        email: p.sponsor_email,
        phone: p.sponsor_phone,
      },
    }));

    const stats = {
      total_pledged: campaign.total_pledged || 0,
      yes_count: campaign.yes_count || 0,
      maybe_count: campaign.maybe_count || 0,
      no_count: campaign.no_count || 0,
      progress_percentage: campaign.progress_percentage || 0,
    };

    const result = await exportToPdfWithStorage(
      campaign,
      pledgesWithSponsors as any,
      stats,
      profile.tenant_id
    );

    if (result.success) {
      toast.success('PDF généré et sauvegardé avec succès');
      if (result.url) {
        console.log('PDF URL:', result.url);
      }
    } else {
      toast.error(result.error || 'Erreur lors de la génération du PDF');
    }
  };

  const handleSendReminders = async () => {
    if (!campaign) return;

    const maybeSponsors = pledges.filter((p) => p.status === 'maybe');
    if (maybeSponsors.length === 0) {
      toast.info('Aucun sponsor "Peut-être" à relancer');
      return;
    }

    toast.info(`Relance de ${maybeSponsors.length} sponsor(s) en cours...`);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-reminders`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: campaign.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi des relances');
      }

      toast.success('Relances envoyées avec succès');
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const handleSaveScenario = async () => {
    if (!campaign) return;

    try {
      const estimatedRevenue = forecastData.price_hint * forecastData.expected_interested_sponsors;
      const attainmentPercentage = campaign.objective_amount
        ? (estimatedRevenue / campaign.objective_amount) * 100
        : 0;

      const { error } = await supabase.from('scenarios').insert({
        campaign_id: campaign.id,
        price_hint: forecastData.price_hint,
        expected_interested_sponsors: forecastData.expected_interested_sponsors,
        estimated_revenue: estimatedRevenue,
        cost_estimate: forecastData.cost_estimate,
        attainment_percentage: attainmentPercentage,
      });

      if (error) throw error;

      toast.success('Scénario enregistré avec succès');
    } catch (error: any) {
      toast.error('Erreur lors de l\'enregistrement: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600 dark:text-slate-400">Chargement...</div>
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600 dark:text-slate-400">Campagne introuvable</div>
        </div>
      </Layout>
    );
  }

  const yesPledges = pledges.filter((p) => p.status === 'yes');
  const chartData = yesPledges.slice(0, 10).map((pledge) => ({
    name: pledge.sponsor_name_display?.substring(0, 15) + (pledge.sponsor_name_display && pledge.sponsor_name_display.length > 15 ? '...' : ''),
    montant: pledge.amount || 0,
  }));

  const estimatedRevenue = forecastData.price_hint * forecastData.expected_interested_sponsors;
  const forecastAttainment = campaign.objective_amount
    ? (estimatedRevenue / campaign.objective_amount) * 100
    : 0;
  const breakEven = forecastData.cost_estimate > 0 && forecastData.price_hint > 0
    ? Math.ceil(forecastData.cost_estimate / forecastData.price_hint)
    : 0;
  const gapToObjective = campaign.objective_amount - (campaign.total_pledged || 0);
  const sponsorsNeeded = gapToObjective > 0 && campaign.annual_price_hint > 0
    ? Math.ceil(gapToObjective / campaign.annual_price_hint)
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux campagnes</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{campaign.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium">
                {SCREEN_TYPE_LABELS[campaign.screen_type]}
              </span>
              <span>{campaign.location}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSendReminders}
              className="flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg transition"
            >
              <Mail className="w-4 h-4" />
              <span className="font-medium">Relancer</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
              title="Exporter CSV"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition"
              title="Exporter PDF"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={handleGenerateQR}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
              title="Générer QR Code"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Objectif atteint à {(campaign.progress_percentage || 0).toFixed(1)}%
                </h2>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {(campaign.total_pledged || 0).toLocaleString('fr-FR')}€
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    sur {campaign.objective_amount.toLocaleString('fr-FR')}€ visés
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (campaign.progress_percentage || 0) >= 100
                      ? 'bg-gradient-to-r from-green-500 to-green-600'
                      : 'bg-gradient-to-r from-blue-500 to-green-500'
                  }`}
                  style={{ width: `${Math.min(campaign.progress_percentage || 0, 100)}%` }}
                />
              </div>

              {gapToObjective > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Écart à l'objectif</p>
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {gapToObjective.toLocaleString('fr-FR')}€
                    </p>
                  </div>
                  {sponsorsNeeded > 0 && (
                    <div className="text-right">
                      <p className="text-sm text-slate-600 dark:text-slate-400">Sponsors nécessaires</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {sponsorsNeeded}
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">
                          à {campaign.annual_price_hint.toLocaleString('fr-FR')}€
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Oui</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {campaign.yes_count || 0}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {(campaign.total_pledged || 0).toLocaleString('fr-FR')}€
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Peut-être</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {campaign.maybe_count || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Non</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {campaign.no_count || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {yesPledges.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Top 10 des sponsors par montant
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                      formatter={(value: number) => `${value.toLocaleString('fr-FR')}€`}
                    />
                    <Bar dataKey="montant" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Mode prévisionnel
                </h2>
                <button
                  onClick={() => setShowForecast(!showForecast)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  {showForecast ? 'Masquer' : 'Afficher'}
                </button>
              </div>

              {showForecast && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Prix unitaire estimé: {forecastData.price_hint.toLocaleString('fr-FR')}€
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50000"
                      step="500"
                      value={forecastData.price_hint}
                      onChange={(e) =>
                        setForecastData({ ...forecastData, price_hint: parseInt(e.target.value) })
                      }
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Sponsors intéressés estimés: {forecastData.expected_interested_sponsors}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={forecastData.expected_interested_sponsors}
                      onChange={(e) =>
                        setForecastData({
                          ...forecastData,
                          expected_interested_sponsors: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Coût estimé: {forecastData.cost_estimate.toLocaleString('fr-FR')}€
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100000"
                      step="1000"
                      value={forecastData.cost_estimate}
                      onChange={(e) =>
                        setForecastData({ ...forecastData, cost_estimate: parseInt(e.target.value) })
                      }
                      className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Revenu estimé
                      </span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {estimatedRevenue.toLocaleString('fr-FR')}€
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        % d'atteinte
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          forecastAttainment >= 100
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {forecastAttainment.toFixed(1)}%
                      </span>
                    </div>

                    {forecastData.cost_estimate > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          Break-even
                        </span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                          {breakEven} sponsors
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSaveScenario}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition font-medium shadow-lg"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer le scénario
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Statistiques
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Total réponses
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {campaign.pledges_count || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Taux de conversion
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {campaign.pledges_count
                      ? ((campaign.yes_count! / campaign.pledges_count) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Montant moyen
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {campaign.yes_count
                      ? ((campaign.total_pledged || 0) / campaign.yes_count!).toLocaleString(
                          'fr-FR'
                        )
                      : 0}
                    €
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showQRModal && campaign && (
        <QRCodeGenerator
          campaign={campaign}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </Layout>
  );
}
