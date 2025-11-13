import { useState, FormEvent } from 'react';
import { Building2, ArrowLeft, Loader2, CheckCircle, Eye, List, Mail, RefreshCw } from 'lucide-react';
import { Layout } from './Layout';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { supabase } from '../lib/supabase';

export function AdminClubsNew() {
  const navigate = (path: string) => {
    window.location.href = path;
  };
  const toast = useToast();
  const { setAsTenantId } = useAsTenant();

  const [name, setName] = useState('');
  const [emailContact, setEmailContact] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; tenant_id?: string; message?: string; admin_email?: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !adminEmail.trim()) {
      toast.error('Le nom du club et l\'email administrateur sont requis');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/create-club', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name,
          email_contact: emailContact || null,
          admin_email: adminEmail,
          phone: phone || null,
          address: address || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ ok: false, message: data.message || 'Erreur lors de la création du club' });
        toast.error(data.message || 'Erreur lors de la création du club');
      } else {
        setResult({
          ok: true,
          tenant_id: data.tenant_id,
          message: 'Club créé avec succès!',
          admin_email: adminEmail
        });
        toast.success('Club créé avec succès!');
      }
    } catch (error: any) {
      console.error('Error creating club:', error);
      setResult({ ok: false, message: error.message || 'Erreur réseau' });
      toast.error('Erreur lors de la création du club');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAsClub = () => {
    if (result?.tenant_id) {
      setAsTenantId(result.tenant_id);
      navigate('/dashboard');
    }
  };

  const handleGoToList = () => {
    navigate('/admin/clubs');
  };

  const handleResendInvite = async () => {
    if (!result?.admin_email) return;

    setResendingInvite(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        setResendingInvite(false);
        return;
      }

      const response = await fetch('/api/admin/resend-invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_email: result.admin_email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Erreur lors du renvoi de l\'invitation');
      } else {
        toast.success('Invitation renvoyée avec succès!');
      }
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast.error('Erreur lors du renvoi de l\'invitation');
    } finally {
      setResendingInvite(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        <button
          onClick={() => navigate('/admin/clubs')}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="border-b border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Créer un nouveau club
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Créez un club et son compte administrateur
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} data-testid="create-club-form" className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Nom du club <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="FC Saumur"
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email de contact
              </label>
              <input
                type="email"
                value={emailContact}
                onChange={(e) => setEmailContact(e.target.value)}
                placeholder="contact@fcsaumur.fr"
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email administrateur <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="president@fcsaumur.fr"
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Un email d'activation sera envoyé à cette adresse
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Téléphone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 11 22 33 44"
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Adresse
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Stade XYZ, 49400 Saumur"
                rows={3}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {result && result.ok && (
              <div data-testid="result-ok" className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Club créé avec succès!
                  </p>
                </div>

                <div className="flex items-start gap-2 text-sm text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/50 p-3 rounded-lg">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p>
                      Un e-mail d'invitation a été envoyé à <strong>{result.admin_email}</strong>. L'administrateur doit définir son mot de passe depuis cet e-mail.
                    </p>
                    <p className="text-xs">
                      Si l'e-mail n'arrive pas : vérifier les spams et/ou renvoyer l'invitation.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleViewAsClub}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Voir en tant que ce club
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToList}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    <List className="w-4 h-4" />
                    Aller à la liste des clubs
                  </button>
                  <button
                    type="button"
                    onClick={handleResendInvite}
                    disabled={resendingInvite}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    {resendingInvite ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Renvoyer l'invitation
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {result && !result.ok && (
              <div data-testid="result-error" className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-900 dark:text-red-100">
                  <strong>Erreur :</strong> {result.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                data-testid="btn-create-club"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Building2 className="w-5 h-5" />
                    Créer le club
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
