import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useParams } from './Router';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';

interface TenantForm {
  name: string;
  email_contact: string;
  phone: string;
  address: string;
  primary_color: string;
  secondary_color: string;
  email_signature_html: string;
  rgpd_content_md: string;
  cgu_content_md: string;
  privacy_content_md: string;
  status: 'active' | 'inactive';
}

function pick<T extends object>(obj: T, keys: (keyof T)[]) {
  const out: any = {};
  for (const k of keys) if (k in obj) out[k as string] = obj[k];
  return out;
}

export function TenantEdit() {
  const { tenantId: id } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TenantForm>({
    name: '',
    email_contact: '',
    phone: '',
    address: '',
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    email_signature_html: '',
    rgpd_content_md: '',
    cgu_content_md: '',
    privacy_content_md: '',
    status: 'active',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) {
      toast.error('ID tenant manquant');
      window.location.href = '/admin/clubs';
      return;
    }
    loadTenant();
  }, [id]);

  const loadTenant = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(
          'id, name, email_contact, phone, address, primary_color, secondary_color, email_signature_html, rgpd_content_md, cgu_content_md, privacy_content_md, status'
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Tenant non trouvé');
        window.location.href = '/admin/clubs';
        return;
      }

      setForm({
        name: data.name || '',
        email_contact: data.email_contact || '',
        phone: data.phone || '',
        address: data.address || '',
        primary_color: data.primary_color || '#3B82F6',
        secondary_color: data.secondary_color || '#10B981',
        email_signature_html: data.email_signature_html || '',
        rgpd_content_md: data.rgpd_content_md || '',
        cgu_content_md: data.cgu_content_md || '',
        privacy_content_md: data.privacy_content_md || '',
        status: data.status || 'active',
      });
    } catch (err: any) {
      console.error('[TenantEdit] Error loading tenant:', err);
      toast.error('Erreur lors du chargement du tenant');
      window.location.href = '/admin/clubs';
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = 'Le nom est requis';
    } else if (form.name.length > 255) {
      errors.name = 'Le nom ne doit pas dépasser 255 caractères';
    }

    if (form.email_contact) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email_contact)) {
        errors.email_contact = 'Format email invalide';
      } else if (form.email_contact.length > 255) {
        errors.email_contact = "L'email ne doit pas dépasser 255 caractères";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs de validation');
      return;
    }

    setSaving(true);
    try {
      const payload = pick(form, [
        'name',
        'email_contact',
        'phone',
        'address',
        'primary_color',
        'secondary_color',
        'email_signature_html',
        'rgpd_content_md',
        'cgu_content_md',
        'privacy_content_md',
        'status',
      ]);

      const { data, error } = await supabase
        .from('tenants')
        .update(payload)
        .eq('id', id)
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Tenant mis à jour avec succès');
      window.location.href = '/admin/clubs';
    } catch (err: any) {
      console.error('[TenantEdit] Error updating tenant:', err);
      toast.error('Erreur lors de la mise à jour du tenant');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => (window.location.href = '/admin/clubs')}
            className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Éditer le tenant
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Modifiez les informations du tenant
            </p>
          </div>
        </div>

        <form
          data-testid="tenant-edit-form"
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (validationErrors.name) {
                    setValidationErrors({ ...validationErrors, name: '' });
                  }
                }}
                className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white ${
                  validationErrors.name
                    ? 'border-red-500'
                    : 'border-slate-200 dark:border-slate-600'
                }`}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {validationErrors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email de contact
              </label>
              <input
                type="email"
                value={form.email_contact}
                onChange={(e) => {
                  setForm({ ...form, email_contact: e.target.value });
                  if (validationErrors.email_contact) {
                    setValidationErrors({ ...validationErrors, email_contact: '' });
                  }
                }}
                className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white ${
                  validationErrors.email_contact
                    ? 'border-red-500'
                    : 'border-slate-200 dark:border-slate-600'
                }`}
              />
              {validationErrors.email_contact && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {validationErrors.email_contact}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Statut
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as 'active' | 'inactive' })
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Adresse
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Couleur primaire
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="w-16 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  placeholder="#3B82F6"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Couleur secondaire
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                  className="w-16 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                  placeholder="#10B981"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Signature email (HTML)
            </label>
            <textarea
              value={form.email_signature_html}
              onChange={(e) => setForm({ ...form, email_signature_html: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
              placeholder="<p>Cordialement,<br/>L'équipe</p>"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Contenu RGPD (Markdown)
            </label>
            <textarea
              value={form.rgpd_content_md}
              onChange={(e) => setForm({ ...form, rgpd_content_md: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
              placeholder="Conformément au RGPD..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              CGU (Markdown)
            </label>
            <textarea
              value={form.cgu_content_md}
              onChange={(e) => setForm({ ...form, cgu_content_md: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
              placeholder="# Conditions Générales d'Utilisation

..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Politique de confidentialité (Markdown)
            </label>
            <textarea
              value={form.privacy_content_md}
              onChange={(e) => setForm({ ...form, privacy_content_md: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
              placeholder="# Politique de confidentialité

..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => (window.location.href = '/admin/clubs')}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              data-testid="btn-save-tenant"
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
