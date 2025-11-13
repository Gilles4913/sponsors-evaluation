import { useState, useEffect, useRef } from 'react';
import { Users, Upload, Plus, Mail, Search, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';
import { InviteModal } from './InviteModal';
import { highlightText } from '../lib/highlightHelper';
import type { Database } from '../lib/database.types';

type Sponsor = Database['public']['Tables']['sponsors']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface SponsorWithResponses extends Sponsor {
  responses_count?: number;
}

const SEGMENT_LABELS = {
  or: 'Or',
  argent: 'Argent',
  bronze: 'Bronze',
  autre: 'Autre',
};

export function SponsorsList() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sponsors, setSponsors] = useState<SponsorWithResponses[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
  });
  const [filterSegment, setFilterSegment] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [showAddSponsor, setShowAddSponsor] = useState(false);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedSponsors, setSelectedSponsors] = useState<string[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importStats, setImportStats] = useState<{
    total: number;
    duplicates: number;
    errors: number;
  } | null>(null);

  const [newSponsor, setNewSponsor] = useState({
    company: '',
    contact_name: '',
    email: '',
    phone: '',
    segment: 'autre' as 'or' | 'argent' | 'bronze' | 'autre',
    notes: '',
  });

  useEffect(() => {
    fetchSponsors();
    fetchCampaigns();
  }, [debouncedSearchTerm, filterSegment, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);

      const params = new URLSearchParams(window.location.search);
      if (searchTerm) {
        params.set('q', searchTerm);
      } else {
        params.delete('q');
      }
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchSponsors = async () => {
    if (!effectiveTenantId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('sponsors')
        .select('*', { count: 'exact' })
        .eq('tenant_id', effectiveTenantId);

      if (debouncedSearchTerm) {
        const searchPattern = `%${debouncedSearchTerm}%`;
        query = query.or(
          `company.ilike.${searchPattern},contact_name.ilike.${searchPattern},email.ilike.${searchPattern}`
        );
      }

      if (filterSegment) {
        query = query.eq('segment', filterSegment);
      }

      const { data, error, count } = await query
        .order('company', { ascending: true })
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      if (error) throw error;

      setTotalCount(count || 0);

      if (data) {
        const sponsorsWithResponses = await Promise.all(
          data.map(async (sponsor) => {
            const { data: pledges } = await supabase
              .from('pledges')
              .select('id')
              .eq('sponsor_id', sponsor.id);

            return {
              ...sponsor,
              responses_count: pledges?.length || 0,
            };
          })
        );

        setSponsors(sponsorsWithResponses);
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    if (!profile?.tenant_id) return;

    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('tenant_id', effectiveTenantId)
      .order('created_at', { ascending: false });

    if (data) {
      setCampaigns(data);
    }
  };

  const handleAddSponsor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveTenantId) {
      toast.error('Impossible de créer un sponsor : tenant_id manquant');
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('sponsors')
        .select('id')
        .eq('tenant_id', effectiveTenantId)
        .eq('email', newSponsor.email)
        .maybeSingle();

      if (existing) {
        toast.error('Un sponsor avec cet email existe déjà');
        return;
      }

      const { error } = await supabase.from('sponsors').insert({
        tenant_id: effectiveTenantId,
        company: newSponsor.company.trim(),
        contact_name: newSponsor.contact_name.trim(),
        email: newSponsor.email.trim().toLowerCase(),
        phone: newSponsor.phone.trim() || null,
        segment: newSponsor.segment,
        notes: newSponsor.notes.trim() || null,
      });

      if (error) throw error;

      setNewSponsor({
        company: '',
        contact_name: '',
        email: '',
        phone: '',
        segment: 'autre',
        notes: '',
      });
      setShowAddSponsor(false);
      fetchSponsors();
      toast.success('Sponsor ajouté avec succès');
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      setCsvPreview(data.slice(0, 5));
    };

    reader.readAsText(file);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleImportCSV = async () => {
    if (!csvFile) return;

    if (!effectiveTenantId) {
      toast.error('Impossible d\'importer des sponsors : tenant_id manquant');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);

      let imported = 0;
      let duplicates = 0;
      let errors = 0;

      for (const row of data) {
        try {
          const email = (
            row.email ||
            row.mail ||
            row['e-mail'] ||
            ''
          )
            .trim()
            .toLowerCase();

          if (!email) {
            errors++;
            continue;
          }

          const { data: existing } = await supabase
            .from('sponsors')
            .select('id')
            .eq('tenant_id', effectiveTenantId)
            .eq('email', email)
            .maybeSingle();

          if (existing) {
            duplicates++;
            continue;
          }

          const sponsorData = {
            tenant_id: effectiveTenantId,
            company: row.société || row.company || row.entreprise || row.societe || '',
            contact_name: row.nom || row.name || row.contact || row['nom du contact'] || '',
            email: email,
            phone: row.téléphone || row.telephone || row.phone || row.tel || null,
            segment: (['or', 'argent', 'bronze'].includes(
              (row.segment || row.tier || '').toLowerCase()
            )
              ? row.segment || row.tier
              : 'autre'
            ).toLowerCase() as 'or' | 'argent' | 'bronze' | 'autre',
            notes: row.notes || row.commentaire || null,
          };

          const { error } = await supabase.from('sponsors').insert(sponsorData);

          if (error) {
            errors++;
          } else {
            imported++;
          }
        } catch (error) {
          errors++;
        }
      }

      setImportStats({
        total: data.length,
        duplicates,
        errors,
      });

      setCsvFile(null);
      setCsvPreview([]);
      fetchSponsors();

      if (imported > 0) {
        toast.success(`${imported} sponsor(s) importé(s) avec succès`);
      }
      if (duplicates > 0) {
        toast.info(`${duplicates} doublon(s) ignoré(s)`);
      }
      if (errors > 0) {
        toast.error(`${errors} erreur(s) lors de l'import`);
      }
    };

    reader.readAsText(csvFile);
  };

  const handleInviteSuccess = () => {
    setSelectedSponsors([]);
    setShowInviteModal(false);
    fetchSponsors();
  };

  const toggleSponsorSelection = (sponsorId: string) => {
    setSelectedSponsors((prev) =>
      prev.includes(sponsorId) ? prev.filter((id) => id !== sponsorId) : [...prev, sponsorId]
    );
  };

  const toggleAllSponsors = () => {
    if (selectedSponsors.length === sponsors.length && sponsors.length > 0) {
      setSelectedSponsors([]);
    } else {
      setSelectedSponsors(sponsors.map((s) => s.id));
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Gestion des sponsors
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {totalCount} sponsor(s) au total
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportCSV(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
            >
              <Upload className="w-4 h-4" />
              <span className="font-medium">Importer CSV</span>
            </button>
            <button
              onClick={() => setShowAddSponsor(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">Nouveau sponsor</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative" role="search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setDebouncedSearchTerm(searchTerm);
                  setCurrentPage(1);
                }
              }}
              placeholder="Rechercher un sponsor..."
              className="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              aria-label="Rechercher un sponsor"
              data-testid="club-sponsor-search"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Effacer la recherche"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={filterSegment}
            onChange={(e) => setFilterSegment(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">Tous les segments</option>
            {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {selectedSponsors.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
              {selectedSponsors.length} sponsor(s) sélectionné(s)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedSponsors([])}
                className="px-3 py-1 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
              >
                Désélectionner
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
                data-testid="invite-sponsors-button"
              >
                <Mail className="w-4 h-4" />
                Inviter
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Chargement...</div>
        ) : sponsors.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {searchTerm || filterSegment ? 'Aucun résultat' : 'Aucun sponsor'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {searchTerm || filterSegment
                ? 'Essayez de modifier vos critères de recherche'
                : 'Commencez par ajouter des sponsors manuellement ou via import CSV'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedSponsors.length === sponsors.length &&
                          sponsors.length > 0
                        }
                        onChange={toggleAllSponsors}
                        className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Société
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Segment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Réponses
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {sponsors.map((sponsor) => (
                    <tr
                      key={sponsor.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedSponsors.includes(sponsor.id)}
                          onChange={() => toggleSponsorSelection(sponsor.id)}
                          className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        {highlightText(sponsor.company, debouncedSearchTerm)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {highlightText(sponsor.contact_name, debouncedSearchTerm)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {highlightText(sponsor.email, debouncedSearchTerm)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            sponsor.segment === 'or'
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                              : sponsor.segment === 'argent'
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                              : sponsor.segment === 'bronze'
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {SEGMENT_LABELS[sponsor.segment]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {sponsor.responses_count || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {totalCount} sponsor{totalCount !== 1 ? 's' : ''} trouvé{totalCount !== 1 ? 's' : ''}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showAddSponsor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Ajouter un sponsor
            </h2>

            <form onSubmit={handleAddSponsor} className="space-y-4" data-testid="add-sponsor-form">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Société *
                </label>
                <input
                  type="text"
                  required
                  value={newSponsor.company}
                  onChange={(e) => setNewSponsor({ ...newSponsor, company: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nom du contact *
                </label>
                <input
                  type="text"
                  required
                  value={newSponsor.contact_name}
                  onChange={(e) => setNewSponsor({ ...newSponsor, contact_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={newSponsor.email}
                  onChange={(e) => setNewSponsor({ ...newSponsor, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={newSponsor.phone}
                    onChange={(e) => setNewSponsor({ ...newSponsor, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Segment
                  </label>
                  <select
                    value={newSponsor.segment}
                    onChange={(e) =>
                      setNewSponsor({
                        ...newSponsor,
                        segment: e.target.value as 'or' | 'argent' | 'bronze' | 'autre',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={newSponsor.notes}
                  onChange={(e) => setNewSponsor({ ...newSponsor, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSponsor(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition font-medium shadow-lg"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportCSV && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Importer depuis un CSV
              </h2>
              <button
                onClick={() => {
                  setShowImportCSV(false);
                  setCsvFile(null);
                  setCsvPreview([]);
                  setImportStats(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-300 mb-2 font-medium">
                Format attendu (colonnes acceptées) :
              </p>
              <code className="text-xs text-blue-800 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded block">
                Société, Nom, Email, Segment, Téléphone, Notes
              </code>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                Les doublons (email + tenant) seront automatiquement ignorés
              </p>
            </div>

            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                <Upload className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Glissez-déposez votre fichier CSV ici
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  ou cliquez pour sélectionner
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition text-sm font-medium"
                >
                  Sélectionner un fichier
                </button>
                {csvFile && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">
                    Fichier sélectionné: {csvFile.name}
                  </p>
                )}
              </div>

              {csvPreview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Aperçu (5 premières lignes) :
                  </p>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {csvPreview.map((row, index) => (
                            <tr
                              key={index}
                              className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                            >
                              {Object.values(row).map((value: any, i) => (
                                <td
                                  key={i}
                                  className="px-3 py-2 text-slate-600 dark:text-slate-400"
                                >
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {importStats && (
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-slate-900 dark:text-white">
                      {importStats.total - importStats.duplicates - importStats.errors} importé(s)
                    </span>
                  </div>
                  {importStats.duplicates > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-slate-900 dark:text-white">
                        {importStats.duplicates} doublon(s) ignoré(s)
                      </span>
                    </div>
                  )}
                  {importStats.errors > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <span className="text-slate-900 dark:text-white">
                        {importStats.errors} erreur(s)
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportCSV(false);
                    setCsvFile(null);
                    setCsvPreview([]);
                    setImportStats(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium"
                >
                  {importStats ? 'Fermer' : 'Annuler'}
                </button>
                {!importStats && (
                  <button
                    onClick={handleImportCSV}
                    disabled={!csvFile}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    Importer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <InviteModal
          sponsors={sponsors.filter((s) => selectedSponsors.includes(s.id))}
          campaigns={campaigns}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </Layout>
  );
}
