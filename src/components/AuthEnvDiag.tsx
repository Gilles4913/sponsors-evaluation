import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthEnvDiag() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authResult, setAuthResult] = useState<any>(null);
  const [dbResult, setDbResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseUrlPreview = supabaseUrl ? supabaseUrl.substring(0, 12) + '...' : 'Non défini';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const anonKeyPreview = anonKey ? anonKey.substring(0, 12) + '...' : 'Non défini';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthResult(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthResult({
          success: false,
          error: {
            message: error.message,
            status: error.status,
            name: error.name,
            details: JSON.stringify(error, null, 2),
          },
        });
      } else {
        setAuthResult({
          success: true,
          data: {
            user_id: data.user?.id,
            user_email: data.user?.email,
            session_exists: !!data.session,
          },
        });
      }
    } catch (err: any) {
      setAuthResult({
        success: false,
        error: {
          message: err.message || 'Erreur inconnue',
          details: JSON.stringify(err, null, 2),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestDb = async () => {
    setLoading(true);
    setDbResult(null);

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .limit(1);

      if (error) {
        setDbResult({
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: JSON.stringify(error, null, 2),
          },
        });
      } else {
        setDbResult({
          success: true,
          data: data,
          count: data?.length || 0,
        });
      }
    } catch (err: any) {
      setDbResult({
        success: false,
        error: {
          message: err.message || 'Erreur inconnue',
          details: JSON.stringify(err, null, 2),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">
            Diagnostic Authentification & Environnement
          </h1>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-2">
                Variables d'environnement
              </h2>
              <div className="bg-slate-100 p-4 rounded space-y-2 font-mono text-sm">
                <div data-testid="env-url">
                  <span className="text-slate-600">VITE_SUPABASE_URL:</span>
                  <span className="ml-2 text-slate-900">{supabaseUrlPreview}</span>
                </div>
                <div data-testid="env-anon">
                  <span className="text-slate-600">VITE_SUPABASE_ANON_KEY:</span>
                  <span className="ml-2 text-slate-900">{anonKeyPreview}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">
            Test d'authentification
          </h2>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="exemple@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Test en cours...' : 'Tester la connexion'}
            </button>
          </form>

          {authResult && (
            <div
              data-testid="auth-result"
              className={`mt-4 p-4 rounded-lg ${authResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
            >
              <h3 className={`font-semibold mb-2 ${authResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {authResult.success ? 'Connexion réussie' : 'Erreur de connexion'}
              </h3>
              <pre className={`text-xs overflow-auto ${authResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {JSON.stringify(authResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">
            Test de requête base de données
          </h2>
          <button
            onClick={handleTestDb}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Test en cours...' : 'Tester SELECT tenants'}
          </button>

          {dbResult && (
            <div
              data-testid="db-ping"
              className={`mt-4 p-4 rounded-lg ${dbResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
            >
              <h3 className={`font-semibold mb-2 ${dbResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {dbResult.success ? `Requête réussie (${dbResult.count} résultat(s))` : 'Erreur de requête'}
              </h3>
              <pre className={`text-xs overflow-auto ${dbResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {JSON.stringify(dbResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Retour à l'application
          </a>
        </div>
      </div>
    </div>
  );
}
