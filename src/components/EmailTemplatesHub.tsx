import { useState, useEffect, useMemo, useRef } from 'react';
import { Mail, Search, X, Eye, Save, AlertCircle, Copy, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';
import { loadTemplatesFlex, NormalizedTemplate } from '../lib/templatesFlex';
import { saveEmailTemplate } from '../services/emailTemplates';
import { appendLegal } from '../lib/emailLegal';
import { PLACEHOLDERS, DEFAULT_EXAMPLE_VALUES, applyPlaceholders } from '../lib/placeholders';

const CANONICAL_KEYS = [
  'invitation',
  'confirmation',
  'reminder',
  'pledge_yes',
  'pledge_no',
];

type TabType = 'global' | 'default' | 'tenant';

export function EmailTemplatesHub() {
  const toast = useToast();
  const { effectiveTenantId, tenantData } = useAsTenant();
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'global' || tab === 'default' || tab === 'tenant') return tab;
    return 'global';
  });

  const [allTemplates, setAllTemplates] = useState<NormalizedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<NormalizedTemplate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    subject: '',
    html: '',
  });
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const [exampleValues, setExampleValues] = useState<Record<string, string | number>>(DEFAULT_EXAMPLE_VALUES);
  const [exampleJsonText, setExampleJsonText] = useState(JSON.stringify(DEFAULT_EXAMPLE_VALUES, null, 2));
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, [effectiveTenantId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'global' || tab === 'default' || tab === 'tenant') {
      setActiveTab(tab);
    }
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const result = await loadTemplatesFlex(supabase, effectiveTenantId || null);

      if (result.error) {
        toast.error('Erreur lors du chargement des templates');
        console.error('[EmailTemplatesHub] Load error:', result.error);
      } else {
        setAllTemplates(result.rows);
        if (result.warning) {
          console.warn('[EmailTemplatesHub]', result.warning);
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement des templates');
      console.error('[EmailTemplatesHub] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const globalTemplates = useMemo(
    () => allTemplates.filter((t) => t.scope === 'global'),
    [allTemplates]
  );

  const defaultTemplates = useMemo(
    () => allTemplates.filter((t) => t.scope === 'global' && CANONICAL_KEYS.includes(t.key)),
    [allTemplates]
  );

  const tenantTemplates = useMemo(
    () => allTemplates.filter((t) => t.scope === 'tenant' && t.tenant_id === effectiveTenantId),
    [allTemplates, effectiveTenantId]
  );

  const currentTemplates = useMemo(() => {
    if (activeTab === 'global') return globalTemplates;
    if (activeTab === 'default') return defaultTemplates;
    return tenantTemplates;
  }, [activeTab, globalTemplates, defaultTemplates, tenantTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return currentTemplates;
    const query = searchQuery.toLowerCase();
    return currentTemplates.filter(
      (t) =>
        t.key.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query)
    );
  }, [currentTemplates, searchQuery]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  };

  const handleSelectTemplate = (template: NormalizedTemplate) => {
    setSelectedTemplate(template);
    setEditForm({
      subject: template.subject,
      html: template.html,
    });
    setShowPreview(false);
    setPreviewHtml('');
    setExampleJsonText(JSON.stringify(DEFAULT_EXAMPLE_VALUES, null, 2));
    setExampleValues(DEFAULT_EXAMPLE_VALUES);
    setJsonError('');
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedTemplate(null);
    setEditForm({ subject: '', html: '' });
    setShowPreview(false);
    setPreviewHtml('');
    setExampleJsonText(JSON.stringify(DEFAULT_EXAMPLE_VALUES, null, 2));
    setExampleValues(DEFAULT_EXAMPLE_VALUES);
    setJsonError('');
  };

  const handleExampleJsonChange = (newJson: string) => {
    setExampleJsonText(newJson);
    try {
      const parsed = JSON.parse(newJson);
      setExampleValues(parsed);
      setJsonError('');
    } catch (e: any) {
      setJsonError('JSON invalide : ' + e.message);
    }
  };

  const handleCopyPlaceholder = (key: string) => {
    const placeholder = `{{${key}}}`;
    navigator.clipboard.writeText(placeholder);
    toast.success(`Copié : ${placeholder}`);
  };

  const handleInsertPlaceholder = (key: string) => {
    const placeholder = `{{${key}}}`;
    const textarea = htmlTextareaRef.current;

    if (!textarea) {
      toast.error('Impossible d\'insérer : zone de texte non trouvée');
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editForm.html;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + placeholder + after;

    setEditForm({ ...editForm, html: newText });

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + placeholder.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);

    toast.success(`Inséré : ${placeholder}`);
  };

  const handlePreview = async () => {
    if (!selectedTemplate) return;

    let subject = editForm.subject;
    let html = editForm.html;

    subject = applyPlaceholders(subject, exampleValues);
    html = applyPlaceholders(html, exampleValues);

    let signature = '';
    let rgpd = '';

    if (effectiveTenantId) {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('email_signature_html, rgpd_content_md')
          .eq('id', effectiveTenantId)
          .maybeSingle();

        if (error) {
          console.error('[Preview] Error fetching tenant data:', error);
        } else if (data) {
          signature = data.email_signature_html || '';
          rgpd = data.rgpd_content_md || '';
        }
      } catch (err) {
        console.error('[Preview] Exception:', err);
      }
    }

    let htmlFinal = html;
    if (signature || rgpd) {
      htmlFinal += '<hr/>';
      if (signature) {
        htmlFinal += signature;
      }
      if (rgpd) {
        const rgpdHtml = rgpd.replace(/\n/g, '<br/>');
        htmlFinal += `<small>${rgpdHtml}</small>`;
      }
    }

    setPreviewHtml(htmlFinal);
    setShowPreview(true);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const result = await saveEmailTemplate({
        id: selectedTemplate.id,
        tenant_id: selectedTemplate.tenant_id,
        key: selectedTemplate.key,
        subject: editForm.subject,
        html: editForm.html,
      });

      if (result.ok) {
        toast.success('Template enregistré avec succès');
        await fetchTemplates();
        handleCloseDrawer();
      } else {
        toast.error(`Erreur: ${result.message || 'Échec de l\'enregistrement'}`);
        console.error('[EmailTemplatesHub] Save error:', result);
      }
    } catch (error: any) {
      toast.error('Erreur lors de l\'enregistrement');
      console.error('[EmailTemplatesHub] Save exception:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const showTenantWarning = activeTab === 'tenant' && !effectiveTenantId;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Templates e-mails
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Gestion centralisée des templates d'emails
            </p>
          </div>
        </div>

        {showTenantWarning && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              Tenant non défini — affichage des globaux uniquement
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-4 px-6">
              <button
                data-testid="tabs-global"
                onClick={() => handleTabChange('global')}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  activeTab === 'global'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Globaux ({globalTemplates.length})
              </button>
              <button
                data-testid="tabs-default"
                onClick={() => handleTabChange('default')}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  activeTab === 'default'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Par défaut ({defaultTemplates.length})
              </button>
              <button
                data-testid="tabs-tenant"
                onClick={() => handleTabChange('tenant')}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  activeTab === 'tenant'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Mon club ({tenantTemplates.length})
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                data-testid="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par key ou subject..."
                className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                Chargement...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-600 dark:text-slate-400">
                  {searchQuery
                    ? 'Aucun template trouvé pour cette recherche'
                    : 'Aucun template disponible'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {template.key}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              template.scope === 'global'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            }`}
                          >
                            {template.scope === 'global' ? 'Global' : 'Tenant'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                          {template.subject}
                        </p>
                        {template.updated_at && (
                          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                            Mis à jour: {formatDate(template.updated_at)}
                          </p>
                        )}
                      </div>
                      <Mail className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {drawerOpen && selectedTemplate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseDrawer();
          }}
        >
          <div
            data-testid="drawer-template"
            className="bg-white dark:bg-slate-800 w-full max-w-5xl overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedTemplate.key}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {selectedTemplate.scope === 'global' ? 'Template global' : 'Template du club'}
                </p>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Sujet
                </label>
                <input
                  type="text"
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Corps HTML
                </label>
                <textarea
                  ref={htmlTextareaRef}
                  value={editForm.html}
                  onChange={(e) => setEditForm({ ...editForm, html: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">
                  Placeholders utilisables
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {PLACEHOLDERS.map((ph) => (
                    <div
                      key={ph.key}
                      className="flex items-center justify-between gap-3 p-2 bg-white dark:bg-slate-800 rounded border border-blue-100 dark:border-blue-900"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-blue-700 dark:text-blue-300">
                            {`{{${ph.key}}}`}
                          </code>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {ph.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                          {ph.description}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleCopyPlaceholder(ph.key)}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition"
                          title="Copier la clé"
                        >
                          <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleInsertPlaceholder(ph.key)}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition"
                          title="Insérer dans le curseur"
                        >
                          <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-3">
                  Exemple de rendu (JSON éditable)
                </h3>
                <textarea
                  data-testid="placeholders-json"
                  value={exampleJsonText}
                  onChange={(e) => handleExampleJsonChange(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
                {jsonError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    {jsonError}
                  </p>
                )}
              </div>

              {showPreview && (
                <div data-testid="preview-pane">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Prévisualisation (avec signature et RGPD)
                  </h3>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-96 border-0"
                      sandbox="allow-same-origin"
                      title="Email Preview"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  data-testid="btn-preview-legal"
                  onClick={handlePreview}
                  disabled={saving || !!jsonError}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye className="w-4 h-4" />
                  Prévisualiser (avec signature)
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
