import { useState, useEffect } from 'react';
import { X, AlertTriangle, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PushTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: {
    id: string;
    type: string;
    subject: string;
    html_body: string;
    text_body: string;
    placeholders: string[];
    is_active: boolean;
  } | null;
  onSuccess: () => void;
}

interface Tenant {
  id: string;
  name: string;
}

type PushMode = 'safe' | 'force';

export function PushTemplatesModal({
  isOpen,
  onClose,
  template,
  onSuccess,
}: PushTemplatesModalProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [mode, setMode] = useState<PushMode>('safe');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    skipped: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTenants();
      setResults(null);
      setProgress({ current: 0, total: 0 });
    }
  }, [isOpen]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const pushSafe = async () => {
    setPushing(true);
    setProgress({ current: 0, total: tenants.length });
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      setProgress({ current: i + 1, total: tenants.length });

      try {
        const { data, error } = await supabase.rpc('clone_default_email_templates', {
          p_tenant_id: tenant.id,
        });

        if (error) throw error;

        if (data && data > 0) {
          successCount++;
        }
      } catch (error) {
        console.error(`Error pushing to tenant ${tenant.name}:`, error);
        failedCount++;
      }
    }

    setResults({
      success: successCount,
      failed: failedCount,
      skipped: tenants.length - successCount - failedCount,
    });
    setPushing(false);
    onSuccess();
  };

  const pushForce = async () => {
    if (!template) {
      setPushing(true);
      setProgress({ current: 0, total: tenants.length });
      let successCount = 0;
      let failedCount = 0;

      const { data: globalTemplates, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .is('tenant_id', null);

      if (fetchError) {
        console.error('Error fetching global templates:', fetchError);
        setPushing(false);
        return;
      }

      for (let i = 0; i < tenants.length; i++) {
        const tenant = tenants[i];
        setProgress({ current: i + 1, total: tenants.length });

        let tenantSuccess = 0;
        for (const tmpl of globalTemplates || []) {
          try {
            const { error } = await supabase.from('email_templates').upsert(
              {
                tenant_id: tenant.id,
                type: tmpl.type,
                subject: tmpl.subject,
                html_body: tmpl.html_body,
                text_body: tmpl.text_body,
                placeholders: tmpl.placeholders,
                is_active: tmpl.is_active,
              },
              {
                onConflict: 'tenant_id,type',
              }
            );

            if (error) throw error;
            tenantSuccess++;
          } catch (error) {
            console.error(`Error upserting template for tenant ${tenant.name}:`, error);
          }
        }

        if (tenantSuccess > 0) {
          successCount++;
        } else {
          failedCount++;
        }
      }

      setResults({
        success: successCount,
        failed: failedCount,
        skipped: 0,
      });
      setPushing(false);
      onSuccess();
    } else {
      setPushing(true);
      setProgress({ current: 0, total: tenants.length });
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < tenants.length; i++) {
        const tenant = tenants[i];
        setProgress({ current: i + 1, total: tenants.length });

        try {
          const { error } = await supabase.from('email_templates').upsert(
            {
              tenant_id: tenant.id,
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
          console.error(`Error pushing to tenant ${tenant.name}:`, error);
          failedCount++;
        }
      }

      setResults({
        success: successCount,
        failed: failedCount,
        skipped: 0,
      });
      setPushing(false);
      onSuccess();
    }
  };

  const handlePush = async () => {
    if (!tenants.length) return;

    const confirmed = confirm(
      mode === 'safe'
        ? `Dupliquer les templates vers ${tenants.length} club(s) ? (mode safe : uniquement si absent)`
        : `ATTENTION : Écraser les templates existants dans ${tenants.length} club(s) ? Cette opération est irréversible.`
    );

    if (!confirmed) return;

    if (mode === 'safe') {
      await pushSafe();
    } else {
      await pushForce();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {template ? `Dupliquer "${template.type}" vers clubs` : 'Dupliquer tous les templates vers clubs'}
          </h2>
          <button
            onClick={onClose}
            disabled={pushing}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">
              Chargement des clubs...
            </div>
          ) : (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  {tenants.length} club(s) trouvé(s)
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Mode de duplication
                </label>

                <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <input
                    type="radio"
                    name="mode"
                    value="safe"
                    checked={mode === 'safe'}
                    onChange={() => setMode('safe')}
                    disabled={pushing}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-white mb-1">
                      Ajouter si absent (Safe)
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Ajoute les templates uniquement s'ils n'existent pas déjà pour le club. Les templates existants ne seront pas modifiés.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border-2 border-orange-300 dark:border-orange-700 rounded-lg cursor-pointer transition hover:bg-orange-50 dark:hover:bg-orange-900/20">
                  <input
                    type="radio"
                    name="mode"
                    value="force"
                    checked={mode === 'force'}
                    onChange={() => setMode('force')}
                    disabled={pushing}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-orange-800 dark:text-orange-400 mb-1 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Écraser existants (Force)
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-500">
                      Remplace tous les templates des clubs par les versions globales. Cette action est irréversible.
                    </div>
                  </div>
                </label>
              </div>

              {pushing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Progression</span>
                    <span>
                      {progress.current} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {results && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 dark:text-green-400 mb-2">
                    Opération terminée
                  </h4>
                  <div className="text-sm text-green-700 dark:text-green-500 space-y-1">
                    <p>✓ {results.success} club(s) mis à jour avec succès</p>
                    {results.skipped > 0 && <p>○ {results.skipped} club(s) ignorés (templates déjà présents)</p>}
                    {results.failed > 0 && <p className="text-red-600 dark:text-red-400">✗ {results.failed} échec(s)</p>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={pushing}
            className="px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-white rounded-lg transition disabled:opacity-50"
          >
            {results ? 'Fermer' : 'Annuler'}
          </button>
          {!results && (
            <button
              onClick={handlePush}
              disabled={pushing || loading || tenants.length === 0}
              data-testid={mode === 'safe' ? 'btn-push-safe' : 'btn-push-force'}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition disabled:opacity-50 ${
                mode === 'force'
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              {pushing ? 'Duplication en cours...' : mode === 'safe' ? 'Dupliquer (Safe)' : 'Dupliquer (Force)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
