import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Filter, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import type { Database } from '../lib/database.types';

type ScheduledJob = Database['public']['Tables']['scheduled_jobs']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface JobWithCampaign extends ScheduledJob {
  campaign?: Campaign;
}

export function ScheduledSends() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const toast = useToast();
  const [jobs, setJobs] = useState<JobWithCampaign[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [effectiveTenantId]);

  const loadData = async () => {
    if (!effectiveTenantId) return;

    setLoading(true);
    try {
      const [jobsResult, campaignsResult] = await Promise.all([
        supabase
          .from('scheduled_jobs')
          .select('*')
          .eq('tenant_id', effectiveTenantId)
          .order('scheduled_at', { ascending: false }),
        supabase
          .from('campaigns')
          .select('*')
          .eq('tenant_id', effectiveTenantId)
          .order('title'),
      ]);

      if (jobsResult.error) throw jobsResult.error;
      if (campaignsResult.error) throw campaignsResult.error;

      const campaignsMap = new Map((campaignsResult.data || []).map(c => [c.id, c]));
      const jobsWithCampaigns = (jobsResult.data || []).map(job => ({
        ...job,
        campaign: job.campaign_id ? campaignsMap.get(job.campaign_id) : undefined,
      }));

      setJobs(jobsWithCampaigns);
      setCampaigns(campaignsResult.data || []);
    } catch (error: any) {
      toast.error('Erreur lors du chargement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cet envoi planifié ?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('scheduled_jobs')
        .update({ status: 'cancelled' })
        .eq('id', jobId)
        .eq('status', 'pending');

      if (error) throw error;

      toast.success('Envoi annulé');
      loadData();
    } catch (error: any) {
      toast.error('Erreur lors de l\'annulation: ' + error.message);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (selectedCampaign !== 'all' && job.campaign_id !== selectedCampaign) {
      return false;
    }
    if (selectedStatus !== 'all' && job.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          label: 'En attente',
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-900/30',
        };
      case 'processing':
        return {
          icon: Loader2,
          label: 'En cours',
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-900/30',
          spin: true,
        };
      case 'completed':
        return {
          icon: CheckCircle2,
          label: 'Terminé',
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/30',
        };
      case 'failed':
        return {
          icon: XCircle,
          label: 'Échoué',
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/30',
        };
      case 'cancelled':
        return {
          icon: XCircle,
          label: 'Annulé',
          color: 'text-slate-600 dark:text-slate-400',
          bg: 'bg-slate-50 dark:bg-slate-700/30',
        };
      default:
        return {
          icon: AlertCircle,
          label: status,
          color: 'text-slate-600 dark:text-slate-400',
          bg: 'bg-slate-50 dark:bg-slate-700/30',
        };
    }
  };

  const getJobStats = (job: JobWithCampaign) => {
    const totalSponsors = job.payload?.sponsors?.length || 0;
    let sent = 0;
    let errors = 0;

    if (job.status === 'completed' || job.status === 'failed') {
      const errorMessage = job.error_message || '';
      const errorMatch = errorMessage.match(/(\d+) errors? occurred/);
      if (errorMatch) {
        errors = parseInt(errorMatch[1]);
      }
      sent = totalSponsors - errors;
    }

    return { total: totalSponsors, sent, errors };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Envois planifiés</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Gérez et suivez vos invitations planifiées
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Filtrer par campagne
          </label>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            data-testid="filter-campaign"
          >
            <option value="all">Toutes les campagnes</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Filtrer par statut
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            data-testid="filter-status"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="processing">En cours</option>
            <option value="completed">Terminé</option>
            <option value="failed">Échoué</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
      </div>

      {(selectedCampaign !== 'all' || selectedStatus !== 'all') && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Filter className="w-4 h-4" />
          <span>
            {filteredJobs.length} résultat{filteredJobs.length !== 1 ? 's' : ''} sur {jobs.length}
          </span>
          {(selectedCampaign !== 'all' || selectedStatus !== 'all') && (
            <button
              onClick={() => {
                setSelectedCampaign('all');
                setSelectedStatus('all');
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {filteredJobs.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12">
          <div className="text-center">
            <Calendar className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Aucun envoi planifié
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {selectedCampaign !== 'all' || selectedStatus !== 'all'
                ? 'Aucun envoi ne correspond à vos filtres.'
                : 'Planifiez vos premiers envois depuis la page Sponsors.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Campagne
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Planifié pour
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Destinataires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Résultats
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredJobs.map((job) => {
                  const statusInfo = getStatusInfo(job.status);
                  const StatusIcon = statusInfo.icon;
                  const stats = getJobStats(job);
                  const campaignTitle = job.campaign?.title || 'Campagne supprimée';

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {campaignTitle}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {job.job_type}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {formatDate(job.scheduled_at)}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {formatTime(job.scheduled_at)}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}
                        >
                          <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.spin ? 'animate-spin' : ''}`} />
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {stats.total} destinataire{stats.total !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {job.status === 'completed' || job.status === 'failed' ? (
                          <div className="text-sm space-y-1">
                            {stats.sent > 0 && (
                              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{stats.sent} envoyé{stats.sent !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {stats.errors > 0 && (
                              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                                <XCircle className="w-4 h-4" />
                                <span>{stats.errors} erreur{stats.errors !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {job.executed_at && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {formatDate(job.executed_at)} à {formatTime(job.executed_at)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500 dark:text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {job.status === 'pending' && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            data-testid="cancel-job-button"
                          >
                            <X className="w-4 h-4" />
                            Annuler
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {job.status === 'failed' && job.error_message && filteredJobs.some(j => j.status === 'failed') && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900 dark:text-red-300 mb-1">
                Erreurs détectées
              </h4>
              <p className="text-sm text-red-800 dark:text-red-400">
                Certains envois ont échoué. Consultez les logs pour plus de détails ou contactez le support.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
