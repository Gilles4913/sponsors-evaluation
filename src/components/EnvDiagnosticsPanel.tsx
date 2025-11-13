import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Copy, ExternalLink, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ServerEnvResult {
  RESEND_API_KEY: boolean;
  SUPABASE_SERVICE_ROLE: boolean;
  SERVICE_ROLE_LENGTH: number;
  NODE_ENV?: string;
  BACKEND_NAME?: string;
}

export default function EnvDiagnosticsPanel() {
  const [serverEnvResult, setServerEnvResult] = useState<ServerEnvResult | null>(null);
  const [serverEnvError, setServerEnvError] = useState<string | null>(null);
  const [supabaseTestResult, setSupabaseTestResult] = useState<string | null>(null);
  const [supabaseTestError, setSupabaseTestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const publicEnvVars = {
    VITE_PUBLIC_BASE_URL: import.meta.env.VITE_PUBLIC_BASE_URL || '',
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    VITE_PUBLIC_BACKEND_NAME: import.meta.env.VITE_PUBLIC_BACKEND_NAME || '',
  };

  const projectId = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const baseUrlMatches = publicEnvVars.VITE_PUBLIC_BASE_URL === currentOrigin;

  const copyPublicEnvToClipboard = () => {
    const json = JSON.stringify(publicEnvVars, null, 2);
    navigator.clipboard.writeText(json);
    alert('Public env variables copied to clipboard!');
  };

  const testServerEnv = async () => {
    setLoading(true);
    setServerEnvError(null);
    setServerEnvResult(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/env-check`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      setServerEnvResult(data);
    } catch (err: any) {
      setServerEnvError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const pingSupabase = async () => {
    setLoading(true);
    setSupabaseTestError(null);
    setSupabaseTestResult(null);

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .limit(1);

      if (error) {
        setSupabaseTestError(`${error.code || 'ERROR'}: ${error.message}`);
      } else {
        setSupabaseTestResult(`Success! Found ${data?.length || 0} tenant(s)`);
      }
    } catch (err: any) {
      setSupabaseTestError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const openBaseUrl = () => {
    const url = publicEnvVars.VITE_PUBLIC_BASE_URL || currentOrigin;
    window.open(url, '_blank');
  };

  const truncate = (str: string, len = 40) => {
    if (str.length <= len) return str;
    return str.substring(0, len) + '...';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Environment Diagnostics</h1>
          <p className="text-sm text-slate-600">
            Project: <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{projectId}</span>
            {' '} | Backend: <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{publicEnvVars.VITE_PUBLIC_BACKEND_NAME || 'N/A'}</span>
            {' '} | Origin: <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{currentOrigin}</span>
          </p>
          {publicEnvVars.VITE_PUBLIC_BASE_URL && (
            <p className="text-sm text-slate-600 mt-2">
              BASE_URL matches origin: {baseUrlMatches ? (
                <span className="text-green-600 font-semibold">✓ Yes</span>
              ) : (
                <span className="text-red-600 font-semibold">✗ No (BASE_URL: {publicEnvVars.VITE_PUBLIC_BASE_URL})</span>
              )}
            </p>
          )}
        </div>

        {/* Public Environment Variables */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              Public Environment Variables
            </h2>
            <button
              data-testid="btn-copy-env"
              onClick={copyPublicEnvToClipboard}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy JSON
            </button>
          </div>

          <div className="overflow-x-auto" data-testid="env-public-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-semibold text-slate-700">Variable</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-700">Value</th>
                  <th className="text-left py-2 px-3 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(publicEnvVars).map(([key, value]) => (
                  <tr key={key} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-mono text-xs text-slate-600">{key}</td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">{value ? truncate(value) : <span className="text-slate-400">Not set</span>}</td>
                    <td className="py-2 px-3">
                      {value ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          Set
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                          <XCircle className="w-3 h-3" />
                          Missing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Server Environment Variables */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            Server Environment Variables
          </h2>

          <button
            data-testid="env-server-test"
            onClick={testServerEnv}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            <Database className="w-4 h-4" />
            Test Server Variables
          </button>

          {serverEnvError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              <strong>Error:</strong> {serverEnvError}
            </div>
          )}

          {serverEnvResult && (
            <div data-testid="env-server-result" className="mt-4 space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">RESEND_API_KEY:</span>
                {serverEnvResult.RESEND_API_KEY ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    Set
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                    <XCircle className="w-3 h-3" />
                    Missing
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">SUPABASE_SERVICE_ROLE:</span>
                {serverEnvResult.SUPABASE_SERVICE_ROLE ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    Set (length: {serverEnvResult.SERVICE_ROLE_LENGTH})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                    <XCircle className="w-3 h-3" />
                    Missing
                  </span>
                )}
              </div>

              {serverEnvResult.NODE_ENV && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">NODE_ENV:</span>
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{serverEnvResult.NODE_ENV}</span>
                </div>
              )}

              {serverEnvResult.BACKEND_NAME && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">BACKEND_NAME:</span>
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{serverEnvResult.BACKEND_NAME}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Supabase Connection Test */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-green-600" />
            Supabase Connection Test
          </h2>

          <button
            data-testid="env-ping-supabase"
            onClick={pingSupabase}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            <Database className="w-4 h-4" />
            Ping Supabase
          </button>

          {supabaseTestError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              <strong>Error:</strong> {supabaseTestError}
            </div>
          )}

          {supabaseTestResult && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {supabaseTestResult}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>

          <div className="flex gap-3">
            <button
              data-testid="btn-open-base"
              onClick={openBaseUrl}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open BASE_URL
            </button>

            <a
              href="/email-test"
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              Email Test Lab
            </a>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Quick Summary</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Public variables are injected and readable</li>
            <li>✓ Server variables can be tested via edge function</li>
            <li>✓ Supabase connection can be verified</li>
            <li>✓ BASE_URL can be validated against current origin</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
