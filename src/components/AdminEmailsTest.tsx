import { useState, useEffect } from 'react';
import { Layout } from './Layout';
import { AlertCircle, CheckCircle, Loader2, Mail, Send } from 'lucide-react';

interface EnvCheckResponse {
  resend_api_key_present: boolean;
  vite_public_base_url: string;
}

interface EmailTestResponse {
  ok: boolean;
  message?: string;
  data?: {
    id: string;
  };
  error?: string;
}

export function AdminEmailsTest() {
  const [envCheck, setEnvCheck] = useState<EnvCheckResponse | null>(null);
  const [envCheckLoading, setEnvCheckLoading] = useState(true);
  const [envCheckError, setEnvCheckError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<EmailTestResponse | null>(null);

  useEffect(() => {
    checkEnv();
  }, []);

  async function checkEnv() {
    setEnvCheckLoading(true);
    setEnvCheckError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/env-check`;
      const headers = {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setEnvCheck(data);
    } catch (err) {
      setEnvCheckError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setEnvCheckLoading(false);
    }
  }

  async function handleSendTest() {
    if (!email.trim()) {
      setTestResult({
        ok: false,
        error: 'Veuillez saisir une adresse e-mail',
      });
      return;
    }

    setSending(true);
    setTestResult(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-test-email?to=${encodeURIComponent(email)}`;
      const headers = {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });
      const data = await response.json();

      if (response.ok) {
        setTestResult({
          ok: true,
          message: data.message || 'E-mail envoyé avec succès',
          data: data.data,
        });
      } else {
        setTestResult({
          ok: false,
          error: data.error || data.message || 'Erreur lors de l\'envoi',
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              Tests e-mails (Environnement Resend)
            </h1>
            <p className="text-slate-600 mt-2">
              Testez l'envoi d'e-mails via Resend et vérifiez la configuration.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Diagnostic Resend</h2>

            {envCheckLoading && (
              <div
                data-testid="resend-diagnostic"
                className="flex items-center gap-2 text-slate-600"
              >
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Vérification en cours...</span>
              </div>
            )}

            {envCheckError && (
              <div
                data-testid="resend-diagnostic"
                className="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Erreur de vérification</p>
                    <p className="text-red-700 text-sm mt-1">{envCheckError}</p>
                  </div>
                </div>
              </div>
            )}

            {envCheck && (
              <div data-testid="resend-diagnostic" className="space-y-3">
                <div className="flex items-center gap-3">
                  {envCheck.resend_api_key_present ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-900 font-medium">RESEND_API_KEY configurée</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-900 font-medium">RESEND_API_KEY manquante</span>
                    </>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-900 font-medium">Base URL publique détectée</p>
                    <p className="text-slate-600 text-sm mt-1 font-mono bg-slate-50 px-2 py-1 rounded">
                      {envCheck.vite_public_base_url || 'Non définie'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Envoyer un e-mail de test</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="test-email" className="block text-sm font-medium text-slate-700 mb-2">
                  Destinataire du test
                </label>
                <input
                  id="test-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={sending}
                />
              </div>

              <button
                data-testid="resend-send-btn"
                onClick={handleSendTest}
                disabled={sending || !email.trim()}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Envoi en cours...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Envoyer un e-mail de test</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                data-testid="resend-result"
                className={`mt-6 rounded-lg p-4 border ${
                  testResult.ok
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.ok ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${testResult.ok ? 'text-green-900' : 'text-red-900'}`}>
                      {testResult.ok ? 'Succès' : 'Échec'}
                    </p>
                    {testResult.message && (
                      <p className={`text-sm mt-1 ${testResult.ok ? 'text-green-700' : 'text-red-700'}`}>
                        {testResult.message}
                      </p>
                    )}
                    {testResult.error && (
                      <p className="text-sm mt-1 text-red-700">{testResult.error}</p>
                    )}
                    {testResult.data?.id && (
                      <div className="mt-2">
                        <p className="text-sm text-green-700">ID de l'e-mail:</p>
                        <p className="text-sm font-mono bg-white px-2 py-1 rounded mt-1 text-slate-900">
                          {testResult.data.id}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
