import { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Eye,
  Send,
  History,
  AlertCircle,
  CheckCircle,
  X,
  RotateCcw,
  Code,
  Type,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { saveEmailTemplateProd } from '../lib/emailTemplateSave';

interface EmailTemplate {
  id: string;
  key: string;
  subject: string;
  html: string;
  text_body: string;
  placeholders: string[];
  is_active: boolean;
  updated_at: string;
}

interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  subject: string;
  html: string;
  text_body: string;
  placeholders: string[];
  created_at: string;
  created_by: string;
  change_notes: string;
}

interface EmailTemplateEditorProps {
  templateType: string;
  onClose: () => void;
}

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  invitation: 'Invitation initiale',
  reminder_5d: 'Rappel 5 jours',
  reminder_10d: 'Rappel 10 jours',
  confirmation: 'Confirmation de réponse',
  sponsor_ack: 'Accusé réception sponsor',
  campaign_summary: 'Résumé de campagne',
};

const MOCK_DATA: Record<string, any> = {
  tenant_name: 'FC Exemple',
  tenant_email: 'contact@fcexemple.fr',
  contact_name: 'Jean Dupont',
  company: 'ACME Corp',
  email: 'jean.dupont@acme.fr',
  campaign_title: 'Sponsoring Écrans LED 2024',
  campaign_description: 'Projet d\'installation d\'écrans LED sur le terrain principal',
  annual_price: '5000',
  response_url: 'https://example.com/respond/abc123',
  response_status: 'Oui - Intéressé',
  deadline: '31 décembre 2024',
  total_invitations: '50',
  yes_count: '15',
  maybe_count: '10',
  no_count: '5',
  total_pledged: '75000',
  objective_amount: '100000',
  achievement_rate: '75',
};

export function EmailTemplateEditor({ templateType, onClose }: EmailTemplateEditorProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [textBody, setTextBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [editMode, setEditMode] = useState<'html' | 'text'>('html');
  const [testEmail, setTestEmail] = useState('');
  const [debugOut, setDebugOut] = useState<{request?:any; response?:any} | null>(null);
  const [savingDebug, setSavingDebug] = useState(false);
  const [saveError, setSaveError] = useState<{status?:number; message?:string; details?:string; hint?:string; code?:string; sentKeys?:string[]} | null>(null);

  useEffect(() => {
    fetchTemplate();
  }, [templateType]);

  const fetchTemplate = async () => {
    setLoading(true);
    try {
      const { data: templateData, error: templateError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('key', templateType)
        .maybeSingle();

      if (templateError) throw templateError;

      if (templateData) {
        setTemplate({
          ...templateData,
          placeholders: Array.isArray(templateData.placeholders)
            ? templateData.placeholders
            : JSON.parse(templateData.placeholders || '[]'),
        });
        setSubject(templateData.subject);
        setHtmlBody(templateData.html);
        setTextBody(templateData.text_body || '');
      }

      if (templateData?.id) {
        const { data: versionsData } = await supabase
          .from('email_template_versions')
          .select('*')
          .eq('template_id', templateData.id)
          .order('version_number', { ascending: false })
          .limit(20);

        if (versionsData) {
          setVersions(
            versionsData.map((v) => ({
              ...v,
              placeholders: Array.isArray(v.placeholders)
                ? v.placeholders
                : JSON.parse(v.placeholders || '[]'),
            }))
          );
        }
      }
    } catch (error: any) {
      toast.error('Erreur lors du chargement du template');
    } finally {
      setLoading(false);
    }
  };

  const missingVariables = useMemo(() => {
    if (!template) return [];
    const text = `${subject} ${editMode === 'html' ? htmlBody : textBody}`;
    const foundVariables = text.match(/\{\{(\w+)\}\}/g)?.map((v) => v.slice(2, -2)) || [];
    return foundVariables.filter((v) => !template.placeholders.includes(v));
  }, [subject, htmlBody, textBody, template, editMode]);

  const unusedVariables = useMemo(() => {
    if (!template) return [];
    const text = `${subject} ${htmlBody} ${textBody}`;
    const usedVariables = text.match(/\{\{(\w+)\}\}/g)?.map((v) => v.slice(2, -2)) || [];
    return template.placeholders.filter((p) => !usedVariables.includes(p));
  }, [subject, htmlBody, textBody, template]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  async function saveDebugREST() {
    if (!template) {
      setDebugOut({ response: { error: 'No template loaded' } });
      return;
    }

    setSavingDebug(true);
    setDebugOut(null);
    try {
      const accessToken = await getAccessToken();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/email_templates?id=eq.${template.id}`;
      const payload = {
        subject: subject ?? '',
        html: htmlBody ?? '',
        key: template.key ?? ''
      };

      const req = {
        method: 'PATCH',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
          'Authorization': accessToken ? `Bearer ${accessToken}` : `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY!}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      };

      const res = await fetch(url, req);
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }

      setDebugOut({ request: { url, ...req, body: payload }, response: { status: res.status, json } });
    } catch (e: any) {
      setDebugOut({ response: { error: String(e) } });
    } finally {
      setSavingDebug(false);
    }
  }

  const handleSave = async () => {
    if (!template) return;

    setSaving(true);
    setSaveError(null);
    try {
      await saveEmailTemplateProd(template.id, {
        subject: subject || '',
        key: template.key || '',
        html: htmlBody || '',
        text_body: textBody || '',
      });

      toast.success('Template enregistré avec succès');
      setSaveError(null);
      fetchTemplate();
    } catch (error: any) {
      console.error('Error saving template:', error);
      setSaveError({
        status: error.status,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        sentKeys: error.sentKeys,
      });
      const msg = error.hint || error.message || 'Erreur lors de l\'enregistrement';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !template) return;

    try {
      const previewHtml = replacePlaceholders(htmlBody, MOCK_DATA);

      console.log('Test email would be sent to:', testEmail);
      console.log('Subject:', replacePlaceholders(subject, MOCK_DATA));
      console.log('HTML:', previewHtml);

      toast.success(`Email de test simulé pour ${testEmail}`);
    } catch (error: any) {
      toast.error('Erreur lors de l\'envoi du test');
    }
  };

  const handleRestoreVersion = async (version: TemplateVersion) => {
    if (!template) return;

    if (!confirm(`Restaurer la version ${version.version_number} ?`)) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: version.subject,
          html: version.html,
          text_body: version.text_body,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('id', template.id);

      if (error) throw error;

      toast.success('Version restaurée avec succès');
      setShowVersions(false);
      fetchTemplate();
    } catch (error: any) {
      toast.error('Erreur lors de la restauration');
    }
  };

  const replacePlaceholders = (text: string, data: Record<string, any>): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  };

  const previewSubject = useMemo(() => replacePlaceholders(subject, MOCK_DATA), [subject]);
  const previewHtml = useMemo(() => replacePlaceholders(htmlBody, MOCK_DATA), [htmlBody]);
  const previewText = useMemo(() => replacePlaceholders(textBody, MOCK_DATA), [textBody]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-white">Chargement...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6">
          <p className="text-slate-900 dark:text-white">Template non trouvé</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-200 rounded-lg">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-7xl w-full shadow-2xl my-8">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {TEMPLATE_TYPE_LABELS[templateType] || templateType}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Éditeur de template email
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {missingVariables.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-red-900 dark:text-red-300 mb-1">
                    Variables non reconnues
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-400">
                    Ces variables ne sont pas dans la liste autorisée : {missingVariables.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {unusedVariables.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-300 mb-1">
                    Variables non utilisées
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    {unusedVariables.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Variables disponibles
            </p>
            <div className="flex flex-wrap gap-2">
              {template.placeholders.map((placeholder) => (
                <button
                  key={placeholder}
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${placeholder}}}`);
                    toast.success('Variable copiée');
                  }}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-mono hover:bg-blue-200 dark:hover:bg-blue-700 transition"
                >
                  {`{{${placeholder}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Sujet
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Sujet de l'email"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setEditMode('html')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                    editMode === 'html'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  HTML
                </button>
                <button
                  onClick={() => setEditMode('text')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                    editMode === 'text'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  Texte
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {editMode === 'html' ? 'Corps HTML' : 'Corps Texte'}
                </label>
                <textarea
                  value={editMode === 'html' ? htmlBody : textBody}
                  onChange={(e) =>
                    editMode === 'html' ? setHtmlBody(e.target.value) : setTextBody(e.target.value)
                  }
                  rows={20}
                  className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition font-mono text-sm"
                  placeholder={editMode === 'html' ? 'HTML du template' : 'Version texte du template'}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || missingVariables.length > 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-xl font-semibold transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-xl font-semibold transition hover:bg-blue-200 dark:hover:bg-blue-800"
                >
                  <Eye className="w-4 h-4" />
                  Aperçu
                </button>
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <History className="w-4 h-4" />
                  {versions.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {versions.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="border border-slate-300 dark:border-slate-600 rounded p-3 bg-slate-50 dark:bg-slate-800 mb-4">
                  <div className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Debug · Save (REST minimal)</div>
                  <button
                    type="button"
                    onClick={saveDebugREST}
                    disabled={savingDebug}
                    className="px-3 py-1 rounded bg-black dark:bg-slate-700 text-white disabled:opacity-50"
                    data-testid="btn-save-debug-rest"
                  >
                    {savingDebug ? 'Saving…' : 'Save (debug via REST)'}
                  </button>
                  {debugOut && (
                    <div className="mt-3 grid gap-2">
                      <div>
                        <div className="text-xs font-mono opacity-70 dark:text-slate-400">REQUEST</div>
                        <pre className="text-xs bg-white dark:bg-slate-900 p-2 rounded overflow-auto border border-slate-200 dark:border-slate-700">{JSON.stringify(debugOut.request, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="text-xs font-mono opacity-70 dark:text-slate-400">RESPONSE</div>
                        <pre className="text-xs bg-white dark:bg-slate-900 p-2 rounded overflow-auto border border-slate-200 dark:border-slate-700">{JSON.stringify(debugOut.response, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>

                {saveError && (
                  <div className="border border-red-300 dark:border-red-700 rounded p-4 bg-red-50 dark:bg-red-900/20 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-red-800 dark:text-red-200 mb-2">
                          Erreur lors de la sauvegarde
                        </div>
                        {saveError.status && (
                          <div className="text-sm mb-1">
                            <span className="font-medium text-red-700 dark:text-red-300">Status:</span>{' '}
                            <span className="text-red-600 dark:text-red-400">{saveError.status}</span>
                          </div>
                        )}
                        {saveError.code && (
                          <div className="text-sm mb-1">
                            <span className="font-medium text-red-700 dark:text-red-300">Code:</span>{' '}
                            <span className="text-red-600 dark:text-red-400">{saveError.code}</span>
                          </div>
                        )}
                        {saveError.message && (
                          <div className="text-sm mb-1">
                            <span className="font-medium text-red-700 dark:text-red-300">Message:</span>{' '}
                            <span className="text-red-600 dark:text-red-400">{saveError.message}</span>
                          </div>
                        )}
                        {saveError.details && (
                          <div className="text-sm mb-1">
                            <span className="font-medium text-red-700 dark:text-red-300">Détails:</span>{' '}
                            <span className="text-red-600 dark:text-red-400">{saveError.details}</span>
                          </div>
                        )}
                        {saveError.hint && (
                          <div className="text-sm mb-1">
                            <span className="font-medium text-red-700 dark:text-red-300">Hint:</span>{' '}
                            <span className="text-red-600 dark:text-red-400">{saveError.hint}</span>
                          </div>
                        )}
                        {saveError.sentKeys && saveError.sentKeys.length > 0 && (
                          <div className="text-sm">
                            <span className="font-medium text-red-700 dark:text-red-300">Clés envoyées:</span>{' '}
                            <span className="text-red-600 dark:text-red-400">{saveError.sentKeys.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Envoyer un email de test
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1 px-4 py-2 border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    placeholder="votre@email.fr"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={!testEmail}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-semibold transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Test
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {showPreview && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
                    Aperçu avec données fictives
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Sujet :</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{previewSubject}</p>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Aperçu HTML :</p>
                      <div
                        className="bg-white dark:bg-slate-800 rounded-lg p-4 overflow-auto max-h-96 text-sm border border-slate-200 dark:border-slate-700"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {showVersions && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
                    Historique des versions
                  </h3>
                  {versions.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">Aucune version sauvegardée</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-slate-900 dark:text-white">
                                Version {version.version_number}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                {new Date(version.created_at).toLocaleString('fr-FR')}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 line-clamp-1">
                                {version.subject}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRestoreVersion(version)}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Restaurer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
