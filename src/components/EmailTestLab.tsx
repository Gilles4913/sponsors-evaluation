import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAsTenant } from '../hooks/useAsTenant';
import { supabase } from '../lib/supabase';
import { loadTenantBasics, TenantBasics } from '../lib/tenantContext';
import { appendLegal } from '../lib/emailLegal';
import { Mail, RefreshCw, Eye, Send, AlertCircle, CheckCircle } from 'lucide-react';

interface NormalizedTemplate {
  id: string;
  scope: 'global' | 'tenant';
  key: string;
  subject: string;
  html: string;
  placeholders: Record<string, string>;
  tenant_id: string | null;
}


export default function EmailTestLab() {
  const { user, profile } = useAuth();
  const { effectiveTenantId, isMasquerading } = useAsTenant();

  const [templates, setTemplates] = useState<NormalizedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'tenant'>('all');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [variables, setVariables] = useState(JSON.stringify({
    club_name: 'A2Display FC',
    campaign_title: 'Ecran LED 2025',
    invite_link: 'https://example.com/p/abc',
    deadline: '2025-12-31',
    sponsor_name: 'SAS Martin',
    contact_name: 'Jean Dupont',
    tenant_name: 'A2Display FC',
    tenant_email: 'contact@a2display.fr',
    response_url: 'https://example.com/respond/xyz',
    annual_price: '1500'
  }, null, 2));

  const [preview, setPreview] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenantSettings, setTenantSettings] = useState<TenantBasics | null>(null);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>('');

  // Diagnostics
  const [diagnostics, setDiagnostics] = useState({
    projectId: '',
    jwtRole: '',
    asTenantId: '',
    globalCount: 0,
    tenantCount: 0,
    userRole: '',
    sqlQuery: '',
    lastError: '',
    lastErrorCode: '',
    schemaMode: '',
    canSelectTenants: null as boolean | null,
    tenantsTestError: ''
  });

  const projectId = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown';

  useEffect(() => {
    loadTemplates();
    loadTenantSettings();
    runDiagnostics();
    if (effectiveTenantId) {
      loadCampaigns();
      loadSponsors();
    }
  }, [effectiveTenantId]);

  const runDiagnostics = async () => {
    const jwtRole = user?.app_metadata?.role || profile?.role || 'unknown';
    const currentAsTenantId = effectiveTenantId || 'none';

    let canSelectTenants = null;
    let tenantsTestError = '';

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .limit(1);

      if (error) {
        canSelectTenants = false;
        tenantsTestError = `${error.code || 'ERROR'}: ${error.message}`;
      } else {
        canSelectTenants = true;
      }
    } catch (err: any) {
      canSelectTenants = false;
      tenantsTestError = err?.message || String(err);
    }

    setDiagnostics(prev => ({
      ...prev,
      projectId,
      jwtRole: String(jwtRole),
      asTenantId: currentAsTenantId,
      canSelectTenants,
      tenantsTestError
    }));
  };

  const loadTenantSettings = async () => {
    if (!effectiveTenantId) return;

    try {
      const data = await loadTenantBasics(supabase, effectiveTenantId);
      if (data) setTenantSettings(data);
    } catch (err) {
      console.error('Error loading tenant settings:', err);
    }
  };

  const loadCampaigns = async () => {
    if (!effectiveTenantId) return;

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, title, deadline')
        .eq('tenant_id', effectiveTenantId)
        .order('deadline', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    }
  };

  const loadSponsors = async () => {
    if (!effectiveTenantId) return;

    try {
      const { data, error } = await supabase
        .from('sponsors')
        .select('id, company, contact_name, email')
        .eq('tenant_id', effectiveTenantId)
        .order('company', { ascending: true });

      if (error) throw error;
      setSponsors(data || []);
    } catch (err) {
      console.error('Error loading sponsors:', err);
    }
  };

  const loadVariablesFromSelections = () => {
    const campaign = campaigns.find(c => c.id === selectedCampaignId);
    const sponsor = sponsors.find(s => s.id === selectedSponsorId);

    const vars: Record<string, string> = {
      club_name: tenantSettings?.name || 'Club Name',
      campaign_title: campaign?.title || 'Campaign Title',
      deadline: campaign?.deadline || '2025-12-31',
      sponsor_name: sponsor?.contact_name || sponsor?.company || 'Sponsor Name',
      invite_link: 'https://example.com/p/abc'
    };

    setVariables(JSON.stringify(vars, null, 2));
  };

  const loadTemplatesFlex = async () => {
    setLoading(true);
    setError(null);

    try {
      const tenantId = effectiveTenantId;
      const userRole = user?.app_metadata?.role || profile?.role || 'unknown';

      let normalized: NormalizedTemplate[] = [];
      let schemaMode = '';
      let rawData: any[] = [];
      let finalSql = '';

      const sqlA = `
        select id, tenant_id, key, subject, html, created_at
        from email_templates
        where (tenant_id is null OR tenant_id = '${tenantId || 'null'}')
        order by (tenant_id is null) asc, created_at desc
      `;

      const { data: dataA, error: errorA } = await supabase
        .from('email_templates')
        .select('id, tenant_id, key, subject, html, created_at')
        .or(`tenant_id.is.null,tenant_id.eq.${tenantId || 'null'}`)
        .order('created_at', { ascending: false });

      const isUnknownColumnError = errorA?.message?.includes('column') ||
                                    errorA?.code === '42703' ||
                                    errorA?.message?.includes('does not exist');

      if (!errorA && dataA && dataA.length > 0 && 'key' in dataA[0]) {
        schemaMode = 'Mode A (key/subject/html)';
        finalSql = sqlA;
        rawData = dataA;

        normalized = dataA.map((t: any) => ({
          id: t.id,
          scope: t.tenant_id ? 'tenant' : 'global' as const,
          key: t.key || 'unknown',
          subject: t.subject || '',
          html: t.html || '',
          placeholders: {},
          tenant_id: t.tenant_id
        }));

      } else if (isUnknownColumnError || errorA) {
        const sqlB = `
          select id, tenant_id, type, subject, html_body, text_body, placeholders, is_active, updated_at
          from email_templates
          where (tenant_id is null OR tenant_id = '${tenantId || 'null'}')
          order by (tenant_id is null) asc, coalesce(updated_at, now()) desc
        `;

        const { data: dataB, error: errorB } = await supabase
          .from('email_templates')
          .select('id, tenant_id, type, subject, html_body, text_body, placeholders, is_active, updated_at')
          .or(`tenant_id.is.null,tenant_id.eq.${tenantId || 'null'}`)
          .order('updated_at', { ascending: false });

        if (errorB) {
          const isRlsError = errorB.code === '42501' ||
                             errorB.code === 'PGRST301' ||
                             errorB.message?.includes('permission denied') ||
                             errorB.message?.includes('policy');

          const errorContext = isRlsError
            ? `RLS? ${errorB.message || errorB.code || String(errorB)}`
            : errorB.message || errorB.code || String(errorB);

          throw new Error(`Schema A failed: ${errorA?.message || 'unknown column'}. Schema B failed: ${errorContext}`);
        }

        schemaMode = 'Mode B (type/subject/html_body)';
        finalSql = sqlB;
        rawData = dataB || [];

        if (dataB && dataB.length > 0) {
          normalized = dataB.map((t: any) => ({
            id: t.id,
            scope: t.tenant_id ? 'tenant' : 'global' as const,
            key: t.type || 'unknown',
            subject: t.subject || '',
            html: t.html_body || '',
            placeholders: typeof t.placeholders === 'object' ? t.placeholders : {},
            tenant_id: t.tenant_id
          }));
        }
      }

      setTemplates(normalized);

      const globalCount = normalized.filter(t => t.scope === 'global').length;
      const tenantCount = normalized.filter(t => t.scope === 'tenant').length;

      setDiagnostics(prev => ({
        ...prev,
        globalCount,
        tenantCount,
        userRole: String(userRole),
        sqlQuery: finalSql,
        lastError: '',
        lastErrorCode: '',
        schemaMode
      }));

      console.log('Templates loaded:', {
        schemaMode,
        rawCount: rawData.length,
        normalizedCount: normalized.length,
        globalCount,
        tenantCount
      });

    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const errorCode = err?.code || err?.status || '';
      setError(errorMsg);
      setDiagnostics(prev => ({
        ...prev,
        lastError: errorMsg,
        lastErrorCode: String(errorCode),
        schemaMode: 'Failed'
      }));
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = loadTemplatesFlex;

  const applyPlaceholders = (text: string, vars: Record<string, string>): string => {
    let result = text;
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, vars[key]);
    });
    return result;
  };

  const buildRgpdFooter = (): string => {
    if (!tenantSettings) return '';

    const rgpdText = tenantSettings.rgpd_content_md
      ? tenantSettings.rgpd_content_md.replace(/\n/g, '<br/>')
      : '';

    return `
      <div style="margin-top: 30px; padding: 20px; background: #f1f5f9; border-radius: 8px; font-size: 12px; color: #64748b;">
        ${rgpdText}
      </div>
    `;
  };

  const handlePreview = () => {
    try {
      setError(null);
      setSuccess(null);

      const vars = JSON.parse(variables);
      const template = templates.find(t => t.id === selectedTemplateId);

      if (!template) {
        setError('Please select a template');
        return;
      }

      const subject = applyPlaceholders(template.subject, vars);
      let html = applyPlaceholders(template.html, vars);

      html = appendLegal(html, tenantSettings);

      setPreviewSubject(subject);
      setPreview(html);

    } catch (err: any) {
      setError('Invalid JSON in variables: ' + err.message);
    }
  };

  const handleSendTest = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      if (!recipientEmail) {
        setError('Please enter recipient email');
        return;
      }

      const vars = JSON.parse(variables);
      const template = templates.find(t => t.id === selectedTemplateId);

      if (!template) {
        setError('Please select a template');
        return;
      }

      const subject = applyPlaceholders(template.subject, vars);
      let html = applyPlaceholders(template.html, vars);

      html = appendLegal(html, tenantSettings);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-test-email`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const payload = {
        to: recipientEmail,
        subject,
        html,
        meta: {
          templateId: template.id,
          scope: template.scope,
          tenantId: effectiveTenantId
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send test email');
      }

      setSuccess(`Test email sent successfully! ID: ${result.id || 'N/A'}`);

    } catch (err: any) {
      setError('Send failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (scopeFilter === 'all') return true;
    return t.scope === scopeFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Email Test Lab</h1>
              <p className="text-sm text-slate-600">
                Project: <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{projectId}</span>
                {effectiveTenantId && (
                  <>
                    {' '} | Tenant: <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{effectiveTenantId}</span>
                  </>
                )}
                {isMasquerading && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-semibold">
                    MASQUERADE
                  </span>
                )}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Controls */}
          <div className="space-y-6">
            {/* Template Selection */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Template Selection</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Scope Filter
                  </label>
                  <select
                    data-testid="scope-select"
                    value={scopeFilter}
                    onChange={(e) => setScopeFilter(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Templates</option>
                    <option value="global">Global Only</option>
                    <option value="tenant">My Club Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Template ({filteredTemplates.length} available)
                  </label>
                  <select
                    data-testid="tmpl-select"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={filteredTemplates.length === 0}
                  >
                    <option value="">-- Select Template --</option>
                    {filteredTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.scope === 'global' ? 'Global' : 'Club'}] {t.key}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Test Recipient Email
                  </label>
                  <input
                    data-testid="to-input"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {effectiveTenantId && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Campaign (optional)
                      </label>
                      <select
                        data-testid="campaign-select"
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">-- Select Campaign --</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.deadline})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Sponsor (optional)
                      </label>
                      <select
                        data-testid="sponsor-select"
                        value={selectedSponsorId}
                        onChange={(e) => setSelectedSponsorId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">-- Select Sponsor --</option>
                        {sponsors.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.company} {s.contact_name ? `(${s.contact_name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Variables */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Variables (JSON)</h2>
                {effectiveTenantId && (
                  <button
                    data-testid="btn-load-vars"
                    onClick={loadVariablesFromSelections}
                    className="px-3 py-1 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Charger variables
                  </button>
                )}
              </div>
              <textarea
                data-testid="vars-json"
                value={variables}
                onChange={(e) => setVariables(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-3 gap-3">
                <button
                  data-testid="btn-preview"
                  onClick={handlePreview}
                  disabled={!selectedTemplateId}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>

                <button
                  data-testid="btn-send"
                  onClick={handleSendTest}
                  disabled={!selectedTemplateId || !recipientEmail || loading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>

                <button
                  data-testid="btn-reload"
                  onClick={loadTemplates}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Reload
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Preview & Diagnostics */}
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-white rounded-lg shadow-sm p-6" data-testid="preview-pane">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Preview</h2>

              {previewSubject && (
                <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Subject:</div>
                  <div className="text-sm text-slate-900">{previewSubject}</div>
                </div>
              )}

              {preview ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={preview}
                    className="w-full h-[600px] bg-white"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-lg text-slate-400">
                  <div className="text-center">
                    <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a template and click Preview</p>
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostics */}
            <div className="bg-white rounded-lg shadow-sm p-6" data-testid="diag-pane">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                Diagnostics
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Project ID:</span>
                  <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                    {diagnostics.projectId || projectId}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">JWT Role:</span>
                  <span className="font-mono text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold">
                    {diagnostics.jwtRole || 'unknown'}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">As Tenant ID:</span>
                  <span className="font-mono text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                    {diagnostics.asTenantId || 'none'}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Schema Mode:</span>
                  <span className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">
                    {diagnostics.schemaMode || 'Unknown'}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Global Templates:</span>
                  <span className="font-semibold text-slate-900">{diagnostics.globalCount}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Tenant Templates:</span>
                  <span className="font-semibold text-slate-900">{diagnostics.tenantCount}</span>
                </div>

                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Can Select Tenants?</span>
                  <span className={`font-mono text-xs px-2 py-1 rounded font-semibold ${
                    diagnostics.canSelectTenants === true
                      ? 'bg-green-100 text-green-800'
                      : diagnostics.canSelectTenants === false
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {diagnostics.canSelectTenants === true
                      ? 'YES'
                      : diagnostics.canSelectTenants === false
                      ? 'NO (RLS?)'
                      : 'Testing...'}
                  </span>
                </div>

                {diagnostics.tenantsTestError && (
                  <div className="py-2 border-b border-slate-100">
                    <div className="text-slate-600 mb-1">Tenants Test Error:</div>
                    <div className="text-orange-600 text-xs font-mono bg-orange-50 p-2 rounded">
                      {diagnostics.tenantsTestError}
                    </div>
                  </div>
                )}

                {diagnostics.lastError && (
                  <div className="py-2 border-b border-slate-100">
                    <div className="text-slate-600 mb-1">Last Error:</div>
                    {diagnostics.lastErrorCode && (
                      <div className="text-xs font-mono bg-red-100 text-red-800 px-2 py-1 rounded mb-1 inline-block">
                        Code: {diagnostics.lastErrorCode}
                      </div>
                    )}
                    <div className="text-red-600 text-xs font-mono bg-red-50 p-2 rounded">
                      {diagnostics.lastError}
                    </div>
                  </div>
                )}

                <div className="py-2">
                  <div className="text-slate-600 mb-2">SQL Query (for debug):</div>
                  <pre className="text-xs font-mono bg-slate-50 p-3 rounded overflow-x-auto text-slate-700 whitespace-pre-wrap">
                    {diagnostics.sqlQuery || 'N/A'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
