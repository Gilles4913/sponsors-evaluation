import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EnvVar {
  name: string;
  key: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  {
    name: 'VITE_SUPABASE_URL',
    key: 'VITE_SUPABASE_URL',
    required: true,
    description: 'URL du projet Supabase',
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    key: 'VITE_SUPABASE_ANON_KEY',
    required: true,
    description: 'Clé anonyme Supabase (public)',
  },
  {
    name: 'VITE_PUBLIC_BASE_URL',
    key: 'VITE_PUBLIC_BASE_URL',
    required: false,
    description: 'URL de base publique (QR codes, emails)',
  },
  {
    name: 'RESEND_API_KEY',
    key: 'RESEND_API_KEY',
    required: false,
    description: 'Clé API Resend (emails)',
  },
];

export default function EnvChecker() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const getEnvValue = (key: string): string | undefined => {
    return import.meta.env[key];
  };

  const isEnvSet = (key: string): boolean => {
    const value = getEnvValue(key);
    return value !== undefined && value !== '';
  };

  const getEnvStatus = (envVar: EnvVar): 'success' | 'warning' | 'error' => {
    const isSet = isEnvSet(envVar.key);

    if (isSet) return 'success';
    if (!envVar.required) return 'warning';
    return 'error';
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const supabaseUrl = getEnvValue('VITE_SUPABASE_URL');
      const supabaseKey = getEnvValue('VITE_SUPABASE_ANON_KEY');

      if (!supabaseUrl || !supabaseKey) {
        setTestResult({
          success: false,
          message: 'Variables Supabase manquantes',
          details: {
            url: !!supabaseUrl,
            key: !!supabaseKey,
          },
        });
        setTesting(false);
        return;
      }

      const startTime = Date.now();
      const { data, error, count } = await supabase
        .from('tenants')
        .select('id', { count: 'exact', head: false })
        .limit(1);

      const duration = Date.now() - startTime;

      if (error) {
        setTestResult({
          success: false,
          message: `Erreur de connexion: ${error.message}`,
          details: {
            code: error.code,
            hint: error.hint,
            duration: `${duration}ms`,
          },
        });
      } else {
        setTestResult({
          success: true,
          message: 'Connexion réussie!',
          details: {
            tenantsCount: count || 0,
            duration: `${duration}ms`,
            dataReturned: data?.length || 0,
          },
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Erreur: ${err.message}`,
        details: {
          error: err.toString(),
        },
      });
    } finally {
      setTesting(false);
    }
  };

  const allRequiredSet = ENV_VARS.filter((v) => v.required).every((v) =>
    isEnvSet(v.key)
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Variables d'environnement
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Vérification de la configuration de l'application
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {ENV_VARS.map((envVar) => {
            const status = getEnvStatus(envVar);
            const value = getEnvValue(envVar.key);

            return (
              <div
                key={envVar.key}
                className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="mt-0.5">
                  {status === 'success' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  )}
                  {status === 'warning' && (
                    <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  )}
                  {status === 'error' && (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm font-mono font-semibold text-slate-900 dark:text-white">
                      {envVar.name}
                    </code>
                    {!envVar.required && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                        Optionnel
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {envVar.description}
                  </p>

                  {value && (
                    <div className="mt-2">
                      <code className="text-xs font-mono text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded break-all">
                        {envVar.key.includes('KEY')
                          ? `${value.substring(0, 20)}...`
                          : value}
                      </code>
                    </div>
                  )}

                  {!value && (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-500 italic">
                      Non définie
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Statut de configuration
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {allRequiredSet ? (
                  <span className="text-green-600 dark:text-green-400">
                    Toutes les variables requises sont définies
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">
                    Des variables requises sont manquantes
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={testConnection}
              disabled={testing || !allRequiredSet}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition font-medium"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Test en cours...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Tester connexion
                </>
              )}
            </button>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-6 border-t ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    testResult.success
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-red-900 dark:text-red-100'
                  }`}
                >
                  {testResult.message}
                </p>
                {testResult.details && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(testResult.details).map(([key, value]) => (
                      <div
                        key={key}
                        className="text-sm font-mono text-slate-700 dark:text-slate-300"
                      >
                        <span className="font-semibold">{key}:</span>{' '}
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Configuration
        </h3>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>
            Les variables d'environnement doivent être définies dans le fichier{' '}
            <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded font-mono">
              .env
            </code>
          </p>
          <p>
            Voir{' '}
            <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded font-mono">
              .env.example
            </code>{' '}
            pour un exemple de configuration
          </p>
        </div>
      </div>
    </div>
  );
}
