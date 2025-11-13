import { useState, useEffect } from 'react';
import { Save, FileText, Shield, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';

export function SettingsLegal() {
  const { profile } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rgpdContentMd, setRgpdContentMd] = useState('');
  const [cguContentMd, setCguContentMd] = useState('');
  const [emailSignatureHtml, setEmailSignatureHtml] = useState('');

  useEffect(() => {
    fetchTenantSettings();
  }, [effectiveTenantId]);

  const fetchTenantSettings = async () => {
    if (!effectiveTenantId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('rgpd_content_md, cgu_content_md, email_signature_html')
        .eq('id', effectiveTenantId)
        .single();

      if (error) throw error;

      if (data) {
        setRgpdContentMd(data.rgpd_content_md || '');
        setCguContentMd(data.cgu_content_md || '');
        setEmailSignatureHtml(data.email_signature_html || '');
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des paramètres');
      console.error('Error fetching tenant settings:', error);
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
          rgpd_content_md: rgpdContentMd,
          cgu_content_md: cguContentMd,
          email_signature_html: emailSignatureHtml,
        })
        .eq('id', effectiveTenantId);

      if (error) throw error;

      toast.success('Paramètres sauvegardés avec succès');
    } catch (error: any) {
      toast.error('Erreur lors de la sauvegarde');
      console.error('Error saving tenant settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const generateEmailPreview = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .email-header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    .email-body {
      margin-bottom: 30px;
    }
    .email-signature {
      border-top: 2px solid #e5e7eb;
      padding-top: 20px;
      margin-top: 30px;
    }
    h1 {
      color: #1f2937;
      font-size: 24px;
      margin: 0 0 10px 0;
    }
    p {
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Exemple d'e-mail</h1>
    </div>
    <div class="email-body">
      <p>Bonjour,</p>
      <p>Ceci est un exemple de contenu d'e-mail envoyé depuis votre plateforme de sponsoring.</p>
      <p>Votre message personnalisé apparaîtrait ici.</p>
      <p>Cordialement,</p>
    </div>
    <div class="email-signature">
      ${emailSignatureHtml || '<p><em>Aucune signature configurée</em></p>'}
    </div>
  </div>
</body>
</html>
    `.trim();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600 dark:text-slate-400">Chargement...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Légal & E-mails</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Gérez vos mentions légales, RGPD et signature d'e-mail
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 disabled:from-slate-400 disabled:to-slate-400 text-white rounded-lg transition shadow-lg"
          >
            <Save className="w-4 h-4" />
            <span className="font-medium">{saving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Politique RGPD
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Décrivez votre politique de protection des données personnelles (format Markdown)
              </p>
              <textarea
                value={rgpdContentMd}
                onChange={(e) => setRgpdContentMd(e.target.value)}
                placeholder="# Politique RGPD&#10;&#10;## Protection des données&#10;&#10;Vos données personnelles sont..."
                className="w-full h-64 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-y"
                aria-label="Contenu RGPD en Markdown"
              />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-5 h-5 text-green-500" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Mentions Légales / CGU
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Renseignez vos mentions légales et conditions générales (format Markdown)
              </p>
              <textarea
                value={cguContentMd}
                onChange={(e) => setCguContentMd(e.target.value)}
                placeholder="# Mentions Légales&#10;&#10;## Informations éditeur&#10;&#10;Raison sociale :..."
                className="w-full h-64 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-y"
                aria-label="Contenu CGU en Markdown"
              />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Signature E-mail
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Personnalisez la signature qui apparaîtra dans vos e-mails (format HTML)
              </p>
              <textarea
                value={emailSignatureHtml}
                onChange={(e) => setEmailSignatureHtml(e.target.value)}
                placeholder="<div style='font-family: Arial, sans-serif;'>&#10;  <p><strong>Nom du Club</strong></p>&#10;  <p>Adresse | Téléphone | Email</p>&#10;</div>"
                className="w-full h-48 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-y"
                aria-label="Signature e-mail en HTML"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sticky top-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                Prévisualisation E-mail
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Aperçu de votre signature dans un e-mail type
              </p>
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                <iframe
                  srcDoc={generateEmailPreview()}
                  title="Prévisualisation e-mail"
                  className="w-full h-[600px] bg-white"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
