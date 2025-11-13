import { useState, useMemo, useEffect } from 'react';
import { X, AlertTriangle, Eye, Code, FileSignature, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAsTenant } from '../hooks/useAsTenant';
import { saveEmailTemplateMin } from '../services/emailTemplates';
import { useToast } from '../contexts/ToastContext';
import { saveEmailTemplateProd } from '../lib/emailTemplateSave';

interface GlobalTemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: TemplateFormData) => Promise<void>;
  onSuccess?: () => void;
  initialData?: TemplateFormData;
  mode: 'create' | 'edit';
  templateId?: string;
  existingKeys?: string[];
}

export interface TemplateFormData {
  type: string;
  subject: string;
  html_body: string;
  is_active: boolean;
}

const KNOWN_PLACEHOLDERS = [
  'club_name',
  'campaign_title',
  'invite_link',
  'deadline',
  'sponsor_name',
  'tenant_name',
  'tenant_email',
  'contact_name',
  'response_url',
  'annual_price',
  'campaign_description',
  'response_status',
  'company',
  'email',
  'total_invitations',
  'yes_count',
  'maybe_count',
  'no_count',
  'total_pledged',
  'objective_amount',
  'achievement_rate',
];

const DEFAULT_TEST_DATA = {
  club_name: 'Club Sportif Example',
  campaign_title: 'Nouveau Panneau LED 2024',
  invite_link: 'https://example.com/respond/abc123',
  deadline: '31 décembre 2024',
  sponsor_name: 'Jean Dupont',
  tenant_name: 'Mon Club',
  tenant_email: 'contact@monclub.fr',
  contact_name: 'Marie Martin',
  response_url: 'https://example.com/respond/xyz789',
  annual_price: '1500',
  campaign_description: 'Installation d\'un panneau LED publicitaire',
  response_status: 'Oui, intéressé',
  company: 'Entreprise ABC',
  email: 'contact@entreprise-abc.fr',
  total_invitations: '50',
  yes_count: '15',
  maybe_count: '10',
  no_count: '5',
  total_pledged: '22500',
  objective_amount: '30000',
  achievement_rate: '75',
};

export function GlobalTemplateEditorModal({
  isOpen,
  onClose,
  onSave,
  onSuccess,
  initialData,
  mode,
  templateId,
  existingKeys = [],
}: GlobalTemplateEditorModalProps) {
  const toast = useToast();
  const { effectiveTenantId } = useAsTenant();
  const [formData, setFormData] = useState<TemplateFormData>(
    initialData || {
      type: '',
      subject: '',
      html_body: '',
      is_active: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [testData, setTestData] = useState(JSON.stringify(DEFAULT_TEST_DATA, null, 2));
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);
  const [tenantSignature, setTenantSignature] = useState<string>('');
  const [tenantRgpd, setTenantRgpd] = useState<string>('');
  const [loadingSignature, setLoadingSignature] = useState(false);
  const [errorState, setErrorState] = useState<{
    status?: number;
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
    sentKeys?: string[];
  } | null>(null);
  const [debugOut, setDebugOut] = useState<{request?:any; response?:any} | null>(null);
  const [savingDebug, setSavingDebug] = useState(false);

  const extractedPlaceholders = useMemo(() => {
    const text = `${formData.subject} ${formData.html_body}`;
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
  }, [formData.subject, formData.html_body]);

  const unknownPlaceholders = useMemo(() => {
    return extractedPlaceholders.filter((p) => !KNOWN_PLACEHOLDERS.includes(p));
  }, [extractedPlaceholders]);

  useEffect(() => {
    if (showSignaturePreview && effectiveTenantId) {
      loadTenantSignature();
    }
  }, [showSignaturePreview, effectiveTenantId]);

  const loadTenantSignature = async () => {
    if (!effectiveTenantId) return;

    setLoadingSignature(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('email_signature_html, rgpd_content_md')
        .eq('id', effectiveTenantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTenantSignature(data.email_signature_html || '');
        setTenantRgpd(data.rgpd_content_md || '');
      }
    } catch (error) {
      console.error('Error loading tenant signature:', error);
    } finally {
      setLoadingSignature(false);
    }
  };

  const replacePlaceholders = (text: string, data: any): string => {
    let result = text;
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, data[key]);
    });
    return result;
  };

  const previewHtml = useMemo(() => {
    let html = formData.html_body;
    try {
      const data = JSON.parse(testData);
      html = replacePlaceholders(html, data);
    } catch (e) {
      return formData.html_body;
    }
    return html;
  }, [formData.html_body, testData]);

  const previewSubject = useMemo(() => {
    try {
      const data = JSON.parse(testData);
      return replacePlaceholders(formData.subject, data);
    } catch (e) {
      return formData.subject;
    }
  }, [formData.subject, testData]);

  const previewWithSignature = useMemo(() => {
    let fullHtml = previewHtml;

    if (tenantSignature) {
      fullHtml += `<hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;" />${tenantSignature}`;
    }

    if (tenantRgpd) {
      const rgpdHtml = tenantRgpd
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('<br />');
      fullHtml += `<hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;" /><small style="color: #666; font-size: 11px;">${rgpdHtml}</small>`;
    }

    return fullHtml;
  }, [previewHtml, tenantSignature, tenantRgpd]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  async function saveDebugREST() {
    if (!templateId) {
      setDebugOut({ response: { error: 'No templateId in edit mode' } });
      return;
    }

    setSavingDebug(true);
    setDebugOut(null);
    try {
      const accessToken = await getAccessToken();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/email_templates?id=eq.${templateId}`;
      const payload = {
        subject: formData.subject ?? '',
        html: formData.html_body ?? '',
        key: formData.type ?? ''
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
    if (!formData.type.trim()) {
      alert('Le type est obligatoire');
      return;
    }

    if (!formData.subject.trim()) {
      alert('Le sujet est obligatoire');
      return;
    }

    if (mode === 'create' && existingKeys.includes(formData.type)) {
      alert(`Le type "${formData.type}" existe déjà. Veuillez choisir un type unique.`);
      return;
    }

    setSaving(true);
    setErrorState(null);

    try {
      // Mode EDIT : appel robuste avec stop-list
      if (mode === 'edit' && templateId) {
        await saveEmailTemplateProd(templateId, {
          subject: formData.subject,
          html: formData.html_body,
          key: formData.type,
          text_body: formData.text_body || '',
        });
        toast.success('Modèle enregistré');
        if (onSuccess) await onSuccess();
        onClose();
        return;
      }

      // Mode CREATE : utiliser onSave
      await onSave(formData);
      onClose();
    } catch (e: any) {
      console.error('Error saving template:', e);
      setErrorState({
        status: e?.status,
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
        sentKeys: e?.sentKeys,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {mode === 'create' ? 'Créer un template' : 'Éditer le template'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="border-b border-slate-200 dark:border-slate-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition ${
                activeTab === 'edit'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Code className="w-4 h-4" />
              Édition
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              data-testid="tab-preview"
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition ${
                activeTab === 'preview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Eye className="w-4 h-4" />
              Prévisualisation
            </button>
            {effectiveTenantId && (
              <button
                onClick={() => {
                  setActiveTab('preview');
                  setShowSignaturePreview(true);
                }}
                data-testid="tab-preview-signature"
                className={`flex items-center gap-2 px-6 py-3 border-b-2 transition ${
                  activeTab === 'preview' && showSignaturePreview
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <FileSignature className="w-4 h-4" />
                Prévisualisation (avec signature)
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {errorState && (
            <div
              data-testid="tmpl-save-error"
              className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-red-900 dark:text-red-400 mb-3">
                    Erreur lors de la sauvegarde
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong className="text-red-800 dark:text-red-300">Status:</strong>
                      <code className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 rounded font-mono text-xs text-red-900 dark:text-red-300">
                        {errorState.status}
                      </code>
                    </div>
                    <div>
                      <strong className="text-red-800 dark:text-red-300">Message:</strong>
                      <p className="mt-1 text-red-700 dark:text-red-400">
                        {errorState.message}
                      </p>
                    </div>
                    {errorState.details && (
                      <div>
                        <strong className="text-red-800 dark:text-red-300">Details:</strong>
                        <p className="mt-1 text-red-700 dark:text-red-400">
                          {errorState.details}
                        </p>
                      </div>
                    )}
                    {errorState.hint && (
                      <div>
                        <strong className="text-red-800 dark:text-red-300">Hint:</strong>
                        <p className="mt-1 text-red-700 dark:text-red-400">
                          {errorState.hint}
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setErrorState(null)}
                    className="mt-3 text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Fermer ce message
                  </button>
                </div>
                <button
                  onClick={() => setErrorState(null)}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition"
                >
                  <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'edit' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Type (unique)
                </label>
                <input
                  type="text"
                  data-testid="tmpl-key"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  disabled={mode === 'edit'}
                  placeholder="ex: invitation_custom"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Sujet
                </label>
                <input
                  type="text"
                  data-testid="tmpl-subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="ex: Invitation : {{campaign_title}}"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Corps HTML
                </label>
                <textarea
                  data-testid="tmpl-html"
                  value={formData.html_body}
                  onChange={(e) => setFormData({ ...formData, html_body: e.target.value })}
                  rows={16}
                  placeholder="<html>...</html>"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-y"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-500 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Template actif
                  </span>
                </label>
              </div>

              {unknownPlaceholders.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-400 mb-2">
                        Placeholders inconnus détectés
                      </h4>
                      <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-500 space-y-1">
                        {unknownPlaceholders.map((p) => (
                          <li key={p}>
                            <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">
                              {`{{${p}}}`}
                            </code>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                        Placeholders connus : {KNOWN_PLACEHOLDERS.map((p) => `{{${p}}}`).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {extractedPlaceholders.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
                    Placeholders détectés ({extractedPlaceholders.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {extractedPlaceholders.map((p) => (
                      <span
                        key={p}
                        className={`px-2 py-1 rounded text-xs font-mono ${
                          KNOWN_PLACEHOLDERS.includes(p)
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}
                      >
                        {`{{${p}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Données de test (JSON)
                </label>
                <textarea
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-y"
                />
              </div>

              {showSignaturePreview && effectiveTenantId && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSignaturePreview(false)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ← Retour à la prévisualisation simple
                  </button>
                  {loadingSignature && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Chargement de la signature...
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {showSignaturePreview ? 'Sujet (avec placeholders remplacés)' : 'Sujet'}
                </label>
                {showSignaturePreview && (
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white">
                    {previewSubject}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {showSignaturePreview && effectiveTenantId ? 'Aperçu avec signature & RGPD' : 'Aperçu'}
                </label>
                <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-900 overflow-auto max-h-96">
                  <div
                    data-testid="preview-content"
                    dangerouslySetInnerHTML={{
                      __html: showSignaturePreview && effectiveTenantId ? previewWithSignature : previewHtml,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {errorState && (
          <div data-testid="tmpl-save-error" className="mx-6 mt-4 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-red-800 dark:text-red-200 rounded p-3 text-sm">
            <div className="font-semibold mb-1">Erreur de sauvegarde</div>
            <div>status: {errorState.status ?? '—'}</div>
            <div>message: {errorState.message ?? '—'}</div>
            <div>details: {errorState.details ?? '—'}</div>
            <div>hint: {errorState.hint ?? '—'}</div>
            <div>code: {errorState.code ?? '—'}</div>
            <div>sentKeys: {errorState.sentKeys?.join(', ') ?? '—'}</div>
            <button
              type="button"
              onClick={() => setErrorState(null)}
              className="text-xs underline mt-1 hover:no-underline"
            >
              Effacer debug
            </button>
          </div>
        )}

        {mode === 'edit' && (
          <div className="mx-6 mt-4 border border-slate-300 dark:border-slate-600 rounded p-3 bg-slate-50 dark:bg-slate-800">
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
        )}

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg transition disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="btn-save-template"
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-400 text-white rounded-lg transition"
          >
            {saving ? 'Sauvegarde...' : mode === 'create' ? 'Créer' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}
