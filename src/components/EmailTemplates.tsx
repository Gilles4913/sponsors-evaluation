import { useState, useEffect } from 'react';
import { Mail, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Layout } from './Layout';
import { useAsTenant } from '../hooks/useAsTenant';
import { useAuth } from '../contexts/AuthContext';
import { loadTemplatesFlex, NormalizedTemplate, LoadTemplatesResult } from '../lib/templatesFlex';

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  invitation: 'Invitation initiale',
  reminder_5d: 'Rappel 5 jours',
  reminder_10d: 'Rappel 10 jours',
  confirmation: 'Confirmation de réponse',
  sponsor_ack: 'Accusé réception sponsor',
  campaign_summary: 'Résumé de campagne',
};

type ScopeFilter = 'all' | 'global' | 'tenant';

interface Tenant {
  id: string;
  name: string;
}

export function EmailTemplates() {
  const { user } = useAuth();
  const { effectiveTenantId, asTenantId, setAsTenantId, isMasquerading } = useAsTenant();
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [loadResult, setLoadResult] = useState<LoadTemplatesResult | null>(null);
  const [diagExpanded, setDiagExpanded] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);

  const userRole = user?.app_metadata?.role || 'user';

  useEffect(() => {
    fetchTemplates();
  }, [effectiveTenantId]);

  useEffect(() => {
    if (userRole === 'super_admin') {
      fetchTenants();
    }
  }, [userRole]);

  const fetchTenants = async () => {
    setTenantsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setTenantsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const result = await loadTemplatesFlex(supabase, effectiveTenantId);
      setLoadResult(result);
    } catch (error) {
      console.error('Error loading templates:', error);
      setLoadResult({
        mode: 'A',
        rows: [],
        error: {
          message: String(error),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const templates = loadResult?.rows || [];
  const globalTemplates = templates.filter((t) => t.scope === 'global');
  const tenantTemplates = templates.filter((t) => t.scope === 'tenant');

  const filteredTemplates =
    scopeFilter === 'all'
      ? templates
      : scopeFilter === 'global'
      ? globalTemplates
      : tenantTemplates;

  const projectId = import.meta.env.VITE_SUPABASE_URL
    ? new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
    : 'unknown';

  const handleTenantChange = (tenantId: string) => {
    if (tenantId === '') {
      setAsTenantId(null);
    } else {
      setAsTenantId(tenantId);
    }
    fetchTemplates();
  };

  const currentTenantName = asTenantId
    ? tenants.find((t) => t.id === asTenantId)?.name || asTenantId
    : null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Templates d'emails
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Gérez vos modèles d'emails automatiques
              </p>
            </div>
            <div className="flex items-center gap-3">
              {userRole === 'super_admin' && (
                <select
                  data-testid="as-tenant-select"
                  value={asTenantId || ''}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  disabled={tenantsLoading}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="">Voir en tant que...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                data-testid="tmpl-scope-select"
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-900 dark:text-white"
              >
                <option value="all">Tous</option>
                <option value="global">Globaux</option>
                <option value="tenant">Mon club</option>
              </select>
              <button
                data-testid="tmpl-reload"
                onClick={fetchTemplates}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg flex items-center gap-2 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Recharger
              </button>
            </div>
          </div>

          {isMasquerading && currentTenantName && (
            <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg">
              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-orange-900 dark:text-orange-300">
                Masquerade: {currentTenantName}
              </span>
            </div>
          )}

          {!effectiveTenantId && (
            <div
              data-testid="tmpl-guard-tenant"
              className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Tenant non défini — affichage des globaux uniquement
              </span>
            </div>
          )}

          {/* Stats bar */}
          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <span data-testid="tmpl-count-all">
              <strong className="text-slate-900 dark:text-white">{templates.length}</strong>{' '}
              total
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span data-testid="tmpl-count-global">
              <strong className="text-slate-900 dark:text-white">{globalTemplates.length}</strong>{' '}
              globaux
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span data-testid="tmpl-count-tenant">
              <strong className="text-slate-900 dark:text-white">{tenantTemplates.length}</strong>{' '}
              mon club
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span data-testid="tmpl-mode">
              Mode <strong className="font-mono text-slate-900 dark:text-white">{loadResult?.mode || 'N/A'}</strong>
            </span>
          </div>
        </div>

        {/* Diagnostics Panel */}
        <div
          data-testid="tmpl-diag"
          className="mb-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setDiagExpanded(!diagExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Diagnostics
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({templates.length} templates chargés)
              </span>
            </div>
            {diagExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {diagExpanded && (
            <div className="px-4 pb-4 pt-2 space-y-3 text-sm border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">
                    <strong>Project ID:</strong>
                  </p>
                  <code className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block">
                    {projectId}
                  </code>
                </div>

                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">
                    <strong>User Email:</strong>
                  </p>
                  <code className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block">
                    {user?.email || '(none)'}
                  </code>
                </div>

                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">
                    <strong>Role:</strong>
                  </p>
                  <code
                    data-testid="tmpl-diag-role"
                    className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                  >
                    {userRole}
                  </code>
                </div>

                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">
                    <strong>asTenantId:</strong>
                  </p>
                  <code
                    data-testid="tmpl-diag-tenant"
                    className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                  >
                    {asTenantId || '(aucun)'}
                  </code>
                </div>

                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">
                    <strong>Mode détecté:</strong>
                  </p>
                  <code
                    data-testid="tmpl-diag-mode"
                    className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                  >
                    {loadResult?.mode || 'N/A'}
                  </code>
                </div>

                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">
                    <strong>Compteurs:</strong>
                  </p>
                  <div className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs">
                    <span className="font-semibold">{templates.length}</span> total,{' '}
                    <span className="font-semibold">{globalTemplates.length}</span> globaux,{' '}
                    <span className="font-semibold">{tenantTemplates.length}</span> tenant
                  </div>
                </div>
              </div>

              {loadResult?.lastSql && (
                <div>
                  <p className="text-slate-600 dark:text-slate-400 mb-1">
                    <strong>Dernier SQL exécuté:</strong>
                  </p>
                  <pre className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono whitespace-pre-wrap break-words overflow-auto max-h-32">
                    {loadResult.lastSql}
                  </pre>
                </div>
              )}

              {loadResult?.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="font-semibold text-red-900 dark:text-red-400 mb-2">
                    Dernière erreur
                  </p>
                  <div className="space-y-1 text-xs text-red-700 dark:text-red-300">
                    <p>
                      <strong>Message:</strong> {loadResult.error.message}
                    </p>
                    {loadResult.error.status && (
                      <p>
                        <strong>Status:</strong> {loadResult.error.status}
                      </p>
                    )}
                    {loadResult.error.details && (
                      <p>
                        <strong>Details:</strong> {loadResult.error.details}
                      </p>
                    )}
                    {loadResult.error.hint && (
                      <p>
                        <strong>Hint:</strong> {loadResult.error.hint}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={fetchTemplates}
                  disabled={loading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs rounded-lg flex items-center gap-2 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Recharger
                </button>
              </div>
            </div>
          )}
        </div>

        {loadResult?.warning && (
          <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900 dark:text-yellow-300 mb-1">
                  Avertissement
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-400">
                  {loadResult.warning}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">Chargement des templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div
            data-testid="tmpl-empty-diag"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8"
          >
            <div className="flex items-start gap-4">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Aucun template trouvé
                </h3>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <p>
                    <strong>Rôle JWT :</strong>{' '}
                    <code className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono">
                      {userRole}
                    </code>
                  </p>
                  <p>
                    <strong>Tenant courant :</strong>{' '}
                    <code className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono">
                      {effectiveTenantId || 'null'}
                    </code>
                  </p>
                  <p>
                    <strong>Mode utilisé :</strong>{' '}
                    <code className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono">
                      {loadResult?.mode}
                    </code>
                  </p>
                  {loadResult?.error && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="font-semibold text-red-900 dark:text-red-400 mb-1">
                        Erreur
                      </p>
                      <p className="text-red-700 dark:text-red-300">
                        {loadResult.error.message}
                      </p>
                      {loadResult.error.status && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Status: {loadResult.error.status}
                        </p>
                      )}
                      {loadResult.error.details && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {loadResult.error.details}
                        </p>
                      )}
                      {loadResult.error.hint && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Hint: {loadResult.error.hint}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={fetchTemplates}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Recharger
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global templates section */}
            {(scopeFilter === 'all' || scopeFilter === 'global') && globalTemplates.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Templates globaux ({globalTemplates.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {globalTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tenant templates section */}
            {(scopeFilter === 'all' || scopeFilter === 'tenant') && tenantTemplates.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Mon club ({tenantTemplates.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tenantTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}

interface TemplateCardProps {
  template: NormalizedTemplate;
}

function TemplateCard({ template }: TemplateCardProps) {
  const isGlobal = template.scope === 'global';
  const label = TEMPLATE_TYPE_LABELS[template.key] || template.key;

  return (
    <a
      href={`/templates/${template.id}`}
      data-testid={`tmpl-link-${template.id}`}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition shadow-sm hover:shadow-md p-6 cursor-pointer block"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`p-2 rounded-lg ${
            isGlobal
              ? 'bg-purple-100 dark:bg-purple-900/30'
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}
        >
          <Mail
            className={`w-5 h-5 ${
              isGlobal
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          />
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            isGlobal
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          }`}
        >
          {isGlobal ? 'Global' : 'Club'}
        </span>
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{label}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
        {template.subject}
      </p>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-500">
        <code className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono">
          {template.key}
        </code>
        {template.updated_at && (
          <span>{new Date(template.updated_at).toLocaleDateString('fr-FR')}</span>
        )}
      </div>
    </a>
  );
}
