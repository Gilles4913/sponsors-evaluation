import { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  Calendar,
  MapPin,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  ArrowRight,
  Copy,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';
import { CampaignForm } from './CampaignForm';
import { CampaignDetail } from './CampaignDetail';
import type { Database } from '../lib/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface CampaignWithStats extends Campaign {
  pledges_count?: number;
  total_pledged?: number;
  progress_percentage?: number;
  yes_count?: number;
  maybe_count?: number;
  no_count?: number;
  is_open?: boolean;
}

const SCREEN_TYPE_LABELS = {
  led_ext: 'LED Extérieur',
  led_int: 'LED Intérieur',
  borne_ext: 'Borne Extérieur',
  borne_int_mobile: 'Borne Intérieur Mobile',
  ecran_int_fixe: 'Écran Intérieur Fixe',
};

export function CampaignsList() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    if (!effectiveTenantId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const now = new Date();
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

            const yesCount = pledgesData?.filter((p) => p.status === 'yes').length || 0;
            const maybeCount = pledgesData?.filter((p) => p.status === 'maybe').length || 0;
            const noCount = pledgesData?.filter((p) => p.status === 'no').length || 0;

            const progressPercentage = campaign.objective_amount
              ? (totalPledged / campaign.objective_amount) * 100
              : 0;

            const isOpen = campaign.deadline ? new Date(campaign.deadline) > now : true;

            return {
              ...campaign,
              pledges_count: pledgesData?.length || 0,
              total_pledged: totalPledged,
              progress_percentage: progressPercentage,
              yes_count: yesCount,
              maybe_count: maybeCount,
              no_count: noCount,
              is_open: isOpen,
            };
          })
        );

        setCampaigns(campaignsWithStats);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    fetchCampaigns();
    toast.success('Campagne créée avec succès');
  };

  const handleDuplicate = async (campaign: Campaign) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase.from('campaigns').insert({
        tenant_id: profile.tenant_id,
        title: `${campaign.title} (Copie)`,
        screen_type: campaign.screen_type,
        location: campaign.location,
        annual_price_hint: campaign.annual_price_hint,
        objective_amount: campaign.objective_amount,
        daily_footfall_estimate: campaign.daily_footfall_estimate,
        lighting_hours: campaign.lighting_hours,
        cover_image_url: campaign.cover_image_url,
        description_md: campaign.description_md,
        is_public_share_enabled: false,
        public_slug: null,
        deadline: null,
      });

      if (error) throw error;

      toast.success('Campagne dupliquée avec succès');
      fetchCampaigns();
    } catch (error: any) {
      toast.error('Erreur lors de la duplication: ' + error.message);
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

  if (selectedCampaignId) {
    return <CampaignDetail campaignId={selectedCampaignId} onBack={() => setSelectedCampaignId(null)} />;
  }

  if (showCreateForm) {
    return <CampaignForm onSuccess={handleCreateSuccess} onCancel={() => setShowCreateForm(false)} />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mes campagnes</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {campaigns.length} campagne(s) au total
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition shadow-lg"
            data-testid="create-campaign-button"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">Nouvelle campagne</span>
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <Target className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Aucune campagne
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Créez votre première campagne pour commencer à collecter des promesses
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Créer une campagne
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition"
                data-testid="campaign-card"
              >
                <div className="flex flex-col lg:flex-row">
                  {campaign.cover_image_url && (
                    <div className="lg:w-64 h-48 lg:h-auto overflow-hidden">
                      <img
                        src={campaign.cover_image_url}
                        alt={campaign.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {campaign.title}
                          </h3>
                          {campaign.is_open ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                              <CheckCircle className="w-3 h-3" />
                              Ouverte
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                              <XCircle className="w-3 h-3" />
                              Fermée
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium">
                            {SCREEN_TYPE_LABELS[campaign.screen_type]}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" />
                            {campaign.location}
                          </span>
                          {campaign.deadline && (
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {new Date(campaign.deadline).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                          {campaign.is_public_share_enabled ? (
                            <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                              <Eye className="w-4 h-4" />
                              Partage public
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                              <EyeOff className="w-4 h-4" />
                              Privée
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            Objectif
                          </span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {campaign.objective_amount.toLocaleString('fr-FR')}€
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            Collecté
                          </span>
                        </div>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          {(campaign.total_pledged || 0).toLocaleString('fr-FR')}€
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            Réponses
                          </span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {campaign.pledges_count || 0}
                        </p>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            Progression
                          </span>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {(campaign.progress_percentage || 0).toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2 text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Progression</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {(campaign.progress_percentage || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (campaign.progress_percentage || 0) >= 100
                              ? 'bg-gradient-to-r from-green-500 to-green-600'
                              : 'bg-gradient-to-r from-blue-500 to-green-500'
                          }`}
                          style={{
                            width: `${Math.min(campaign.progress_percentage || 0, 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-slate-600 dark:text-slate-400">
                            {campaign.yes_count || 0} Oui
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-slate-600 dark:text-slate-400">
                            {campaign.maybe_count || 0} Peut-être
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span className="text-slate-600 dark:text-slate-400">
                            {campaign.no_count || 0} Non
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDuplicate(campaign)}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition text-sm font-medium"
                          title="Dupliquer cette campagne"
                        >
                          <Copy className="w-4 h-4" />
                          Dupliquer
                        </button>
                        <button
                          onClick={() => setSelectedCampaignId(campaign.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition shadow-lg text-sm font-medium"
                        >
                          Voir détails
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
