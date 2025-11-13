import { useState, useEffect } from 'react';
import { Save, FileText, Shield, Lock, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useAsTenant } from '../hooks/useAsTenant';

interface LegalContent {
  rgpd_content_md: string;
  cgu_content_md: string;
  privacy_content_md: string;
  email_signature_html: string;
}

export function ClubLegalSettings() {
  const toast = useToast();
  const { user } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'rgpd' | 'cgu' | 'privacy' | 'signature'>('rgpd');
  const [content, setContent] = useState<LegalContent>({
    rgpd_content_md: '',
    cgu_content_md: '',
    privacy_content_md: '',
    email_signature_html: '',
  });

  useEffect(() => {
    if (effectiveTenantId) {
      fetchLegalContent();
    }
  }, [effectiveTenantId]);

  const fetchLegalContent = async () => {
    if (!effectiveTenantId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('rgpd_content_md, cgu_content_md, privacy_content_md, email_signature_html')
        .eq('id', effectiveTenantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setContent({
          rgpd_content_md: data.rgpd_content_md || '',
          cgu_content_md: data.cgu_content_md || '',
          privacy_content_md: data.privacy_content_md || '',
          email_signature_html: data.email_signature_html || '',
        });
      }
    } catch (error) {
      console.error('Error fetching legal content:', error);
      toast.error('Erreur lors du chargement des contenus légaux');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveTenantId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          rgpd_content_md: content.rgpd_content_md,
          cgu_content_md: content.cgu_content_md,
          privacy_content_md: content.privacy_content_md,
          email_signature_html: content.email_signature_html,
        })
        .eq('id', effectiveTenantId);

      if (error) throw error;

      toast.success('Contenus légaux enregistrés avec succès');
    } catch (error) {
      console.error('Error saving legal content:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const renderMarkdown = (markdown: string): string => {
    if (!markdown) return '<p class="text-slate-400">Aucun contenu</p>';

    return markdown
      .split('\n')
      .map((line) => {
        if (line.startsWith('# ')) {
          return `<h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">${line.slice(2)}</h1>`;
        } else if (line.startsWith('## ')) {
          return `<h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-3 mt-6">${line.slice(3)}</h2>`;
        } else if (line.startsWith('### ')) {
          return `<h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2 mt-4">${line.slice(4)}</h3>`;
        } else if (line.startsWith('- ')) {
          return `<li class="ml-4 text-slate-700 dark:text-slate-300">${line.slice(2)}</li>`;
        } else if (line.startsWith('**') && line.endsWith('**')) {
          return `<p class="font-bold text-slate-900 dark:text-white mb-2">${line.slice(2, -2)}</p>`;
        } else if (line.trim() === '') {
          return '<br>';
        } else {
          return `<p class="text-slate-700 dark:text-slate-300 mb-2">${line}</p>`;
        }
      })
      .join('');
  };

  const getEmailPreview = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .email-body { padding: 20px; background: #f9fafb; }
            .email-content { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; }
            .email-signature { border-top: 2px solid #e5e7eb; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="email-body">
            <div class="email-content">
              <p>Bonjour,</p>
              <p>Ceci est un exemple de contenu d'email pour prévisualiser votre signature.</p>
              <p>Cordialement,</p>
            </div>
            <div class="email-signature">
              ${content.email_signature_html || '<p style="color: #9ca3af;">Aucune signature définie</p>'}
            </div>
          </div>
        </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600 dark:text-slate-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Contenus Légaux
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Gérez vos mentions RGPD, CGU, politique de confidentialité et signature email
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('rgpd')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'rgpd'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            <Shield className="w-4 h-4" />
            RGPD
          </button>
          <button
            onClick={() => setActiveTab('cgu')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'cgu'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            CGU
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'privacy'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            <Lock className="w-4 h-4" />
            Confidentialité
          </button>
          <button
            onClick={() => setActiveTab('signature')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'signature'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            <Mail className="w-4 h-4" />
            Signature Email
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          data-testid="btn-save-legal"
          className="flex items-center gap-2 px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-400 text-white rounded-lg transition"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {activeTab === 'rgpd' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Édition (Markdown)
              </h3>
              <textarea
                value={content.rgpd_content_md}
                onChange={(e) =>
                  setContent({ ...content, rgpd_content_md: e.target.value })
                }
                data-testid="rgpd-md"
                className="w-full h-[600px] p-4 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-none"
                placeholder="# RGPD&#10;&#10;## Introduction&#10;Vos données personnelles...&#10;&#10;- Point 1&#10;- Point 2"
              />
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Prévisualisation
              </h3>
              <div
                className="prose prose-slate dark:prose-invert max-w-none overflow-y-auto h-[600px]"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content.rgpd_content_md) }}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cgu' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Édition (Markdown)
              </h3>
              <textarea
                value={content.cgu_content_md}
                onChange={(e) =>
                  setContent({ ...content, cgu_content_md: e.target.value })
                }
                data-testid="cgu-md"
                className="w-full h-[600px] p-4 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-none"
                placeholder="# Conditions Générales d'Utilisation&#10;&#10;## Article 1&#10;...&#10;&#10;## Article 2&#10;..."
              />
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Prévisualisation
              </h3>
              <div
                className="prose prose-slate dark:prose-invert max-w-none overflow-y-auto h-[600px]"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content.cgu_content_md) }}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Édition (Markdown)
              </h3>
              <textarea
                value={content.privacy_content_md}
                onChange={(e) =>
                  setContent({ ...content, privacy_content_md: e.target.value })
                }
                data-testid="privacy-md"
                className="w-full h-[600px] p-4 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-none"
                placeholder="# Politique de Confidentialité&#10;&#10;## Collecte des données&#10;...&#10;&#10;## Utilisation des données&#10;..."
              />
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Prévisualisation
              </h3>
              <div
                className="prose prose-slate dark:prose-invert max-w-none overflow-y-auto h-[600px]"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content.privacy_content_md) }}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'signature' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Édition (HTML)
              </h3>
              <textarea
                value={content.email_signature_html}
                onChange={(e) =>
                  setContent({ ...content, email_signature_html: e.target.value })
                }
                data-testid="signature-html"
                className="w-full h-[600px] p-4 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-none"
                placeholder='<div style="font-family: Arial, sans-serif;">&#10;  <p style="margin: 0;"><strong>Prénom NOM</strong></p>&#10;  <p style="margin: 0; color: #666;">Poste</p>&#10;  <p style="margin: 0; color: #666;">Club Sportif</p>&#10;  <p style="margin: 0; color: #0066cc;">email@club.fr</p>&#10;</div>'
              />
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  <strong>Astuce :</strong> Utilisez du HTML inline pour la signature (styles inline recommandés pour les emails).
                </p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Prévisualisation Email
              </h3>
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden h-[600px]">
                <iframe
                  srcDoc={getEmailPreview()}
                  className="w-full h-full"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
