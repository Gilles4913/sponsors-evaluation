import { useState, useEffect } from 'react';
import { Mail, Edit2, Save, X, Copy, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { Layout } from './Layout';
import { saveEmailTemplateProd } from '../lib/emailTemplateSave';

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
  updated_at: string;
  created_at?: string;
}

const DEFAULT_KEYS = [
  'invitation',
  'reminder_5d',
  'reminder_10d',
  'confirmation',
  'campaign_summary',
  'sponsor_ack',
];

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  invitation: 'Invitation initiale',
  reminder_5d: 'Rappel 5 jours',
  reminder_10d: 'Rappel 10 jours',
  confirmation: 'Confirmation de réponse',
  sponsor_ack: 'Accusé réception sponsor',
  campaign_summary: 'Résumé de campagne',
};

interface TemplateSuggestion {
  id: string;
  key: string;
  subject: string;
}

export function SuperAdminEmailTemplates() {
  const toast = useToast();
  const { user } = useAuth();
  const { effectiveTenantId } = useAsTenant();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EmailTemplate>>({});
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [mode, setMode] = useState<'A' | 'B' | null>(null);
  const [hasCanonicalKeys, setHasCanonicalKeys] = useState(true);
  const [diagExpanded, setDiagExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<TemplateSuggestion[]>([]);
  const [queryType, setQueryType] = useState<'id' | 'key' | 'all'>('all');
  const [debugOut, setDebugOut] = useState<{request?:any; response?:any} | null>(null);
  const [savingDebug, setSavingDebug] = useState(false);
  const [saveError, setSaveError] = useState<{status?:number; message?:string; details?:string; hint?:string; code?:string; sentKeys?:string[]} | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data: modeAData, error: modeAError } = await supabase
        .from('email_templates')
        .select('id, tenant_id, key, subject, html, text_body, created_at')
        .is('tenant_id', null)
        .order('key');

      if (modeAError) {
        const errorMsg = modeAError.message || '';
        if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
          setMode('B');
          setQueryType('key');
          const { data: modeBData, error: modeBError } = await supabase
            .from('email_templates')
            .select('*')
            .is('tenant_id', null)
            .order('type');

          if (modeBError) throw modeBError;

          const normalizedTemplates = (modeBData || []).map((t) => ({
            ...t,
            key: t.type,
            html: t.html_body,
            placeholders: Array.isArray(t.placeholders)
              ? t.placeholders
              : JSON.parse(t.placeholders || '[]'),
          }));

          const canonicalTemplates = normalizedTemplates.filter((t) =>
            DEFAULT_KEYS.includes(t.key)
          );

          if (canonicalTemplates.length > 0) {
            setTemplates(canonicalTemplates);
            setHasCanonicalKeys(true);
          } else {
            setTemplates(normalizedTemplates);
            setHasCanonicalKeys(false);
            await fetchSuggestions('B');
          }
        } else {
          throw modeAError;
        }
      } else {
        setMode('A');
        setQueryType('key');
        const normalizedTemplates = (modeAData || []).map((t) => ({
          ...t,
          type: t.key,
          html_body: t.html,
          text_body: t.text_body || '',
          placeholders: [],
          is_active: true,
          updated_at: t.created_at || new Date().toISOString(),
        }));

        const canonicalTemplates = normalizedTemplates.filter((t) =>
          DEFAULT_KEYS.includes(t.key || '')
        );

        if (canonicalTemplates.length > 0) {
          setTemplates(canonicalTemplates);
          setHasCanonicalKeys(true);
        } else {
          setTemplates(normalizedTemplates);
          setHasCanonicalKeys(false);
          await fetchSuggestions('A');
        }
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Erreur lors du chargement des templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async (detectedMode: 'A' | 'B') => {
    try {
      if (detectedMode === 'A') {
        const { data } = await supabase
          .from('email_templates')
          .select('id, key, subject')
          .is('tenant_id', null)
          .order('created_at', { ascending: false })
          .limit(5);

        if (data) {
          setSuggestions(
            data.map((t) => ({
              id: t.id,
              key: t.key || '',
              subject: t.subject,
            }))
          );
        }
      } else {
        const { data } = await supabase
          .from('email_templates')
          .select('id, type, subject')
          .is('tenant_id', null)
          .order('updated_at', { ascending: false })
          .limit(5);

        if (data) {
          setSuggestions(
            data.map((t: any) => ({
              id: t.id,
              key: t.type,
              subject: t.subject,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingId(template.id);
    setEditForm({
      subject: template.subject,
      html_body: template.html_body,
      text_body: template.text_body,
      is_active: template.is_active,
      key: template.key || template.type,
      type: template.type,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setDebugOut(null);
    setSaveError(null);
  };

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  async function saveDebugREST(templateId: string) {
    console.log('[DEBUG REST] Starting with templateId:', templateId);
    console.log('[DEBUG REST] editForm:', editForm);

    setSavingDebug(true);
    setDebugOut(null);
    try {
      const accessToken = await getAccessToken();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/email_templates?id=eq.${templateId}`;
      const payload = {
        subject: editForm.subject ?? '',
        html: editForm.html_body ?? '',
        key: (editForm.key || editForm.type) ?? ''
      };

      console.log('[DEBUG REST] Payload:', payload);

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

      console.log('[DEBUG REST] Request:', { url, ...req, body: payload });

      const res = await fetch(url, req);
      const text = await res.text();
      console.log('[DEBUG REST] Response text:', text);

      let json: any = null;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }

      console.log('[DEBUG REST] Response status:', res.status);
      console.log('[DEBUG REST] Response json:', json);

      setDebugOut({ request: { url, ...req, body: payload }, response: { status: res.status, json } });
    } catch (e: any) {
      console.error('[DEBUG REST] Error:', e);
      setDebugOut({ response: { error: String(e) } });
    } finally {
      setSavingDebug(false);
    }
  }

  const handleSave = async (templateId: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveEmailTemplateProd(templateId, {
        subject: editForm.subject || '',
        key: (editForm.key || editForm.type) || '',
        html: editForm.html_body || '',
        text_body: editForm.text_body || '',
      });

      toast.success('Template sauvegardé avec succès');
      setEditingId(null);
      setEditForm({});
      setDebugOut(null);
      setSaveError(null);
      await fetchTemplates();
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
      const msg = error.hint || error.message || 'Erreur lors de la sauvegarde';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateToAllClubs = async (template: EmailTemplate) => {
    if (!confirm('Voulez-vous vraiment dupliquer ce template vers tous les clubs existants ? Cette opération écrasera leurs templates existants de ce type.')) {
      return;
    }

    setDuplicating(template.id);
    try {
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id');

      if (tenantsError) throw tenantsError;

      if (!tenants || tenants.length === 0) {
        toast.info('Aucun club trouvé');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const tenant of tenants) {
        try {
          const { data: existing, error: checkError } = await supabase
            .from('email_templates')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('type', template.type)
            .maybeSingle();

          if (checkError) throw checkError;

          if (existing) {
            const { error: updateError } = await supabase
              .from('email_templates')
              .update({
                subject: template.subject,
                html_body: template.html_body,
                text_body: template.text_body,
                placeholders: template.placeholders,
                is_active: template.is_active,
              })
              .eq('id', existing.id);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('email_templates')
              .insert({
                tenant_id: tenant.id,
                type: template.type,
                subject: template.subject,
                html_body: template.html_body,
                text_body: template.text_body,
                placeholders: template.placeholders,
                is_active: template.is_active,
              });

            if (insertError) throw insertError;
          }

          successCount++;
        } catch (error) {
          console.error(`Error duplicating to tenant ${tenant.id}:`, error);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(`Template dupliqué vers ${successCount} club(s)`);
      } else {
        toast.error(`${successCount} réussi(s), ${errorCount} erreur(s)`);
      }
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Erreur lors de la duplication');
    } finally {
      setDuplicating(null);
    }
  };

  const userRole = user?.app_metadata?.role || 'user';
  const projectId = import.meta.env.VITE_SUPABASE_URL
    ? new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
    : 'unknown';
  const resultStatus = templates.length > 0 ? 'trouvé' : 'non trouvé';

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
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Modèles e-mails par défaut
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Gérez les templates par défaut utilisés par tous les clubs
              </p>
            </div>
          </div>

          <div
            data-testid="tmpl-diag"
            className="mt-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setDiagExpanded(!diagExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Diagnostics
                </span>
              </div>
              {diagExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {diagExpanded && (
              <div className="px-4 pb-4 pt-2 space-y-3 text-sm border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Project ID:</strong>
                    </p>
                    <code className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block">
                      {projectId}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Utilisateur:</strong>
                    </p>
                    <code className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block">
                      {user?.email || '(none)'}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Role:</strong>
                    </p>
                    <code
                      data-testid="tmpl-diag-role"
                      className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                    >
                      {userRole}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Tenant ID:</strong>
                    </p>
                    <code
                      data-testid="tmpl-diag-tenant"
                      className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                    >
                      {effectiveTenantId || '(aucun)'}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Mode détecté:</strong>
                    </p>
                    <code
                      data-testid="tmpl-diag-mode"
                      className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                    >
                      {mode || 'N/A'}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Type de requête:</strong>
                    </p>
                    <code className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block">
                      {queryType}
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Résultat:</strong>
                    </p>
                    <code className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block">
                      {resultStatus} ({templates.length} template(s))
                    </code>
                  </div>

                  <div>
                    <p className="text-slate-600 dark:text-slate-400 mb-1">
                      <strong>Clés canoniques:</strong>
                    </p>
                    <code
                      data-testid="default-templates-count"
                      className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-mono block"
                    >
                      {hasCanonicalKeys ? 'Oui' : 'Non'} - {templates.length} affichés
                    </code>
                  </div>
                </div>

                {suggestions.length > 0 && !hasCanonicalKeys && (
                  <div className="mt-4">
                    <p className="font-semibold text-slate-900 dark:text-white mb-2">
                      5 derniers templates globaux disponibles:
                    </p>
                    <div className="space-y-2">
                      {suggestions.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-500">
                              ID: {s.id}
                            </span>
                            <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                              key: {s.key}
                            </span>
                          </div>
                          <p className="text-sm text-slate-900 dark:text-white">
                            {s.subject}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!hasCanonicalKeys && templates.length > 0 && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    Aucune clé canonique détectée
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    Affichage de tous les templates globaux disponibles. Clés attendues : {DEFAULT_KEYS.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
              <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                Aucun template par défaut trouvé
              </p>
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {TEMPLATE_TYPE_LABELS[template.key || template.type] || template.key || template.type}
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
                      {editingId !== template.id && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          Sujet : {template.subject}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId === template.id ? (
                        <>
                          <button
                            onClick={() => handleSave(template.id)}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-400 text-white rounded-lg transition"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg transition"
                          >
                            <X className="w-4 h-4" />
                            Annuler
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(template)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                            Éditer
                          </button>
                          <button
                            onClick={() => handleDuplicateToAllClubs(template)}
                            disabled={duplicating === template.id}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-400 text-white rounded-lg transition"
                          >
                            <Copy className="w-4 h-4" />
                            {duplicating === template.id ? 'Duplication...' : 'Dupliquer vers clubs'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingId === template.id && (
                    <div className="space-y-4 mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Statut
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editForm.is_active ?? false}
                            onChange={(e) =>
                              setEditForm({ ...editForm, is_active: e.target.checked })
                            }
                            className="w-4 h-4 text-blue-500 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            Template actif
                          </span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Sujet
                        </label>
                        <input
                          type="text"
                          value={editForm.subject || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, subject: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Corps HTML
                        </label>
                        <textarea
                          value={editForm.html_body || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, html_body: e.target.value })
                          }
                          rows={10}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-y"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          Corps texte brut
                        </label>
                        <textarea
                          value={editForm.text_body || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, text_body: e.target.value })
                          }
                          rows={8}
                          className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm resize-y"
                        />
                      </div>

                      {template.placeholders && template.placeholders.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Variables disponibles
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {template.placeholders.map((placeholder) => (
                              <span
                                key={placeholder}
                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-mono"
                              >
                                {`{{${placeholder}}}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border border-slate-300 dark:border-slate-600 rounded p-3 bg-slate-50 dark:bg-slate-800">
                        <div className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Debug · Save (REST minimal)</div>
                        <button
                          type="button"
                          onClick={() => saveDebugREST(template.id)}
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
                        <div className="border border-red-300 dark:border-red-700 rounded p-4 bg-red-50 dark:bg-red-900/20">
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
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
