import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Eye,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';
import type { Database } from '../lib/database.types';

type Tenant = Database['public']['Tables']['tenants']['Row'];

interface TenantWithStats extends Tenant {
  campaigns_count?: number;
}

const ITEMS_PER_PAGE = 20;

export function SuperAdminClubs() {
  const toast = useToast();
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
  });
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Tenant>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newTenant, setNewTenant] = useState({
    name: '',
    email_contact: '',
    logo_url: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  useEffect(() => {
    fetchTenants();
  }, [debouncedSearchQuery, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);

      const params = new URLSearchParams(window.location.search);
      if (searchQuery) {
        params.set('q', searchQuery);
      } else {
        params.delete('q');
      }
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tenants')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (debouncedSearchQuery.trim()) {
        query = query.or(
          `name.ilike.%${debouncedSearchQuery}%,email_contact.ilike.%${debouncedSearchQuery}%`
        );
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data: tenantsData, error: tenantsError, count } = await query.range(from, to);

      if (tenantsError) throw tenantsError;

      if (tenantsData) {
        const tenantsWithStats = await Promise.all(
          tenantsData.map(async (tenant) => {
            const { data: campaigns } = await supabase
              .from('campaigns')
              .select('id')
              .eq('tenant_id', tenant.id);

            return {
              ...tenant,
              campaigns_count: campaigns?.length || 0,
            };
          })
        );

        setTenants(tenantsWithStats);
        setTotalCount(count || 0);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement: ' + error.message);
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

    setSaving(true);

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
      setShowCreateModal(false);

      fetchTenants();
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tenant: TenantWithStats) => {
    setEditingId(tenant.id);
    setEditForm({
      name: tenant.name,
      email_contact: tenant.email_contact,
      logo_url: tenant.logo_url || '',
    });
  };

  const handleSaveEdit = async (tenantId: string) => {
    if (!editForm.name?.trim()) {
      toast.error('Le nom du club est requis');
      return;
    }

    if (!editForm.email_contact?.trim()) {
      toast.error("L'email de contact est requis");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: editForm.name,
          email_contact: editForm.email_contact,
          logo_url: editForm.logo_url || null,
        })
        .eq('id', tenantId);

      if (error) throw error;

      toast.success('Club modifié avec succès');
      setEditingId(null);
      fetchTenants();
    } catch (error: any) {
      toast.error('Erreur lors de la modification: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string, tenantName: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activé' : 'suspendu';

    try {
      const { error } = await supabase
        .from('tenants')
        .update({ status: newStatus })
        .eq('id', tenantId);

      if (error) throw error;

      toast.success(`Club "${tenantName}" ${action} avec succès`);
      fetchTenants();
    } catch (error: any) {
      toast.error('Erreur lors du changement de statut: ' + error.message);
    }
  };

  const handleDelete = async (tenantId: string, tenantName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le club "${tenantName}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('tenants').delete().eq('id', tenantId);

      if (error) throw error;

      toast.success(`Club "${tenantName}" supprimé avec succès`);
      fetchTenants();
    } catch (error: any) {
      toast.error('Erreur lors de la suppression: ' + error.message);
    }
  };

  const handleViewAsClub = (tenantId: string) => {
    localStorage.setItem('as_tenant_id', tenantId);
    window.location.href = `/club/dashboard?asTenant=${tenantId}`;
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalCount);

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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion des clubs</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {totalCount} club(s) au total
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">Créer un club</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md" role="search">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  data-testid="sa-club-search"
                  placeholder="Rechercher par nom ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setDebouncedSearchQuery(searchQuery);
                      setCurrentPage(1);
                    }
                  }}
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Rechercher un club"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    aria-label="Effacer la recherche"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {debouncedSearchQuery && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-sm font-medium">
                    {totalCount} résultat{totalCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {tenants.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                {searchQuery ? 'Aucun club trouvé' : 'Aucun club créé'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Club
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Email contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Date création
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Campagnes
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {tenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
                      >
                        {editingId === tenant.id ? (
                          <>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={editForm.name || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, name: e.target.value })
                                }
                                className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                                placeholder="Nom du club"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="email"
                                value={editForm.email_contact || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, email_contact: e.target.value })
                                }
                                className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                                placeholder="Email"
                              />
                            </td>
                            <td className="px-6 py-4" colSpan={3}>
                              <input
                                type="url"
                                value={editForm.logo_url || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, logo_url: e.target.value })
                                }
                                className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                                placeholder="URL du logo (optionnel)"
                              />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleSaveEdit(tenant.id)}
                                  disabled={saving}
                                  className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition disabled:opacity-50"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={saving}
                                  className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-50"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
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
                                    ID: {tenant.id.substring(0, 8)}...
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
                              {tenant.status === 'active' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                                  <CheckCircle className="w-3 h-3" />
                                  Actif
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400">
                                  <Pause className="w-3 h-3" />
                                  Suspendu
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-sm text-slate-900 dark:text-white">
                                {new Date(tenant.created_at || '').toLocaleDateString('fr-FR')}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {tenant.campaigns_count || 0}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleViewAsClub(tenant.id)}
                                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition"
                                  title="Voir comme ce club"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEdit(tenant)}
                                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
                                  title="Éditer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleToggleStatus(tenant.id, tenant.status, tenant.name)
                                  }
                                  className={`p-1.5 rounded transition ${
                                    tenant.status === 'active'
                                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                                      : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
                                  }`}
                                  title={
                                    tenant.status === 'active' ? 'Suspendre' : 'Activer'
                                  }
                                >
                                  {tenant.status === 'active' ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDelete(tenant.id, tenant.name)}
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                                  title="Supprimer"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Page {currentPage} sur {totalPages} ({startIndex + 1}-
                      {endIndex} sur {totalCount})
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      </button>
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCreateModal && (
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
                  onChange={(e) =>
                    setNewTenant({ ...newTenant, email_contact: e.target.value })
                  }
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
                  Inviter un administrateur
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nom de l'administrateur
                    </label>
                    <input
                      type="text"
                      value={newTenant.admin_name}
                      onChange={(e) =>
                        setNewTenant({ ...newTenant, admin_name: e.target.value })
                      }
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
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium"
                  disabled={saving}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Création...' : 'Créer le club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
