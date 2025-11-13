import { useState, useEffect } from 'react';
import { Mail, AlertCircle, ChevronLeft, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Layout } from './Layout';
import { useAsTenant } from '../hooks/useAsTenant';
import { useAuth } from '../contexts/AuthContext';

interface NormalizedTemplate {
  id: string;
  tenant_id: string | null;
  key: string;
  subject: string;
  html: string;
  created_at: string;
  scope: 'global' | 'tenant';
}

interface LoadResult {
  mode: 'A' | 'B';
  filterType: 'id' | 'key' | 'none';
  template: NormalizedTemplate | null;
  lastSql?: string;
  error?: {
    message: string;
    status?: string;
    details?: string;
  };
}

interface AvailableTemplate {
  id: string;
  key: string;
  subject: string;
}

export function TemplateDetail({ idOrKey }: { idOrKey: string }) {
  const { user } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<AvailableTemplate[]>([]);
  const [diagExpanded, setDiagExpanded] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [idOrKey, effectiveTenantId]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const loadResult = await loadTemplateFlexible(idOrKey, effectiveTenantId);
      setResult(loadResult);

      if (!loadResult.template) {
        await fetchAvailableTemplates();
      }
    } catch (error) {
      console.error('Error loading template:', error);
      setResult({
        mode: 'A',
        filterType: 'none',
        template: null,
        error: {
          message: String(error),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTemplates = async () => {
    try {
      const { data: modeAData } = await supabase
        .from('email_templates')
        .select('id, key, subject')
        .is('tenant_id', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (modeAData && modeAData.length > 0) {
        setAvailableTemplates(modeAData);
        return;
      }

      const { data: modeBData } = await supabase
        .from('email_templates')
        .select('id, type, subject')
        .is('tenant_id', null)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (modeBData) {
        setAvailableTemplates(
          modeBData.map((t: any) => ({
            id: t.id,
            key: t.type,
            subject: t.subject,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching available templates:', error);
    }
  };

  const userRole = user?.app_metadata?.role || 'user';
  const projectId = import.meta.env.VITE_SUPABASE_URL
    ? new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
    : 'unknown';

  const template = result?.template;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {template ? template.subject : 'Template introuvable'}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {template ? `Clé: ${template.key}` : `Recherche: ${idOrKey}`}
              </p>
            </div>
            <button
              onClick={loadTemplate}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg flex items-center gap-2 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Recharger
            </button>
          </div>

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
                    <code className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block">
                      {userRole}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Tenant ID:</strong>
                    </p>
                    <code className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block">
                      {effectiveTenantId || '(aucun)'}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Mode détecté:</strong>
                    </p>
                    <code
                      data-testid="tmpl-detail-mode"
                      className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                    >
                      {result?.mode || 'N/A'}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Type de filtre:</strong>
                    </p>
                    <code
                      data-testid="tmpl-detail-source"
                      className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                    >
                      {result?.filterType || 'N/A'}
                    </code>
                  </div>

                  {template && (
                    <div>
                      <p className="text-slate-600 dark:text-slate-400 mb-1">
                        <strong>Scope:</strong>
                      </p>
                      <code
                        data-testid="tmpl-detail-scope"
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                      >
                        {template.scope}
                      </code>
                    </div>
                  )}
                </div>

                {result?.lastSql && (
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Dernier SQL exécuté:</strong>
                    </p>
                    <pre className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono whitespace-pre-wrap break-words overflow-auto max-h-32">
                      {result.lastSql}
                    </pre>
                  </div>
                )}

                {result?.error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="font-semibold text-red-900 dark:text-red-400 mb-2">
                      Erreur
                    </p>
                    <div className="space-y-1 text-xs text-red-700 dark:text-red-300">
                      <p>
                        <strong>Message:</strong> {result.error.message}
                      </p>
                      {result.error.status && (
                        <p>
                          <strong>Status:</strong> {result.error.status}
                        </p>
                      )}
                      {result.error.details && (
                        <p>
                          <strong>Details:</strong> {result.error.details}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">Chargement du template...</p>
          </div>
        ) : !template ? (
          <div
            data-testid="tmpl-detail-notfound"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8"
          >
            <div className="flex items-start gap-4">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Template non trouvé pour param={idOrKey}
                </h3>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <p>
                    Mode{' '}
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {result?.mode}
                    </strong>{' '}
                    utilisé, tenantId={' '}
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {effectiveTenantId || 'null'}
                    </strong>
                    {!effectiveTenantId && ', scope=global-only'}
                  </p>

                  {availableTemplates.length > 0 && (
                    <div className="mt-4">
                      <p className="font-semibold text-slate-900 dark:text-white mb-2">
                        Templates disponibles (5 derniers globaux):
                      </p>
                      <div className="space-y-2">
                        {availableTemplates.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="font-mono text-xs text-slate-500 dark:text-slate-500">
                                ID: {t.id}
                              </span>
                              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                                key: {t.key}
                              </span>
                            </div>
                            <p className="text-sm text-slate-900 dark:text-white">
                              {t.subject}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => window.history.back()}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Retour à la liste
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {template.subject}
                  </h2>
                  <span
                    data-testid="tmpl-detail-scope"
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      template.scope === 'global'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}
                  >
                    {template.scope === 'global' ? 'Global' : 'Club'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    <strong>Clé:</strong>{' '}
                    <code className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono">
                      {template.key}
                    </code>
                  </span>
                  <span>
                    <strong>ID:</strong>{' '}
                    <code
                      data-testid="tmpl-detail-id"
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono text-xs"
                    >
                      {template.id}
                    </code>
                  </span>
                  <span>
                    <strong>Créé:</strong> {new Date(template.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>

              <div className="prose dark:prose-invert max-w-none">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                  Aperçu HTML
                </h3>
                <div
                  className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-auto"
                  dangerouslySetInnerHTML={{ __html: template.html }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadTemplateFlexible(
  param: string,
  tenantId: string | null
): Promise<LoadResult> {
  const isUuid = UUID_REGEX.test(param);
  let mode: 'A' | 'B' = 'A';
  let filterType: 'id' | 'key' | 'none' = isUuid ? 'id' : 'key';
  let lastSql = '';

  const tenantFilter = tenantId ? `(tenant_id is null OR tenant_id = '${tenantId}')` : '(tenant_id is null)';
  const tenantOrClause = tenantId ? `tenant_id.is.null,tenant_id.eq.${tenantId}` : 'tenant_id.is.null';

  if (isUuid) {
    lastSql = `SELECT id, tenant_id, key, subject, html, created_at FROM email_templates WHERE id = '${param}' AND ${tenantFilter} LIMIT 1`;

    const query = supabase
      .from('email_templates')
      .select('id, tenant_id, key, subject, html, created_at')
      .eq('id', param);

    if (tenantId) {
      query.or(tenantOrClause);
    } else {
      query.is('tenant_id', null);
    }

    const { data: modeAById, error: errorAById } = await query.limit(1).maybeSingle();

    if (errorAById) {
      const errorMsg = errorAById.message || '';
      if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
        mode = 'B';
        lastSql = `SELECT id, tenant_id, type as key, subject, html_body as html, updated_at as created_at FROM email_templates WHERE id = '${param}' AND ${tenantFilter} LIMIT 1`;

        const queryB = supabase
          .from('email_templates')
          .select('id, tenant_id, type, subject, html_body, updated_at')
          .eq('id', param);

        if (tenantId) {
          queryB.or(tenantOrClause);
        } else {
          queryB.is('tenant_id', null);
        }

        const { data: modeBById, error: errorBById } = await queryB.limit(1).maybeSingle();

        if (errorBById) {
          return {
            mode: 'B',
            filterType: 'id',
            template: null,
            lastSql,
            error: {
              message: errorBById.message,
              status: errorBById.code,
              details: errorBById.details,
            },
          };
        }

        if (modeBById) {
          return {
            mode: 'B',
            filterType: 'id',
            lastSql,
            template: {
              id: modeBById.id,
              tenant_id: modeBById.tenant_id,
              key: modeBById.type,
              subject: modeBById.subject,
              html: modeBById.html_body,
              created_at: modeBById.updated_at,
              scope: modeBById.tenant_id ? 'tenant' : 'global',
            },
          };
        }

        return {
          mode: 'B',
          filterType: 'id',
          template: null,
          lastSql,
        };
      }

      return {
        mode: 'A',
        filterType: 'id',
        template: null,
        lastSql,
        error: {
          message: errorAById.message,
          status: errorAById.code,
          details: errorAById.details,
        },
      };
    }

    if (modeAById) {
      return {
        mode: 'A',
        filterType: 'id',
        lastSql,
        template: {
          id: modeAById.id,
          tenant_id: modeAById.tenant_id,
          key: modeAById.key,
          subject: modeAById.subject,
          html: modeAById.html,
          created_at: modeAById.created_at,
          scope: modeAById.tenant_id ? 'tenant' : 'global',
        },
      };
    }

    return {
      mode: 'A',
      filterType: 'id',
      template: null,
      lastSql,
    };
  } else {
    lastSql = `SELECT id, tenant_id, key, subject, html, created_at FROM email_templates WHERE key = '${param}' AND ${tenantFilter} ORDER BY created_at DESC LIMIT 1`;

    const queryByKey = supabase
      .from('email_templates')
      .select('id, tenant_id, key, subject, html, created_at')
      .eq('key', param);

    if (tenantId) {
      queryByKey.or(tenantOrClause);
    } else {
      queryByKey.is('tenant_id', null);
    }

    const { data: modeAByKey, error: errorAByKey } = await queryByKey
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errorAByKey) {
      const errorMsg = errorAByKey.message || '';
      if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
        mode = 'B';
        lastSql = `SELECT id, tenant_id, type as key, subject, html_body as html, updated_at as created_at FROM email_templates WHERE (type = '${param}' OR key = '${param}') AND ${tenantFilter} ORDER BY updated_at DESC LIMIT 1`;

        const queryBByKey = supabase
          .from('email_templates')
          .select('id, tenant_id, type, subject, html_body, updated_at, key')
          .or(`type.eq.${param},key.eq.${param}`);

        if (tenantId) {
          queryBByKey.or(tenantOrClause);
        } else {
          queryBByKey.is('tenant_id', null);
        }

        const { data: modeBByKey, error: errorBByKey } = await queryBByKey
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (errorBByKey) {
          return {
            mode: 'B',
            filterType: 'key',
            template: null,
            lastSql,
            error: {
              message: errorBByKey.message,
              status: errorBByKey.code,
              details: errorBByKey.details,
            },
          };
        }

        if (modeBByKey) {
          return {
            mode: 'B',
            filterType: 'key',
            lastSql,
            template: {
              id: modeBByKey.id,
              tenant_id: modeBByKey.tenant_id,
              key: modeBByKey.type || modeBByKey.key,
              subject: modeBByKey.subject,
              html: modeBByKey.html_body,
              created_at: modeBByKey.updated_at,
              scope: modeBByKey.tenant_id ? 'tenant' : 'global',
            },
          };
        }

        return {
          mode: 'B',
          filterType: 'key',
          template: null,
          lastSql,
        };
      }

      return {
        mode: 'A',
        filterType: 'key',
        template: null,
        lastSql,
        error: {
          message: errorAByKey.message,
          status: errorAByKey.code,
          details: errorAByKey.details,
        },
      };
    }

    if (modeAByKey) {
      return {
        mode: 'A',
        filterType: 'key',
        lastSql,
        template: {
          id: modeAByKey.id,
          tenant_id: modeAByKey.tenant_id,
          key: modeAByKey.key,
          subject: modeAByKey.subject,
          html: modeAByKey.html,
          created_at: modeAByKey.created_at,
          scope: modeAByKey.tenant_id ? 'tenant' : 'global',
        },
      };
    }

    return {
      mode: 'A',
      filterType: 'key',
      template: null,
      lastSql,
    };
  }
}
