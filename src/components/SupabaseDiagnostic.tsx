import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';

interface DiagnosticResult {
  ok: boolean;
  service_key_present: boolean;
  can_list_users: boolean;
  tenants_count: number | null;
  message?: string;
}

export function SupabaseDiagnostic() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        return;
      }

      const response = await fetch('/api/diag/supabase', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Erreur lors du diagnostic');
        return;
      }

      setResult(data);
      toast.success('Diagnostic effectué avec succès');
    } catch (error: any) {
      console.error('Error running diagnostic:', error);
      toast.error('Erreur lors du diagnostic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Diagnostic Supabase
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Vérifiez la configuration et les accès Supabase
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <button
            onClick={runDiagnostic}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Diagnostic en cours...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Rafraîchir
              </>
            )}
          </button>

          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Service Key présente
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Variable d'environnement SUPABASE_SERVICE_ROLE_KEY
                  </p>
                </div>
                {result.service_key_present ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Liste des utilisateurs
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Accès Admin API (auth.admin.listUsers)
                  </p>
                </div>
                {result.can_list_users ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Nombre de tenants
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Accès bypass RLS (service role)
                  </p>
                </div>
                <div className="text-right">
                  {result.tenants_count !== null ? (
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                      {result.tenants_count}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">—</span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  <strong>Statut global :</strong>{' '}
                  {result.ok && result.service_key_present && result.can_list_users
                    ? 'Configuration complète et fonctionnelle'
                    : 'Configuration incomplète ou problématique'}
                </p>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                Cliquez sur "Rafraîchir" pour lancer le diagnostic
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
