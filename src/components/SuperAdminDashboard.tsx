import { useState, useEffect } from 'react';
import { Building2, Target, Users, Plus, TrendingUp, Mail, Search, CheckCircle, XCircle, Database as DatabaseIcon, ShieldCheck, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';
import type { Database } from '../lib/database.types';

type Tenant = Database['public']['Tables']['tenants']['Row'];

interface TenantWithStats extends Tenant {
  campaigns_count?: number;
  pledges_count?: number;
  total_pledged?: number;
}

interface Stats {
  totalTenants: number;
  totalCampaigns: number;
  totalPledges: number;
  totalPledgedAmount: number;
}

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<TenantWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<Stats>({
    totalTenants: 0,
    totalCampaigns: 0,
    totalPledges: 0,
    totalPledgedAmount: 0,
  });
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [newTenant, setNewTenant] = useState({
    name: '',
    email_contact: '',
    logo_url: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTenants(tenants);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = tenants.filter(
        (tenant) =>
          tenant.name.toLowerCase().includes(query) ||
          tenant.email_contact.toLowerCase().includes(query)
      );
      setFilteredTenants(filtered);
    }
  }, [searchQuery, tenants]);

  const fetchData = async () => {
    setLoading(true);

    try {
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      if (tenantsData) {
        const tenantsWithStats = await Promise.all(
          tenantsData.map(async (tenant) => {
            const { data: campaigns } = await supabase
              .from('campaigns')
              .select('id')
              .eq('tenant_id', tenant.id);

            const { data: pledges } = await supabase
              .from('pledges')
              .select('amount')
              .in(
                'campaign_id',
                campaigns?.map((c) => c.id) || []
              );

            const totalPledged = pledges?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

            return {
              ...tenant,
              campaigns_count: campaigns?.length || 0,
              pledges_count: pledges?.length || 0,
              total_pledged: totalPledged,
            };
          })
        );

        setTenants(tenantsWithStats);

        const { data: campaignsData } = await supabase.from('campaigns').select('id');

        const { data: pledgesData } = await supabase.from('pledges').select('amount');

        const totalAmount = pledgesData?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

        setStats({
          totalTenants: tenantsData.length,
          totalCampaigns: campaignsData?.length || 0,
          totalPledges: pledgesData?.length || 0,
          totalPledgedAmount: totalAmount,
        });
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des données: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTenant.name.trim()) {
      toast.error('Le nom du club est requis');
      return;
    }

    if (!newTenant.email_contact.trim()) {
      toast.error("L'email de contact est requis");
      return;
    }

    if (!newTenant.admin_email.trim()) {
      toast.error("L'email de l'administrateur est requis");
      return;
    }

    if (!newTenant.admin_password || newTenant.admin_password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setCreating(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newTenant.admin_email,
        password: newTenant.admin_password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Erreur lors de la création du compte');
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: newTenant.name,
          email_contact: newTenant.email_contact,
          logo_url: newTenant.logo_url || null,
          status: 'active',
        })
        .select()
        .single();

      if (tenantError) throw tenantError;

      const { error: userError } = await supabase.from('app_users').insert({
        id: authData.user.id,
        email: newTenant.admin_email,
        name: newTenant.admin_name || newTenant.admin_email,
        role: 'club_admin',
        tenant_id: tenantData.id,
      });

      if (userError) throw userError;

      toast.success(`Club "${newTenant.name}" créé avec succès`);

      setNewTenant({
        name: '',
        email_contact: '',
        logo_url: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
      });
      setShowCreateTenant(false);

      fetchData();
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error('Erreur: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le club "${tenantName}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('tenants').delete().eq('id', tenantId);

      if (error) throw error;

      toast.success(`Club "${tenantName}" supprimé avec succès`);
      fetchData();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600 dark:text-slate-400">Chargement...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Vue d'ensemble de tous les clubs
            </p>
          </div>
          <div className="flex gap-3">
            {profile?.role === 'super_admin' && (
              <>
                <button
                  onClick={() => window.location.href = '/admin/clubs'}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg transition"
                >
                  <Building2 className="w-4 h-4" />
                  <span className="font-medium">Clubs (admin)</span>
                </button>
                <button
                  data-testid="dashboard-btn-email-test"
                  onClick={() => window.location.href = '/admin/emails-test'}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span className="font-medium">Tests e-mails</span>
                </button>
              </>
            )}
            <button
              onClick={() => window.location.href = '/auth-test'}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="font-medium">Auth Test</span>
            </button>
            <button
              onClick={() => window.location.href = '/db-diagnostics'}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition"
            >
              <DatabaseIcon className="w-4 h-4" />
              <span className="font-medium">DB Diagnostics</span>
            </button>
            <button
              onClick={() => window.location.href = '/emails/templates'}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition"
            >
              <Mail className="w-4 h-4" />
              <span className="font-medium">Templates E-mails</span>
            </button>
            <button
              onClick={() => setShowCreateTenant(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">Créer un club</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Clubs</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.totalTenants}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Campagnes</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.totalCampaigns}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-lg">
                <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Réponses</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.totalPledges}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Promesses</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.totalPledgedAmount.toLocaleString('fr-FR')}€
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Liste des clubs
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {filteredTenants.length} club(s)
                </p>
              </div>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {filteredTenants.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                {searchQuery ? 'Aucun club trouvé' : 'Aucun club créé'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Club
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Campagnes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Réponses
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Montant promis
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredTenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {tenant.logo_url ? (
                            <img
                              src={tenant.logo_url}
                              alt={tenant.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white font-bold">
                              {tenant.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {tenant.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(tenant.created_at || '').toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-slate-900 dark:text-white">
                          {tenant.email_contact}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {tenant.campaigns_count || 0}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {tenant.pledges_count || 0}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {(tenant.total_pledged || 0).toLocaleString('fr-FR')}€
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tenant.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                            <XCircle className="w-3 h-3" />
                            Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                          className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium transition"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCreateTenant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Créer un nouveau club
            </h2>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nom du club *
                </label>
                <input
                  type="text"
                  required
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="Ex: FC Paris"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email de contact *
                </label>
                <input
                  type="email"
                  required
                  value={newTenant.email_contact}
                  onChange={(e) => setNewTenant({ ...newTenant, email_contact: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="contact@fcparis.fr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL du logo
                </label>
                <input
                  type="url"
                  value={newTenant.logo_url}
                  onChange={(e) => setNewTenant({ ...newTenant, logo_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Compte administrateur
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nom de l'administrateur
                    </label>
                    <input
                      type="text"
                      value={newTenant.admin_name}
                      onChange={(e) => setNewTenant({ ...newTenant, admin_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="Jean Dupont"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email administrateur *
                    </label>
                    <input
                      type="email"
                      required
                      value={newTenant.admin_email}
                      onChange={(e) =>
                        setNewTenant({ ...newTenant, admin_email: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="admin@fcparis.fr"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mot de passe * (min. 6 caractères)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newTenant.admin_password}
                      onChange={(e) =>
                        setNewTenant({ ...newTenant, admin_password: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateTenant(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium"
                  disabled={creating}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Création...' : 'Créer le club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}
