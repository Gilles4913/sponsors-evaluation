import { useState, useEffect, useMemo, useRef } from 'react';
import { Mail, Edit2, Copy, Trash2, Plus, Upload, Download, FileUp, X, History, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';
import { GlobalTemplateEditorModal, TemplateFormData } from './GlobalTemplateEditorModal';
import { PushTemplatesModal } from './PushTemplatesModal';
import { TemplateVersionsModal } from './TemplateVersionsModal';
import { saveEmailTemplate, pick, SaveResult } from '../services/emailTemplates';

interface EmailTemplate {
  id: string;
  tenant_id: string | null;
  type: string;
  key?: string;
  subject: string;
  html_body: string;
  html?: string;
  text_body: string;
  placeholders: string[];
  is_active: boolean;
  updated_at?: string;
  created_at?: string;
}

const ITEMS_PER_PAGE = 20;

export function SuperAdminGlobalEmailTemplates() {
  const toast = useToast();
  const { effectiveTenantId } = useAsTenant();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [saveError, setSaveError] = useState<SaveResult | null>(null);
  const [editorModal, setEditorModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    templateId?: string;
    initialData?: TemplateFormData;
  }>({
    isOpen: false,
    mode: 'create',
  });
  const [pushModal, setPushModal] = useState<{
    isOpen: boolean;
    template: EmailTemplate | null;
  }>({
    isOpen: false,
    template: null,
  });
  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    previewData: EmailTemplate[] | null;
  }>({
    isOpen: false,
    previewData: null,
  });
  const [versionsModal, setVersionsModal] = useState<{
    isOpen: boolean;
    templateId: string | null;
    templateType: string | null;
  }>({
    isOpen: false,
    templateId: null,
    templateType: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      // Try Mode A (key, html, text_body)
      const { data: modeAData, error: modeAError } = await supabase
        .from('email_templates')
        .select('*')
        .is('tenant_id', null)
        .order('key');

      if (modeAError) {
        const errorMsg = modeAError.message || '';
        if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
          // Fallback to Mode B (type, html_body)
          const { data: modeBData, error: modeBError } = await supabase
            .from('email_templates')
            .select('*')
            .is('tenant_id', null)
            .order('type');

          if (modeBError) throw modeBError;

          setTemplates(
            (modeBData || []).map((t) => ({
              ...t,
              key: t.type,
              html: t.html_body,
              placeholders: Array.isArray(t.placeholders)
                ? t.placeholders
                : JSON.parse(t.placeholders || '[]'),
            }))
          );
        } else {
          throw modeAError;
        }
      } else {
        setTemplates(
          (modeAData || []).map((t) => ({
            ...t,
            type: t.key,
            html_body: t.html,
            placeholders: Array.isArray(t.placeholders)
              ? t.placeholders
              : JSON.parse(t.placeholders || '[]'),
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Erreur lors du chargement des templates');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;

    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.type.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTemplates, currentPage]);

  const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE);

  const existingKeys = useMemo(() => templates.map((t) => t.type), [templates]);

  const handleOpenCreateModal = () => {
    setEditorModal({
      isOpen: true,
      mode: 'create',
    });
  };

  const handleOpenEditModal = (template: EmailTemplate) => {
    setEditorModal({
      isOpen: true,
      mode: 'edit',
      templateId: template.id,
      initialData: {
        type: template.type,
        subject: template.subject,
        html_body: template.html_body,
        is_active: template.is_active,
      },
    });
  };

  const handleCloseModal = () => {
    setEditorModal({ isOpen: false, mode: 'create' });
  };

  const htmlToText = (html: string): string => {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSaveTemplate = async (formData: TemplateFormData) => {
    setSaveError(null);

    try {
      // Mode CREATE uniquement (le modal gère directement les updates)
      const textBody = htmlToText(formData.html_body);
      const tenantId = effectiveTenantId || null;

      const result = await saveEmailTemplate({
        tenant_id: tenantId,
        key: formData.type,
        subject: formData.subject,
        html: formData.html_body,
        text_body: textBody,
      });

      if (!result.ok) {
        setSaveError(result);
        throw new Error(result.message || 'Save failed');
      }

      toast.success(`Modèle créé (mode ${result.mode})`);
      await fetchTemplates();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving template:', error);
      if (!saveError) {
        toast.error('Erreur lors de la sauvegarde');
      }
      throw error;
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      const newType = `${template.type}_copy_${Date.now()}`;

      // Stop-list : filtrer les colonnes avant insert
      const raw = {
        tenant_id: null,
        type: newType,
        subject: `${template.subject} (copie)`,
        html_body: template.html_body,
        text_body: template.text_body,
        is_active: false,
        placeholders: template.placeholders,
      };

      // Mode B (avec type/html_body)
      const payload = pick(raw, ['tenant_id', 'type', 'subject', 'html_body', 'text_body', 'is_active', 'placeholders']);

      const { error } = await supabase.from('email_templates').insert(payload);

      if (error) throw error;

      toast.success('Template dupliqué avec succès');
      await fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (
      !confirm(
        `Voulez-vous vraiment supprimer le template "${template.type}" ?`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast.success('Template supprimé avec succès');
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleExportJSON = () => {
    if (templates.length === 0) {
      toast.error('Aucun template à exporter');
      return;
    }

    const exportData = templates.map((t) => ({
      type: t.type,
      subject: t.subject,
      html_body: t.html_body,
      text_body: t.text_body,
      placeholders: t.placeholders,
      is_active: t.is_active,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `global-email-templates-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${templates.length} template(s) exporté(s)`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Veuillez sélectionner un fichier JSON');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        toast.error('Le fichier JSON doit contenir un tableau de templates');
        return;
      }

      const validTemplates = data.filter(
        (t) =>
          t.type &&
          typeof t.type === 'string' &&
          t.subject &&
          typeof t.subject === 'string' &&
          t.html_body &&
          typeof t.html_body === 'string'
      );

      if (validTemplates.length === 0) {
        toast.error('Aucun template valide trouvé dans le fichier');
        return;
      }

      setImportModal({
        isOpen: true,
        previewData: validTemplates.map((t) => ({
          id: '',
          tenant_id: null,
          type: t.type,
          subject: t.subject,
          html_body: t.html_body,
          text_body: t.text_body || t.html_body,
          placeholders: Array.isArray(t.placeholders) ? t.placeholders : [],
          is_active: typeof t.is_active === 'boolean' ? t.is_active : true,
        })),
      });
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Erreur lors de la lecture du fichier JSON');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!importModal.previewData) return;

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const template of importModal.previewData) {
        try {
          const { error } = await supabase.from('email_templates').upsert(
            {
              tenant_id: null,
              type: template.type,
              subject: template.subject,
              html_body: template.html_body,
              text_body: template.text_body,
              placeholders: template.placeholders,
              is_active: template.is_active,
            },
            {
              onConflict: 'tenant_id,type',
            }
          );

          if (error) throw error;
          successCount++;
        } catch (error) {
          console.error(`Error importing template ${template.type}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`${successCount} template(s) importé(s) avec succès`);
      } else {
        toast.error(`${successCount} réussi(s), ${errorCount} échec(s)`);
      }

      setImportModal({ isOpen: false, previewData: null });
      await fetchTemplates();
    } catch (error) {
      console.error('Error importing templates:', error);
      toast.error('Erreur lors de l\'importation');
    }
  };

  const handleRollback = async (version: any) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: version.subject,
          html_body: version.html_body,
          text_body: version.text_body,
          is_active: version.is_active,
        })
        .eq('id', version.template_id);

      if (error) throw error;

      toast.success('Template restauré avec succès');
      await fetchTemplates();
    } catch (error) {
      console.error('Error rolling back template:', error);
      toast.error('Erreur lors de la restauration');
      throw error;
    }
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Templates e-mails globaux
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Gérez les templates globaux (tenant_id IS NULL)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Rechercher par type ou sujet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="global-templates-search"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={handleExportJSON}
              data-testid="btn-export-json"
              disabled={templates.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 text-white rounded-lg transition"
              title="Exporter tous les templates en JSON"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
            <button
              onClick={handleImportClick}
              data-testid="btn-import-json"
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition"
              title="Importer des templates depuis JSON"
            >
              <FileUp className="w-4 h-4" />
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => setPushModal({ isOpen: true, template: null })}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition"
              title="Dupliquer tous les templates vers les clubs"
            >
              <Upload className="w-4 h-4" />
              Dupliquer tous
            </button>
            <button
              onClick={handleOpenCreateModal}
              data-testid="btn-create-template"
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Créer
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {paginatedTemplates.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
              <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                {searchQuery ? 'Aucun template trouvé' : 'Aucun template global'}
              </p>
            </div>
          ) : (
            paginatedTemplates.map((template) => (
              <div
                key={template.id}
                data-testid={`row-template-${template.type}`}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {template.type}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.is_active
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {template.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Sujet : {template.subject}
                      </p>
                      {template.updated_at && (
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          Modifié : {new Date(template.updated_at).toLocaleString('fr-FR')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setVersionsModal({
                            isOpen: true,
                            templateId: template.id,
                            templateType: template.type,
                          })
                        }
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition"
                        title="Historique des versions"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(template)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
                        title="Éditer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPushModal({ isOpen: true, template })}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition"
                        title="Dupliquer vers clubs"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition"
                        title="Dupliquer (copie)"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 dark:disabled:bg-slate-800 text-slate-900 dark:text-white rounded-lg transition"
            >
              Précédent
            </button>
            <span className="text-slate-700 dark:text-slate-300">
              Page {currentPage} sur {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 dark:disabled:bg-slate-800 text-slate-900 dark:text-white rounded-lg transition"
            >
              Suivant
            </button>
          </div>
        )}
      </div>

      {saveError && !saveError.ok && (
        <div
          data-testid="tmpl-save-error"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-2">
                  Erreur lors de la sauvegarde
                </h3>
                <div className="space-y-2 text-sm">
                  {saveError.mode && (
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Mode:</strong>
                      <code className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono text-xs">
                        {saveError.mode}
                      </code>
                    </div>
                  )}
                  {saveError.status && (
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Status:</strong>
                      <code className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-mono text-xs">
                        {saveError.status}
                      </code>
                    </div>
                  )}
                  {saveError.message && (
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Message:</strong>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">
                        {saveError.message}
                      </p>
                    </div>
                  )}
                  {saveError.details && (
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Details:</strong>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">
                        {saveError.details}
                      </p>
                    </div>
                  )}
                  {saveError.hint && (
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Hint:</strong>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">
                        {saveError.hint}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setSaveError(null)}
                className="px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <GlobalTemplateEditorModal
        isOpen={editorModal.isOpen}
        onClose={handleCloseModal}
        onSave={handleSaveTemplate}
        onSuccess={fetchTemplates}
        initialData={editorModal.initialData}
        mode={editorModal.mode}
        templateId={editorModal.templateId}
        existingKeys={existingKeys}
      />

      <PushTemplatesModal
        isOpen={pushModal.isOpen}
        onClose={() => setPushModal({ isOpen: false, template: null })}
        template={pushModal.template}
        onSuccess={() => {
          toast.success('Templates dupliqués avec succès');
        }}
      />

      {importModal.isOpen && importModal.previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Aperçu de l'importation
              </h2>
              <button
                onClick={() => setImportModal({ isOpen: false, previewData: null })}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  {importModal.previewData.length} template(s) sera(ont) importé(s). Les templates existants seront mis à jour.
                </p>
              </div>

              <div className="space-y-4">
                {importModal.previewData.map((template, index) => (
                  <div
                    key={index}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {template.type}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Sujet : {template.subject}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          template.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {template.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    {template.placeholders.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500 dark:text-slate-500 mb-1">
                          Placeholders : {template.placeholders.length}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.placeholders.slice(0, 5).map((ph, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-mono"
                            >
                              {`{{${ph}}}`}
                            </span>
                          ))}
                          {template.placeholders.length > 5 && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-xs">
                              +{template.placeholders.length - 5} autres
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setImportModal({ isOpen: false, previewData: null })}
                className="px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
              >
                Confirmer l'importation
              </button>
            </div>
          </div>
        </div>
      )}

      {versionsModal.isOpen && versionsModal.templateId && versionsModal.templateType && (
        <TemplateVersionsModal
          isOpen={versionsModal.isOpen}
          onClose={() =>
            setVersionsModal({ isOpen: false, templateId: null, templateType: null })
          }
          templateId={versionsModal.templateId}
          templateType={versionsModal.templateType}
          onRollback={handleRollback}
        />
      )}
    </Layout>
  );
}
