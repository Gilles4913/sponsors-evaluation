import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Upload,
  Mail,
  Palette,
  Shield,
  CheckCircle,
  AlertCircle,
  Info,
  Building2,
  Phone,
  MapPin,
  Globe,
  FileText,
  Code2,
  Eye,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';

interface TenantSettings {
  id: string;
  name: string;
  email_contact: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  email_domain: string | null;
  email_domain_verified: boolean;
  opt_out_default: boolean;
  rgpd_text: string;
  email_signature_html: string;
  rgpd_content_md: string;
}

export function SettingsClub() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const toast = useToast();

  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email_contact: '',
    address: '',
    phone: '',
    logo_url: '',
    primary_color: '#3b82f6',
    secondary_color: '#10b981',
    email_domain: '',
    opt_out_default: false,
    rgpd_text: '',
    email_signature_html: '',
    rgpd_content_md: '',
  });

  const [previewMode, setPreviewMode] = useState<'signature' | 'rgpd' | null>(null);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSettings();
    }
  }, [profile?.tenant_id]);

  const fetchSettings = async () => {
    if (!profile?.tenant_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', effectiveTenantId)
        .single();

      if (error) throw error;

      setSettings(data);
      setFormData({
        name: data.name || '',
        email_contact: data.email_contact || '',
        address: data.address || '',
        phone: data.phone || '',
        logo_url: data.logo_url || '',
        primary_color: data.primary_color || '#3b82f6',
        secondary_color: data.secondary_color || '#10b981',
        email_domain: data.email_domain || '',
        opt_out_default: data.opt_out_default || false,
        rgpd_text:
          data.rgpd_text ||
          'En soumettant ce formulaire, vous acceptez que vos données personnelles soient utilisées pour traiter votre demande de sponsoring. Conformément au RGPD, vous disposez d\'un droit d\'accès, de rectification et de suppression de vos données.',
        email_signature_html: data.email_signature_html || '',
        rgpd_content_md: data.rgpd_content_md || '',
      });
    } catch (error: any) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.tenant_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          email_contact: formData.email_contact,
          address: formData.address || null,
          phone: formData.phone || null,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          email_domain: formData.email_domain || null,
          opt_out_default: formData.opt_out_default,
          rgpd_text: formData.rgpd_text,
          email_signature_html: formData.email_signature_html,
          rgpd_content_md: formData.rgpd_content_md,
        })
        .eq('id', effectiveTenantId);

      if (error) throw error;

      toast.success('Paramètres enregistrés avec succès');
      fetchSettings();
    } catch (error: any) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.tenant_id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le fichier doit faire moins de 2 MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${effectiveTenantId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('club_exports')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('club_exports').getPublicUrl(fileName);

      setFormData({ ...formData, logo_url: publicUrl });

      const { error: updateError } = await supabase
        .from('tenants')
        .update({ logo_url: publicUrl })
        .eq('id', effectiveTenantId);

      if (updateError) throw updateError;

      toast.success('Logo téléchargé avec succès');
      fetchSettings();
    } catch (error: any) {
      toast.error('Erreur lors du téléchargement du logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
            <p className="text-slate-600 dark:text-slate-400">Chargement...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-slate-500 to-slate-600 p-3 rounded-xl shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Paramètres du club
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Configurez les informations et préférences de votre club
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Informations générales
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Nom du club *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="FC Exemple"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Email de contact *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email_contact}
                    onChange={(e) => setFormData({ ...formData, email_contact: e.target.value })}
                    className="w-full pl-11 pr-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="contact@fcexemple.fr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Téléphone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-11 pr-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="01 23 45 67 89"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Adresse
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-11 pr-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                      placeholder="123 rue du Stade, 75000 Paris"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Logo du club</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-6">
                {formData.logo_url ? (
                  <div className="w-32 h-32 rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center">
                    <img
                      src={formData.logo_url}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <div className="flex-1">
                  <label
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer transition"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingLogo ? 'Téléchargement...' : 'Télécharger un logo'}
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    PNG, JPG ou SVG. Max 2 MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Couleurs de la marque
                </h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Couleur principale
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-20 h-12 rounded-lg border-2 border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="flex-1 px-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono"
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Couleur secondaire
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) =>
                        setFormData({ ...formData, secondary_color: e.target.value })
                      }
                      className="w-20 h-12 rounded-lg border-2 border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.secondary_color}
                      onChange={(e) =>
                        setFormData({ ...formData, secondary_color: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono"
                      placeholder="#10b981"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Aperçu des couleurs :
                </p>
                <div className="flex gap-2">
                  <div
                    className="flex-1 h-20 rounded-lg"
                    style={{ backgroundColor: formData.primary_color }}
                  />
                  <div
                    className="flex-1 h-20 rounded-lg"
                    style={{ backgroundColor: formData.secondary_color }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Configuration email
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Domaine d'envoi personnalisé
                </label>
                <input
                  type="text"
                  value={formData.email_domain}
                  onChange={(e) => setFormData({ ...formData, email_domain: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="mail.votreclub.fr"
                />
              </div>

              {settings?.email_domain_verified ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-800 dark:text-green-300">
                    Domaine vérifié et configuré
                  </p>
                </div>
              ) : formData.email_domain ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-semibold mb-1">Configuration DNS requise</p>
                    <p className="mb-2">
                      Pour utiliser votre domaine personnalisé, configurez les enregistrements
                      suivants :
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>
                        <strong>SPF :</strong> TXT @ "v=spf1 include:_spf.example.com ~all"
                      </li>
                      <li>
                        <strong>DKIM :</strong> TXT dkim._domainkey "v=DKIM1; k=rsa; p=..."
                      </li>
                      <li>
                        <strong>DMARC :</strong> TXT _dmarc "v=DMARC1; p=quarantine; rua=..."
                      </li>
                    </ul>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Un domaine personnalisé améliore la délivrabilité de vos emails et renforce votre
                  image de marque.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Signature email (HTML)
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Code HTML de la signature
                  </label>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(previewMode === 'signature' ? null : 'signature')}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <Eye className="w-4 h-4" />
                    {previewMode === 'signature' ? 'Masquer' : 'Aperçu'}
                  </button>
                </div>
                <textarea
                  value={formData.email_signature_html}
                  onChange={(e) => setFormData({ ...formData, email_signature_html: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition font-mono text-sm"
                  placeholder="<div style='font-family: Arial; color: #333;'>\n  <p><strong>Nom du Club</strong></p>\n  <p>Adresse | Téléphone | Email</p>\n</div>"
                />
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  Cette signature sera automatiquement ajoutée à tous les emails envoyés (invitations, confirmations, rappels).
                </p>
              </div>

              {previewMode === 'signature' && formData.email_signature_html && (
                <div className="border-2 border-slate-300 dark:border-slate-600 rounded-xl p-4 bg-slate-50 dark:bg-slate-900">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">APERÇU :</p>
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: formData.email_signature_html }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Politique RGPD (Markdown)
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Contenu Markdown
                  </label>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(previewMode === 'rgpd' ? null : 'rgpd')}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <Eye className="w-4 h-4" />
                    {previewMode === 'rgpd' ? 'Masquer' : 'Aperçu'}
                  </button>
                </div>
                <textarea
                  value={formData.rgpd_content_md}
                  onChange={(e) => setFormData({ ...formData, rgpd_content_md: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition font-mono text-sm"
                  placeholder="# Protection des données\n\n## Collecte des données\n\nNous collectons...\n\n## Vos droits\n\n- Droit d'accès\n- Droit de rectification"
                />
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  Ce texte sera affiché sur les formulaires de réponse publics. Utilisez Markdown pour la mise en forme.
                </p>
              </div>

              {previewMode === 'rgpd' && formData.rgpd_content_md && (
                <div className="border-2 border-slate-300 dark:border-slate-600 rounded-xl p-4 bg-slate-50 dark:bg-slate-900">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">APERÇU :</p>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {formData.rgpd_content_md.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-4 mb-2">{line.substring(2)}</h1>;
                      if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-3 mb-2">{line.substring(3)}</h2>;
                      if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-2 mb-1">{line.substring(4)}</h3>;
                      if (line.startsWith('- ')) return <li key={i} className="ml-4">{line.substring(2)}</li>;
                      if (line.trim() === '') return <br key={i} />;
                      return <p key={i} className="mb-2">{line}</p>;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Conformité RGPD (formulaires)
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition">
                  <input
                    type="checkbox"
                    checked={formData.opt_out_default}
                    onChange={(e) =>
                      setFormData({ ...formData, opt_out_default: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Opt-out par défaut
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      La case "Ne pas recevoir de communications" sera cochée par défaut sur les
                      formulaires publics
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Texte de conformité RGPD
                </label>
                <textarea
                  value={formData.rgpd_text}
                  onChange={(e) => setFormData({ ...formData, rgpd_text: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition"
                  placeholder="Texte affiché sur les formulaires publics concernant le traitement des données personnelles..."
                />
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  Ce texte sera affiché sur tous les formulaires de réponse publics pour informer
                  les sponsors de leurs droits.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => fetchSettings()}
              className="px-6 py-3 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-semibold transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-semibold transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
