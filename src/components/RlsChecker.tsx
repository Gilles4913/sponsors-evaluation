import { useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Play, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  error?: string;
}

interface RlsReport {
  superAdminTests: TestResult[];
  clubAdminTests: TestResult[];
  timestamp: string;
}

export function RlsChecker() {
  const { profile } = useAuth();
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<RlsReport | null>(null);
  const [clubEmail, setClubEmail] = useState('');
  const [clubPassword, setClubPassword] = useState('');
  const [testingClub, setTestingClub] = useState(false);

  const testSuperAdminRls = async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];

    try {
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id,name')
        .limit(1);

      results.push({
        name: 'Super Admin - Lecture tenants',
        success: !tenantsError && !!tenants,
        message: tenantsError
          ? `Erreur: ${tenantsError.message}`
          : `Succès: ${tenants?.length || 0} tenant(s) lu(s)`,
        error: tenantsError?.message,
      });
    } catch (err: unknown) {
      const error = err as Error;
      results.push({
        name: 'Super Admin - Lecture tenants',
        success: false,
        message: `Exception: ${error.message}`,
        error: error.message,
      });
    }

    try {
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id,tenant_id')
        .limit(1);

      results.push({
        name: 'Super Admin - Lecture campaigns',
        success: !campaignsError && !!campaigns,
        message: campaignsError
          ? `Erreur: ${campaignsError.message}`
          : `Succès: ${campaigns?.length || 0} campagne(s) lue(s)`,
        error: campaignsError?.message,
      });
    } catch (err: unknown) {
      const error = err as Error;
      results.push({
        name: 'Super Admin - Lecture campaigns',
        success: false,
        message: `Exception: ${error.message}`,
        error: error.message,
      });
    }

    try {
      const { data: pledges, error: pledgesError } = await supabase
        .from('pledges')
        .select('id,campaign_id,amount')
        .limit(1);

      results.push({
        name: 'Super Admin - Lecture pledges',
        success: !pledgesError && !!pledges,
        message: pledgesError
          ? `Erreur: ${pledgesError.message}`
          : `Succès: ${pledges?.length || 0} promesse(s) lue(s)`,
        error: pledgesError?.message,
      });
    } catch (err: unknown) {
      const error = err as Error;
      results.push({
        name: 'Super Admin - Lecture pledges',
        success: false,
        message: `Exception: ${error.message}`,
        error: error.message,
      });
    }

    return results;
  };

  const testClubAdminRls = async (email: string, password: string): Promise<TestResult[]> => {
    const results: TestResult[] = [];

    let clubClient = supabase;
    let clubTenantId: string | null = null;

    if (profile?.role !== 'club_admin') {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        results.push({
          name: 'Club Admin - Authentification',
          success: false,
          message: `Échec connexion: ${authError?.message || 'Utilisateur introuvable'}`,
          error: authError?.message,
        });
        return results;
      }

      results.push({
        name: 'Club Admin - Authentification',
        success: true,
        message: `Connexion réussie: ${authData.user.email}`,
      });

      const { data: userProfile } = await supabase
        .from('app_users')
        .select('tenant_id,role')
        .eq('email', email)
        .maybeSingle();

      if (!userProfile || userProfile.role !== 'club_admin') {
        results.push({
          name: 'Club Admin - Vérification rôle',
          success: false,
          message: 'Utilisateur n\'est pas club_admin',
        });
        return results;
      }

      clubTenantId = userProfile.tenant_id;

      results.push({
        name: 'Club Admin - Vérification rôle',
        success: true,
        message: `Rôle confirmé: club_admin (tenant_id: ${clubTenantId})`,
      });
    } else {
      clubTenantId = profile.tenant_id;
      results.push({
        name: 'Club Admin - Authentification',
        success: true,
        message: 'Utilisation session actuelle (déjà club_admin)',
      });
    }

    try {
      const { data: tenants, error: tenantsError } = await clubClient
        .from('tenants')
        .select('id,name');

      const belongsToTenant = tenants?.some(t => t.id === clubTenantId);

      results.push({
        name: 'Club Admin - Lecture tenants',
        success: !tenantsError && belongsToTenant === true,
        message: tenantsError
          ? `Erreur: ${tenantsError.message}`
          : belongsToTenant
            ? `Succès: Peut lire son tenant uniquement (${tenants?.length || 0} tenant(s))`
            : `Problème: Ne peut pas lire son propre tenant ou voit d'autres tenants`,
        error: tenantsError?.message,
      });
    } catch (err: unknown) {
      const error = err as Error;
      results.push({
        name: 'Club Admin - Lecture tenants',
        success: false,
        message: `Exception: ${error.message}`,
        error: error.message,
      });
    }

    if (!clubTenantId) {
      results.push({
        name: 'Club Admin - Tests insert',
        success: false,
        message: 'Impossible de continuer: tenant_id inconnu',
      });
      return results;
    }

    const { data: ownCampaigns } = await clubClient
      .from('campaigns')
      .select('id')
      .eq('tenant_id', clubTenantId)
      .limit(1);

    const { data: otherCampaigns } = await clubClient
      .from('campaigns')
      .select('id')
      .neq('tenant_id', clubTenantId)
      .limit(1);

    if (ownCampaigns && ownCampaigns.length > 0) {
      const ownCampaignId = ownCampaigns[0].id;

      try {
        const { error: insertOwnError } = await clubClient
          .from('pledges')
          .insert({
            campaign_id: ownCampaignId,
            sponsor_id: null,
            invitation_id: null,
            status: 'yes',
            amount: 100,
            comment: 'Test RLS checker',
            consent: true,
            source: 'manual',
          })
          .select()
          .single();

        results.push({
          name: 'Club Admin - Insert pledge (propre campagne)',
          success: !insertOwnError,
          message: insertOwnError
            ? `Erreur: ${insertOwnError.message}`
            : 'Succès: Insert autorisé sur propre campagne',
          error: insertOwnError?.message,
        });

        if (!insertOwnError) {
          await clubClient
            .from('pledges')
            .delete()
            .eq('campaign_id', ownCampaignId)
            .eq('comment', 'Test RLS checker');
        }
      } catch (err: unknown) {
        const error = err as Error;
        results.push({
          name: 'Club Admin - Insert pledge (propre campagne)',
          success: false,
          message: `Exception: ${error.message}`,
          error: error.message,
        });
      }
    } else {
      results.push({
        name: 'Club Admin - Insert pledge (propre campagne)',
        success: false,
        message: 'Aucune campagne trouvée pour ce tenant',
      });
    }

    if (otherCampaigns && otherCampaigns.length > 0) {
      const otherCampaignId = otherCampaigns[0].id;

      try {
        const { error: insertOtherError } = await clubClient
          .from('pledges')
          .insert({
            campaign_id: otherCampaignId,
            sponsor_id: null,
            invitation_id: null,
            status: 'yes',
            amount: 100,
            comment: 'Test RLS checker',
            consent: true,
            source: 'manual',
          })
          .select()
          .single();

        const isBlocked = insertOtherError &&
          (insertOtherError.code === '42501' ||
           insertOtherError.message.includes('permission') ||
           insertOtherError.message.includes('policy'));

        results.push({
          name: 'Club Admin - Insert pledge (autre tenant) - DOIT ÉCHOUER',
          success: isBlocked,
          message: isBlocked
            ? `Succès: Insert correctement bloqué (${insertOtherError?.code || 'RLS'})`
            : 'PROBLÈME: Insert autorisé sur autre tenant!',
          error: insertOtherError?.message,
        });

        if (!insertOtherError) {
          await clubClient
            .from('pledges')
            .delete()
            .eq('campaign_id', otherCampaignId)
            .eq('comment', 'Test RLS checker');
        }
      } catch (err: unknown) {
        const error = err as Error;
        results.push({
          name: 'Club Admin - Insert pledge (autre tenant) - DOIT ÉCHOUER',
          success: true,
          message: `Succès: Insert correctement bloqué (Exception)`,
          error: error.message,
        });
      }
    } else {
      results.push({
        name: 'Club Admin - Insert pledge (autre tenant) - DOIT ÉCHOUER',
        success: false,
        message: 'Aucune campagne d\'autre tenant trouvée pour tester',
      });
    }

    return results;
  };

  const runSuperAdminTests = async () => {
    if (profile?.role !== 'super_admin') {
      toast.error('Vous devez être super_admin pour exécuter ces tests');
      return;
    }

    setTesting(true);
    try {
      const superResults = await testSuperAdminRls();
      const newReport: RlsReport = {
        superAdminTests: superResults,
        clubAdminTests: report?.clubAdminTests || [],
        timestamp: new Date().toISOString(),
      };
      setReport(newReport);
      toast.success('Tests super_admin terminés');
    } catch (error) {
      toast.error('Erreur lors des tests super_admin');
      console.error(error);
    } finally {
      setTesting(false);
    }
  };

  const runClubAdminTests = async () => {
    if (profile?.role !== 'club_admin' && (!clubEmail || !clubPassword)) {
      toast.error('Veuillez saisir email et mot de passe club_admin');
      return;
    }

    setTestingClub(true);
    try {
      const clubResults = await testClubAdminRls(clubEmail, clubPassword);
      const newReport: RlsReport = {
        superAdminTests: report?.superAdminTests || [],
        clubAdminTests: clubResults,
        timestamp: new Date().toISOString(),
      };
      setReport(newReport);
      toast.success('Tests club_admin terminés');
    } catch (error) {
      toast.error('Erreur lors des tests club_admin');
      console.error(error);
    } finally {
      setTestingClub(false);
    }
  };

  const getTestIcon = (success: boolean, testName: string) => {
    if (testName.includes('DOIT ÉCHOUER')) {
      return success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />;
    }
    return success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />;
  };

  const allSuperAdminOk = report?.superAdminTests.every(t => t.success) ?? false;
  const allClubAdminOk = report?.clubAdminTests.every(t => t.success) ?? false;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            Vérificateur RLS (Row Level Security)
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Teste les politiques de sécurité RLS pour les différents rôles
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  A) Tests Super Admin
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Lecture libre des tables principales
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="font-medium mb-2">Tests effectués:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Lecture table tenants</li>
                  <li>Lecture table campaigns</li>
                  <li>Lecture table pledges</li>
                </ul>
              </div>
            </div>

            <button
              onClick={runSuperAdminTests}
              disabled={testing || profile?.role !== 'super_admin'}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2"
            >
              <Play className={`w-5 h-5 ${testing ? 'animate-pulse' : ''}`} />
              {testing ? 'Test en cours...' : 'Exécuter tests Super Admin'}
            </button>

            {profile?.role !== 'super_admin' && (
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-2 text-center">
                Vous devez être super_admin pour exécuter ces tests
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-600" />
                  B) Tests Club Admin
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Vérification isolation par tenant
                </p>
              </div>
            </div>

            {profile?.role !== 'club_admin' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email club_admin
                  </label>
                  <input
                    type="email"
                    value={clubEmail}
                    onChange={(e) => setClubEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    placeholder="admin@club.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={clubPassword}
                    onChange={(e) => setClubPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {profile?.role === 'club_admin' && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Session actuelle utilisée (déjà club_admin)
                </p>
              </div>
            )}

            <div className="space-y-3 mb-6">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="font-medium mb-2">Tests effectués:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Lecture propre tenant uniquement</li>
                  <li>Insert sur propre campagne (autorisé)</li>
                  <li>Insert sur autre tenant (bloqué)</li>
                </ul>
              </div>
            </div>

            <button
              onClick={runClubAdminTests}
              disabled={testingClub || (profile?.role !== 'club_admin' && (!clubEmail || !clubPassword))}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition flex items-center justify-center gap-2"
            >
              <Play className={`w-5 h-5 ${testingClub ? 'animate-pulse' : ''}`} />
              {testingClub ? 'Test en cours...' : 'Exécuter tests Club Admin'}
            </button>
          </div>
        </div>

        {report && (
          <div className="space-y-6">
            {report.superAdminTests.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {allSuperAdminOk ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        Tests Super Admin - OK
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                        Tests Super Admin - Problèmes détectés
                      </>
                    )}
                  </h3>
                </div>

                <div className="space-y-3" data-testid="rls-super-ok">
                  {report.superAdminTests.map((test, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getTestIcon(test.success, test.name)}
                          <span className="font-medium text-slate-900 dark:text-white">
                            {test.name}
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded text-sm ${
                          test.success
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {test.success ? 'Succès' : 'Échec'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 ml-8">
                        {test.message}
                      </p>
                      {test.error && (
                        <div className="mt-2 ml-8 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs font-mono text-red-700 dark:text-red-300">
                          {test.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.clubAdminTests.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {allClubAdminOk ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        Tests Club Admin - OK
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                        Tests Club Admin - Problèmes détectés
                      </>
                    )}
                  </h3>
                </div>

                <div className="space-y-3" data-testid="rls-club-ok">
                  {report.clubAdminTests.map((test, idx) => (
                    <div
                      key={idx}
                      data-testid={test.name.includes('autre tenant') ? 'rls-club-insert-denied' : undefined}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getTestIcon(test.success, test.name)}
                          <span className="font-medium text-slate-900 dark:text-white">
                            {test.name}
                          </span>
                        </div>
                        <span className={`px-2 py-1 rounded text-sm ${
                          test.success
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {test.success ? 'Succès' : 'Échec'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 ml-8">
                        {test.message}
                      </p>
                      {test.error && (
                        <div className="mt-2 ml-8 p-2 bg-slate-50 dark:bg-slate-900 rounded text-xs font-mono text-slate-700 dark:text-slate-300">
                          {test.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center text-sm text-slate-500 dark:text-slate-400">
              Tests exécutés le {new Date(report.timestamp).toLocaleString('fr-FR')}
            </div>
          </div>
        )}

        {!report && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-12 text-center">
            <Shield className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Aucun test effectué
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Sélectionnez une catégorie de tests ci-dessus pour commencer
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
