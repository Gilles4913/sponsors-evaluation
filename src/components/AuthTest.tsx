import { useState } from 'react';
import { Layout } from './Layout';
import { supabase } from '../lib/supabase';
import { loadTemplatesFlex } from '../lib/templatesFlex';
import { CheckCircle, XCircle, User, Database, Mail } from 'lucide-react';

export function AuthTest() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginError, setLoginError] = useState<string>('');
  const [templatesResult, setTemplatesResult] = useState<any>(null);
  const [tenantsTest, setTenantsTest] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setCurrentUser(null);
    } else {
      setCurrentUser(data.user);
    }
  };

  useState(() => {
    refreshUser();
  });

  const handleLogin = async () => {
    setLoading(true);
    setLoginError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoginError(JSON.stringify(error, null, 2));
      } else {
        setCurrentUser(data.user);
        setEmail('');
        setPassword('');
      }
    } catch (err: any) {
      setLoginError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setLoginError('');
      setTemplatesResult(null);
      setTenantsTest(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestTemplates = async () => {
    setLoading(true);
    setTemplatesResult(null);
    try {
      const result = await loadTemplatesFlex(supabase);
      setTemplatesResult({
        mode: result.mode,
        rowCount: result.rows.length,
        rows: result.rows,
        error: result.error,
      });
    } catch (err: any) {
      setTemplatesResult({
        error: { message: err.message || String(err) },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestTenants = async () => {
    setLoading(true);
    setTenantsTest(null);
    try {
      const { data, error } = await supabase.from('tenants').select('id').limit(1);
      setTenantsTest({
        success: !error,
        data,
        error: error ? JSON.stringify(error, null, 2) : null,
      });
    } catch (err: any) {
      setTenantsTest({
        success: false,
        error: err.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Auth Test Lab</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Test authentication, permissions, and database queries
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Current User</h2>
          </div>

          {currentUser ? (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {currentUser.email}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    ID: {currentUser.id}
                  </p>
                  {currentUser.app_metadata?.role && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                      Role: {currentUser.app_metadata.role}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                data-testid="btn-logout"
                disabled={loading}
                className="w-full mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-medium disabled:opacity-50"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">No user logged in</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  data-testid="auth-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  data-testid="auth-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="••••••"
                />
              </div>

              <button
                onClick={handleLogin}
                data-testid="btn-login"
                disabled={loading || !email || !password}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Login'}
              </button>

              {loginError && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="text-xs font-mono text-red-800 dark:text-red-200 whitespace-pre-wrap">
                    {loginError}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Templates Test
            </h2>
          </div>

          <button
            onClick={handleTestTemplates}
            data-testid="btn-test-templates"
            disabled={loading}
            className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition font-medium disabled:opacity-50 mb-4"
          >
            Test Templates Maintenant
          </button>

          {templatesResult && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2">
              {templatesResult.error ? (
                <div className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                      Error loading templates
                    </p>
                    <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-600">
                      {JSON.stringify(templatesResult.error, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Mode: <span className="text-green-600 dark:text-green-400">{templatesResult.mode}</span>
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Rows loaded: <span className="font-semibold">{templatesResult.rowCount}</span>
                    </p>
                    {templatesResult.rows && templatesResult.rows.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                          Sample rows:
                        </p>
                        <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-600 max-h-64 overflow-y-auto">
                          {JSON.stringify(templatesResult.rows.slice(0, 3), null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              RLS Test (Tenants)
            </h2>
          </div>

          <button
            onClick={handleTestTenants}
            disabled={loading}
            className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition font-medium disabled:opacity-50 mb-4"
          >
            Test Tenants Query
          </button>

          {tenantsTest && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                {tenantsTest.success ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Query successful
                      </p>
                      <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-600 mt-2">
                        {JSON.stringify(tenantsTest.data, null, 2)}
                      </pre>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                        Query blocked or failed
                      </p>
                      <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-600">
                        {tenantsTest.error}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
