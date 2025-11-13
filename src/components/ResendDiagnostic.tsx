import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Mail, Server, Clock, Bug } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Layout } from './Layout';
import { useAuth } from '../contexts/AuthContext';

function getApiBase() {
  const envBase = import.meta.env.VITE_PUBLIC_BASE_URL?.trim();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return envBase || origin;
}

function getApiUrl(path: string) {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function fetchJson(path: string) {
  const url = getApiUrl(path);
  try {
    const res = await fetch(url, { headers: { 'accept': 'application/json' } });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0,200)}`);
    return { ok: true, json: json ?? text, url, status: res.status };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e), url };
  }
}

interface EnvCheckResult {
  RESEND_API_KEY: boolean;
  VITE_PUBLIC_BASE_URL: boolean;
  timestamp: string;
}

interface DomainStatus {
  id: string;
  name: string;
  status: 'verified' | 'pending' | 'failed' | 'temporary_failure';
  created_at: string;
}

interface EmailTestLog {
  id: string;
  user_id: string;
  to_email: string;
  status: string;
  response_json: any;
  created_at: string;
}

export function ResendDiagnostic() {
  const { profile } = useAuth();
  const [envCheck, setEnvCheck] = useState<EnvCheckResult | null>(null);
  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailTestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    baseUrl: string;
    envCheckUrl: string;
    emailTestUrl: string;
    envCheckStatus?: number;
    emailTestStatus?: number;
    lastError?: string;
  } | null>(null);

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);

    const baseUrl = getApiBase();
    const envCheckUrl = getApiUrl('/api/env-check');
    const emailTestUrl = getApiUrl('/api/email-test?to=test@example.com');

    const debug: typeof debugInfo = {
      baseUrl,
      envCheckUrl,
      emailTestUrl,
    };

    try {
      const envResult = await fetchJson('/api/env-check');
      debug.envCheckStatus = envResult.status;

      if (!envResult.ok) {
        throw new Error(`env-check failed: ${envResult.error}`);
      }

      const envData = envResult.json;
      setEnvCheck({
        RESEND_API_KEY: envData.resend_api_key_present || false,
        VITE_PUBLIC_BASE_URL: !!envData.vite_public_base_url && envData.vite_public_base_url !== '(unset)',
        timestamp: new Date().toISOString(),
      });

      const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;
      if (resendApiKey) {
        const domainsResponse = await fetch('https://api.resend.com/domains', {
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
          },
        });

        if (domainsResponse.ok) {
          const domainsData = await domainsResponse.json();
          const domain = domainsData.data?.find((d: any) =>
            d.name === 'notifications.a2display.fr'
          );
          if (domain) {
            setDomainStatus(domain);
          }
        }
      }

      const { data: logs, error: logsError } = await supabase
        .from('email_test_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (logsError) {
        console.error('Error fetching email logs:', logsError);
      } else if (logs) {
        setEmailLogs(logs);
      }

      setDebugInfo(debug);

    } catch (err: any) {
      console.error('Error fetching diagnostics:', err);
      debug.lastError = `${err.message} (URL: ${envCheckUrl})`;
      setDebugInfo(debug);
      setError(`${err.message}\nURL appelée: ${envCheckUrl}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: boolean | string) => {
    if (typeof status === 'boolean') {
      return status ? (
        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
      ) : (
        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
      );
    }

    switch (status) {
      case 'verified':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      default:
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium";

    switch (status) {
      case 'verified':
        return (
          <span className={`${baseClasses} bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400`}>
            <CheckCircle className="w-3 h-3" />
            Verified
          </span>
        );
      case 'pending':
        return (
          <span className={`${baseClasses} bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400`}>
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'sent':
        return (
          <span className={`${baseClasses} bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400`}>
            Sent
          </span>
        );
      case 'failed':
        return (
          <span className={`${baseClasses} bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400`}>
            Failed
          </span>
        );
      default:
        return (
          <span className={`${baseClasses} bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300`}>
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600 dark:text-slate-400">Chargement des diagnostics...</div>
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
              Diagnostic Resend
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              État des services et configuration email
            </p>
          </div>
          <button
            onClick={fetchDiagnostics}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            Rafraîchir
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-300">Erreur</h3>
                <p className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        )}

        {debugInfo && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" data-testid="resend-debug-panel">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <Bug className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Debug Info
                </h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-400">Base URL:</span>
                  <p className="text-slate-900 dark:text-white break-all mt-1">{debugInfo.baseUrl}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-400">env-check URL:</span>
                  <p className="text-slate-900 dark:text-white break-all mt-1">{debugInfo.envCheckUrl}</p>
                  {debugInfo.envCheckStatus && (
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Status: {debugInfo.envCheckStatus}</p>
                  )}
                </div>
                <div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg">
                  <span className="text-slate-600 dark:text-slate-400">email-test URL:</span>
                  <p className="text-slate-900 dark:text-white break-all mt-1">{debugInfo.emailTestUrl}</p>
                  {debugInfo.emailTestStatus && (
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Status: {debugInfo.emailTestStatus}</p>
                  )}
                </div>
                {debugInfo.lastError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <span className="text-red-600 dark:text-red-400">Last Error:</span>
                    <p className="text-red-900 dark:text-red-300 break-all mt-1">{debugInfo.lastError}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Variables d'environnement
              </h2>
            </div>
          </div>
          <div className="p-6">
            {envCheck ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    RESEND_API_KEY
                  </span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(envCheck.RESEND_API_KEY)}
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {envCheck.RESEND_API_KEY ? 'Configuré' : 'Manquant'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    VITE_PUBLIC_BASE_URL
                  </span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(envCheck.VITE_PUBLIC_BASE_URL)}
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {envCheck.VITE_PUBLIC_BASE_URL ? 'Configuré' : 'Manquant'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                  Dernière vérification: {new Date(envCheck.timestamp).toLocaleString('fr-FR')}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Impossible de récupérer les variables d'environnement
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Statut du domaine Resend
              </h2>
            </div>
          </div>
          <div className="p-6">
            {domainStatus ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {domainStatus.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(domainStatus.status)}
                    {getStatusBadge(domainStatus.status)}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Créé le: {new Date(domainStatus.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-900 dark:text-amber-300">
                    Impossible de récupérer le statut du domaine
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Vérifiez que VITE_RESEND_API_KEY est configuré
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Derniers tests d'emails
              </h2>
            </div>
          </div>
          <div className="p-6">
            {emailLogs.length > 0 ? (
              <div className="space-y-3">
                {emailLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {log.to_email}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(log.status)}
                      {log.response_json?.id && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {log.response_json.id.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Aucun test d'email enregistré
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
