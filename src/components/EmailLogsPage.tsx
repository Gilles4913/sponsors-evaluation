import { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, X, Calendar, CheckCircle, XCircle, Copy, ShieldAlert, ExternalLink, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Layout } from './Layout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { TenantSelect } from './TenantSelect';
import { loadEmailLogs, EmailLog as EmailLogType } from '../lib/emailLogsLoader';

function formatDateTime(ts: string): string {
  const date = new Date(ts);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} à ${hours}:${minutes}`;
}

function truncateId(uuid: string | null): string {
  if (!uuid) return '—';
  if (uuid.length < 13) return uuid;
  return `${uuid.substring(0, 8)}…${uuid.substring(uuid.length - 5)}`;
}

type EmailLog = EmailLogType;


type DateRangeType = 'today' | '7d' | '30d' | 'custom';

export function EmailLogsPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'super_admin') {
      setAuthorized(false);
    }
  }, [profile]);

  if (!authorized) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Accès refusé
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Retour à l'accueil
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  const pageSize = 25;

  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'json'>('summary');
  const { showToast } = useToast();

  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      q: params.get('q') || '',
      status: params.get('status') || 'all',
      tenant: params.get('tenant') || 'all',
      from: params.get('from') || '',
      to: params.get('to') || '',
      page: parseInt(params.get('page') || '1', 10) - 1,
    };
  };

  const [searchQuery, setSearchQuery] = useState(getUrlParams().q);
  const [statusFilter, setStatusFilter] = useState(getUrlParams().status);
  const [tenantFilter, setTenantFilter] = useState(getUrlParams().tenant);
  const [customDateStart, setCustomDateStart] = useState(getUrlParams().from);
  const [customDateEnd, setCustomDateEnd] = useState(getUrlParams().to);
  const [page, setPage] = useState(getUrlParams().page);

  const dateRange: DateRangeType = customDateStart || customDateEnd ? 'custom' : '30d';

  const updateUrl = (params: { q?: string; status?: string; tenant?: string; from?: string; to?: string; page?: number }) => {
    const urlParams = new URLSearchParams(window.location.search);

    if (params.q !== undefined) {
      if (params.q) urlParams.set('q', params.q);
      else urlParams.delete('q');
    }
    if (params.status !== undefined) {
      if (params.status !== 'all') urlParams.set('status', params.status);
      else urlParams.delete('status');
    }
    if (params.tenant !== undefined) {
      if (params.tenant !== 'all') urlParams.set('tenant', params.tenant);
      else urlParams.delete('tenant');
    }
    if (params.from !== undefined) {
      if (params.from) urlParams.set('from', params.from);
      else urlParams.delete('from');
    }
    if (params.to !== undefined) {
      if (params.to) urlParams.set('to', params.to);
      else urlParams.delete('to');
    }
    if (params.page !== undefined) {
      if (params.page > 0) urlParams.set('page', String(params.page + 1));
      else urlParams.delete('page');
    }

    const newUrl = urlParams.toString() ? `?${urlParams.toString()}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);
  };

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, searchQuery, tenantFilter, customDateStart, customDateEnd]);

  const getDateRange = (): { start: string; end: string } => {
    const now = new Date();
    const end = now.toISOString();
    let start: string;

    switch (dateRange) {
      case 'today': {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start = today.toISOString();
        break;
      }
      case '7d': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        start = weekAgo.toISOString();
        break;
      }
      case '30d': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        start = monthAgo.toISOString();
        break;
      }
      case 'custom': {
        start = customDateStart ? new Date(customDateStart).toISOString() : new Date(0).toISOString();
        return {
          start,
          end: customDateEnd ? new Date(customDateEnd + 'T23:59:59').toISOString() : end,
        };
      }
      default: {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        start = monthAgo.toISOString();
      }
    }

    return { start, end };
  };

  const fetchLogs = async () => {
    setLoading(true);

    try {
      const { start, end } = getDateRange();

      const result = await loadEmailLogs({
        q: searchQuery.trim() || undefined,
        status: statusFilter,
        tenantId: tenantFilter,
        from: start,
        to: end,
        page,
        pageSize,
      });

      setLogs(result.rows);
      setTotalCount(result.total);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleRowClick = (log: EmailLog) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedLog(null);
    setActiveTab('summary');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('JSON copié dans le presse-papiers', 'success');
    }).catch(() => {
      showToast('Erreur lors de la copie', 'error');
    });
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
    setTenantFilter('all');
    setCustomDateStart('');
    setCustomDateEnd('');
    setPage(0);
    updateUrl({ q: '', status: 'all', tenant: 'all', from: '', to: '', page: 0 });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  const abbreviate = (id: string | null) => {
    if (!id) return '—';
    return id.substring(0, 8);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'sent') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          Sent
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300">
        {status}
      </span>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const exportToCSV = () => {
    const headers = ['Date', 'Email', 'Statut', 'Tenant', 'Utilisateur'];
    const rows = logs.map(log => [
      formatDate(log.created_at),
      log.to_email,
      log.status,
      log.tenant_label || '—',
      log.user_label || '—'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(.{8})(.{4})/, '$1_$2');
    const filename = `email_logs_${timestamp}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Export réussi: ${filename}`, 'success');
  };

  if (!profile) {
    return (
      <Layout>
        <div className="p-6 text-center text-slate-600 dark:text-slate-400">
          Chargement...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Email Test Logs
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {totalCount} log(s) total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="btn-open-diagnostic"
              onClick={() => window.open('/admin/emails-test', '_blank')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <ExternalLink className="w-4 h-4" />
              Diagnostique Resend
            </button>
            <button
              data-testid="btn-export-csv"
              onClick={exportToCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Exporter (CSV)
            </button>
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition"
            >
              <X className="w-4 h-4" />
              Réinitialiser filtres
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Période
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => {
                      setCustomDateStart(e.target.value);
                      setPage(0);
                      updateUrl({ from: e.target.value, page: 0 });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Date début"
                  />
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => {
                      setCustomDateEnd(e.target.value);
                      setPage(0);
                      updateUrl({ to: e.target.value, page: 0 });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Date fin"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Filter className="w-4 h-4 inline mr-1" />
                  Statut
                </label>
                <select
                  data-testid="filter-status"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                    updateUrl({ status: e.target.value, page: 0 });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tous</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Search className="w-4 h-4 inline mr-1" />
                  Recherche email
                </label>
                <input
                  data-testid="filter-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                    updateUrl({ q: e.target.value, page: 0 });
                  }}
                  placeholder="Rechercher par email..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tenant
                </label>
                <TenantSelect
                  value={tenantFilter}
                  onChange={(tenantId) => {
                    setTenantFilter(tenantId);
                    setPage(0);
                    updateUrl({ tenant: tenantId, page: 0 });
                  }}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 animate-pulse"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 animate-pulse"></div>
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16 animate-pulse"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Aucun log pour ces critères
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  Essayez de modifier vos filtres ou réinitialisez-les
                </p>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <table data-testid="email-logs-table" className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Destinataire
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Response ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => handleRowClick(log)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                        {log.to_email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 font-mono">
                        <span title={log.user_id || ''}>
                          {truncateId(log.user_id)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                        {log.tenant_label || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400 font-mono">
                        {log.response_json?.id ? truncateId(log.response_json.id) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Page {page + 1} sur {totalPages || 1}
            </div>
            <div className="flex gap-2">
              <button
                data-testid="pager-prev"
                onClick={() => {
                  const newPage = Math.max(0, page - 1);
                  setPage(newPage);
                  updateUrl({ page: newPage });
                }}
                disabled={page === 0}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
              <button
                data-testid="pager-next"
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  updateUrl({ page: newPage });
                }}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {drawerOpen && selectedLog && (
        <div
          data-testid="drawer-log"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-end"
          onClick={closeDrawer}
        >
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Détails du log
                </h2>
                <button
                  onClick={closeDrawer}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {getStatusBadge(selectedLog.status)}
                  <span className="text-base font-medium text-slate-900 dark:text-white">
                    {selectedLog.to_email}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Date:</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {formatDateTime(selectedLog.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">User:</span>
                    <span className="text-slate-900 dark:text-white font-medium font-mono text-xs">
                      {selectedLog.user_label || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Club:</span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {selectedLog.tenant_label || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700">
              <div className="flex px-6">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === 'summary'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Résumé
                </button>
                <button
                  onClick={() => setActiveTab('json')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                    activeTab === 'json'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  JSON brut
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {selectedLog.response_json?.id && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Response ID
                      </h3>
                      <p className="text-sm font-mono text-slate-900 dark:text-white">
                        {selectedLog.response_json.id}
                      </p>
                    </div>
                  )}
                  {selectedLog.response_json?.error?.message && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">
                        Message d'erreur
                      </h3>
                      <p className="text-sm text-red-800 dark:text-red-400">
                        {selectedLog.response_json.error.message}
                      </p>
                    </div>
                  )}
                  {selectedLog.response_json?.message && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        Message
                      </h3>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {selectedLog.response_json.message}
                      </p>
                    </div>
                  )}
                  {!selectedLog.response_json?.id && !selectedLog.response_json?.error?.message && !selectedLog.response_json?.message && (
                    <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                      Aucune donnée de résumé disponible
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'json' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedLog.response_json, null, 2))}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                    >
                      <Copy className="w-4 h-4" />
                      Copier JSON
                    </button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs text-slate-900 dark:text-white font-mono whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.response_json, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6">
              <button
                onClick={closeDrawer}
                className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
