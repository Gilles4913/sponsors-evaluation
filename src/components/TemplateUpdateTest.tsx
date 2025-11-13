import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Play } from 'lucide-react';

export function TemplateUpdateTest() {
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: number;
    error: any;
    data: any;
  } | null>(null);

  const handleTest = async () => {
    if (!templateId.trim()) {
      alert('Veuillez entrer un ID de template');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error, status } = await supabase
        .from('email_templates')
        .update({ subject: '[TEST] ' + Date.now() })
        .eq('id', templateId)
        .select('id');

      console.log('status', status, 'error', error, 'data', data);

      setResult({ status, error, data });
    } catch (e) {
      console.error('Caught exception:', e);
      setResult({
        status: 0,
        error: e,
        data: null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          Test de mise à jour de template
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              ID du template
            </label>
            <input
              type="text"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="Entrez l'ID du template"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Test en cours...' : 'Lancer le test'}
          </button>
        </div>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              {result.error ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {result.error ? 'Erreur' : 'Succès'}
              </h3>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-3">
              <div>
                <strong className="text-slate-700 dark:text-slate-300">Status:</strong>
                <code className="ml-2 px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded text-sm font-mono">
                  {result.status}
                </code>
              </div>

              {result.error && (
                <div>
                  <strong className="text-slate-700 dark:text-slate-300">Error:</strong>
                  <pre className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs overflow-auto">
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                </div>
              )}

              {result.data && (
                <div>
                  <strong className="text-slate-700 dark:text-slate-300">Data:</strong>
                  <pre className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <details className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <summary className="cursor-pointer font-medium text-slate-900 dark:text-white">
                Console Output
              </summary>
              <pre className="mt-3 p-3 bg-slate-100 dark:bg-slate-950 rounded text-xs overflow-auto">
                {`status ${result.status}\nerror ${JSON.stringify(result.error, null, 2)}\ndata ${JSON.stringify(result.data, null, 2)}`}
              </pre>
            </details>
          </div>
        )}
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-400 mb-2">
          Instructions
        </h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
          <li>Entrez l'ID d'un template existant</li>
          <li>Cliquez sur "Lancer le test"</li>
          <li>Le test mettra à jour uniquement le champ subject avec [TEST] + timestamp</li>
          <li>Vérifiez le status, error et data retournés</li>
          <li>Consultez aussi la console du navigateur</li>
        </ol>
      </div>
    </div>
  );
}
