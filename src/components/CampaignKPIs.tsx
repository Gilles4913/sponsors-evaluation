import { TrendingUp, Users, CheckCircle, Clock, XCircle, FileDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Database } from '../lib/database.types';

type Pledge = Database['public']['Tables']['pledges']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface CampaignWithStats extends Campaign {
  pledges_count?: number;
  total_pledged?: number;
  progress_percentage?: number;
  yes_count?: number;
  maybe_count?: number;
  no_count?: number;
}

interface RecentPledge extends Pledge {
  campaign_name?: string;
  sponsor_name?: string;
}

interface CampaignKPIsProps {
  campaigns: CampaignWithStats[];
  recentPledges: RecentPledge[];
  onExportCSV: () => void;
  onViewCampaign: (campaignId: string) => void;
}

const STATUS_COLORS = {
  yes: '#10b981',
  maybe: '#f59e0b',
  no: '#ef4444',
};

export function CampaignKPIs({
  campaigns,
  recentPledges,
  onExportCSV,
  onViewCampaign,
}: CampaignKPIsProps) {
  const totalYes = campaigns.reduce((sum, c) => sum + (c.yes_count || 0), 0);
  const totalMaybe = campaigns.reduce((sum, c) => sum + (c.maybe_count || 0), 0);
  const totalNo = campaigns.reduce((sum, c) => sum + (c.no_count || 0), 0);

  const statusData = [
    { name: 'Oui', value: totalYes, color: STATUS_COLORS.yes },
    { name: 'Peut-être', value: totalMaybe, color: STATUS_COLORS.maybe },
    { name: 'Non', value: totalNo, color: STATUS_COLORS.no },
  ].filter((item) => item.value > 0);

  const totalResponses = totalYes + totalMaybe + totalNo;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Objectifs par campagne
          </h3>

          {campaigns.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              Aucune campagne créée
            </p>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => {
                const progress = campaign.progress_percentage || 0;
                const isComplete = progress >= 100;

                return (
                  <div key={campaign.id}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {campaign.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(campaign.total_pledged || 0).toLocaleString('fr-FR')}€ /{' '}
                          {campaign.objective_amount.toLocaleString('fr-FR')}€
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          isComplete
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isComplete
                            ? 'bg-gradient-to-r from-green-500 to-green-600'
                            : 'bg-gradient-to-r from-blue-500 to-green-500'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Répartition des réponses
          </h3>

          {totalResponses === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              Aucune réponse enregistrée
            </p>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => (
                      <span className="text-sm text-slate-900 dark:text-white">
                        {value}: {entry.payload.value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-4 mt-4 w-full">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Oui
                    </span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{totalYes}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Peut-être
                    </span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{totalMaybe}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Non
                    </span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{totalNo}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Promesses récentes
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {recentPledges.length} promesse(s)
            </p>
          </div>
          <button
            onClick={onExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition"
          >
            <FileDown className="w-4 h-4" />
            <span className="text-sm font-medium">Export CSV</span>
          </button>
        </div>

        {recentPledges.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 dark:text-slate-400">Aucune promesse enregistrée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Sponsor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Campagne
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {recentPledges.map((pledge) => (
                  <tr
                    key={pledge.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {pledge.sponsor_name || pledge.sponsor_email}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {pledge.sponsor_company || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-slate-900 dark:text-white">
                        {pledge.campaign_name}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {(pledge.amount || 0).toLocaleString('fr-FR')}€
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pledge.status === 'yes' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Oui
                        </span>
                      )}
                      {pledge.status === 'maybe' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400">
                          <Clock className="w-3 h-3" />
                          Peut-être
                        </span>
                      )}
                      {pledge.status === 'no' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                          <XCircle className="w-3 h-3" />
                          Non
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-slate-900 dark:text-white">
                        {new Date(pledge.created_at || '').toLocaleDateString('fr-FR')}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => onViewCampaign(pledge.campaign_id)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition"
                      >
                        Voir campagne
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
