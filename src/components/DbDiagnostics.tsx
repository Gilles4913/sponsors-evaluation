import { useState } from 'react';
import { Database, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ErrorDetails {
  status: number | null;
  message: string;
  details: string;
  hint: string;
}

interface TestResult {
  ok: boolean;
  rows?: any[];
  error?: ErrorDetails;
  data?: any;
}

function getProjectId(url: string): string {
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : 'unknown';
}

function explainError(err: any): ErrorDetails {
  if (!err) {
    return {
      status: null,
      message: 'Unknown error',
      details: '',
      hint: '',
    };
  }

  return {
    status: err.code ? parseInt(err.code) : null,
    message: err.message || String(err),
    details: err.details || '',
    hint: err.hint || '',
  };
}

export default function DbDiagnostics() {
  const [pingResult, setPingResult] = useState<TestResult | null>(null);
  const [modeAResult, setModeAResult] = useState<TestResult | null>(null);
  const [modeBResult, setModeBResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const projectId = getProjectId(supabaseUrl);
  const truncatedUrl = supabaseUrl.length > 40 ? supabaseUrl.substring(0, 40) + '...' : supabaseUrl;
  const truncatedAnon = supabaseAnonKey.substring(0, 8) + '...';

  const pingDatabase = async () => {
    setLoading('ping');
    setPingResult(null);

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .limit(1);

      if (error) {
        setPingResult({
          ok: false,
          error: explainError(error),
        });
      } else {
        setPingResult({
          ok: true,
          data: data,
        });
      }
    } catch (err: any) {
      setPingResult({
        ok: false,
        error: explainError(err),
      });
    } finally {
      setLoading(null);
    }
  };

  const testTemplates = async (mode: 'A' | 'B') => {
    const setResult = mode === 'A' ? setModeAResult : setModeBResult;
    setLoading(mode === 'A' ? 'modeA' : 'modeB');
    setResult(null);

    try {
      let query;

      if (mode === 'A') {
        query = supabase
          .from('email_templates')
          .select('id, tenant_id, key, subject, html, created_at')
          .limit(5);
      } else {
        query = supabase
          .from('email_templates')
          .select('id, tenant_id, type, subject, html_body, updated_at')
          .limit(5);
      }

      const { data, error } = await query;

      if (error) {
        setResult({
          ok: false,
          error: explainError(error),
        });
      } else {
        setResult({
          ok: true,
          rows: data,
        });
      }
    } catch (err: any) {
      setResult({
        ok: false,
        error: explainError(err),
      });
    } finally {
      setLoading(null);
    }
  };

  const shouldShowModeB = () => {
    if (!modeAResult || modeAResult.ok) return false;
    const status = modeAResult.error?.status;
    return status === 400 || status === 406;
  };

  const getRlsHints = () => {
    const hints: string[] = [];

    if (modeAResult?.error || modeBResult?.error) {
      const error = modeAResult?.error || modeBResult?.error;
      const status = error?.status;

      if (status === 401 || status === 403) {
        hints.push(
          'Probable RLS: autoriser rôle super_admin (jwt/app_metadata.role) et/ou lecture tenant_id courant'
        );
      }

      if (status === 400 || status === 406) {
        hints.push(
          'Probable mismatch colonnes (key/html vs type/html_body) → utiliser Mode B'
        );
      }
    }

    return hints;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Database Diagnostics</h1>
          <p className="text-sm text-slate-600">
            Comprehensive database connection and schema testing
          </p>
        </div>

        {/* Environment Card */}
        <div data-testid="env-card" className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Environnement
            </h2>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Project ID:</span>
              <span className="font-mono text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded">
                {projectId}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Supabase URL:</span>
              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                {truncatedUrl}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Anon Key (preview):</span>
              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                {truncatedAnon}
              </span>
            </div>
          </div>
        </div>

        {/* Ping DB Card */}
        <div data-testid="ping-card" className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-green-600" />
              Ping Database
            </h2>
            <button
              data-testid="btn-retry-ping"
              onClick={pingDatabase}
              disabled={loading === 'ping'}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading === 'ping' ? 'animate-spin' : ''}`} />
              Recharger
            </button>
          </div>

          {!pingResult && (
            <div className="text-sm text-slate-600">
              Cliquez sur "Recharger" pour tester la connexion
            </div>
          )}

          {pingResult?.ok && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                <CheckCircle className="w-5 h-5" />
                Connexion réussie
              </div>
              <div className="text-sm text-green-700">
                Base de données accessible. Nombre de résultats: {pingResult.data?.length || 0}
              </div>
            </div>
          )}

          {pingResult?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <XCircle className="w-5 h-5" />
                Erreur de connexion
              </div>
              <div className="space-y-1 text-sm">
                {pingResult.error.status && (
                  <div>
                    <span className="font-semibold text-red-700">Status:</span>{' '}
                    <span className="font-mono bg-red-100 px-2 py-0.5 rounded">
                      {pingResult.error.status}
                    </span>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-red-700">Message:</span>{' '}
                  <span className="text-red-700">{pingResult.error.message}</span>
                </div>
                {pingResult.error.details && (
                  <div>
                    <span className="font-semibold text-red-700">Details:</span>{' '}
                    <span className="text-red-700">{pingResult.error.details}</span>
                  </div>
                )}
                {pingResult.error.hint && (
                  <div>
                    <span className="font-semibold text-red-700">Hint:</span>{' '}
                    <span className="text-red-700">{pingResult.error.hint}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Templates Mode A Card */}
        <div data-testid="tmpl-a-card" className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-600" />
              Templates — Mode A
            </h2>
            <button
              data-testid="btn-retry-tmpl-a"
              onClick={() => testTemplates('A')}
              disabled={loading === 'modeA'}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading === 'modeA' ? 'animate-spin' : ''}`} />
              Recharger
            </button>
          </div>

          <div className="mb-3 text-sm text-slate-600">
            <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
              SELECT id, tenant_id, key, subject, html, created_at FROM email_templates LIMIT 5
            </span>
          </div>

          {!modeAResult && (
            <div className="text-sm text-slate-600">
              Cliquez sur "Recharger" pour tester le schéma Mode A
            </div>
          )}

          {modeAResult?.ok && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                <CheckCircle className="w-5 h-5" />
                Mode A réussi
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <div>Nombre de lignes: {modeAResult.rows?.length || 0}</div>
                {modeAResult.rows && modeAResult.rows.length > 0 && (
                  <div>
                    <span className="font-semibold">Colonnes détectées:</span>{' '}
                    {Object.keys(modeAResult.rows[0]).join(', ')}
                  </div>
                )}
              </div>
            </div>
          )}

          {modeAResult?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                <XCircle className="w-5 h-5" />
                Erreur Mode A
              </div>
              <div className="space-y-1 text-sm">
                {modeAResult.error.status && (
                  <div>
                    <span className="font-semibold text-red-700">Status:</span>{' '}
                    <span className="font-mono bg-red-100 px-2 py-0.5 rounded">
                      {modeAResult.error.status}
                    </span>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-red-700">Message:</span>{' '}
                  <span className="text-red-700">{modeAResult.error.message}</span>
                </div>
                {modeAResult.error.details && (
                  <div>
                    <span className="font-semibold text-red-700">Details:</span>{' '}
                    <span className="text-red-700">{modeAResult.error.details}</span>
                  </div>
                )}
                {modeAResult.error.hint && (
                  <div>
                    <span className="font-semibold text-red-700">Hint:</span>{' '}
                    <span className="text-red-700">{modeAResult.error.hint}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Templates Mode B Card */}
        {shouldShowModeB() && (
          <div data-testid="tmpl-b-card" className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-600" />
                Templates — Mode B (Fallback)
              </h2>
              <button
                data-testid="btn-retry-tmpl-b"
                onClick={() => testTemplates('B')}
                disabled={loading === 'modeB'}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading === 'modeB' ? 'animate-spin' : ''}`} />
                Recharger
              </button>
            </div>

            <div className="mb-3 text-sm text-slate-600">
              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                SELECT id, tenant_id, type, subject, html_body, updated_at FROM email_templates LIMIT 5
              </span>
            </div>

            {!modeBResult && (
              <div className="text-sm text-slate-600">
                Cliquez sur "Recharger" pour tester le schéma Mode B
              </div>
            )}

            {modeBResult?.ok && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
                  <CheckCircle className="w-5 h-5" />
                  Mode B réussi
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <div>Nombre de lignes: {modeBResult.rows?.length || 0}</div>
                  {modeBResult.rows && modeBResult.rows.length > 0 && (
                    <div>
                      <span className="font-semibold">Colonnes détectées:</span>{' '}
                      {Object.keys(modeBResult.rows[0]).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {modeBResult?.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800 font-semibold mb-2">
                  <XCircle className="w-5 h-5" />
                  Erreur Mode B
                </div>
                <div className="space-y-1 text-sm">
                  {modeBResult.error.status && (
                    <div>
                      <span className="font-semibold text-red-700">Status:</span>{' '}
                      <span className="font-mono bg-red-100 px-2 py-0.5 rounded">
                        {modeBResult.error.status}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-red-700">Message:</span>{' '}
                    <span className="text-red-700">{modeBResult.error.message}</span>
                  </div>
                  {modeBResult.error.details && (
                    <div>
                      <span className="font-semibold text-red-700">Details:</span>{' '}
                      <span className="text-red-700">{modeBResult.error.details}</span>
                    </div>
                  )}
                  {modeBResult.error.hint && (
                    <div>
                      <span className="font-semibold text-red-700">Hint:</span>{' '}
                      <span className="text-red-700">{modeBResult.error.hint}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RLS Hints Card */}
        {getRlsHints().length > 0 && (
          <div data-testid="rls-card" className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <div className="flex items-center gap-2 text-amber-800 font-semibold mb-3">
              <AlertTriangle className="w-5 h-5" />
              RLS & Schema Hints
            </div>
            <ul className="space-y-2">
              {getRlsHints().map((hint, index) => (
                <li key={index} className="text-sm text-amber-800 flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Diagnostic Summary</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Vérifie la connexion au projet Supabase correct</li>
            <li>✓ Teste la connectivité de base de données</li>
            <li>✓ Diagnostique le schéma des email_templates (Mode A vs Mode B)</li>
            <li>✓ Identifie les problèmes RLS et de colonnes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
