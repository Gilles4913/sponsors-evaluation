import { useState } from 'react';
import { Database, CheckCircle, XCircle, AlertTriangle, Copy, RefreshCw, FileCode, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';

interface ColumnCheck {
  name: string;
  present: boolean;
}

interface TableCheck {
  name: string;
  exists: boolean;
  columns: ColumnCheck[];
  missingColumns: string[];
  extraColumns: string[];
  rlsBlocked: boolean;
  error?: string;
}

interface ViewCheck {
  name: string;
  exists: boolean;
  columns: ColumnCheck[];
  missingColumns: string[];
  error?: string;
}

interface SchemaReport {
  tables: TableCheck[];
  views: ViewCheck[];
  timestamp: string;
}

const EXPECTED_SCHEMA = {
  tables: {
    tenants: ['id', 'name', 'email_contact', 'status', 'email_signature_html', 'rgpd_content_md', 'cgu_content_md', 'privacy_content_md', 'created_at'],
    app_users: ['id', 'email', 'name', 'role', 'tenant_id', 'created_at'],
    campaigns: ['id', 'tenant_id', 'title', 'screen_type', 'location', 'annual_price_hint', 'objective_amount', 'daily_footfall_estimate', 'lighting_hours', 'cover_image_url', 'deadline', 'description_md', 'is_public_share_enabled', 'public_slug', 'cost_estimate', 'created_at'],
    sponsors: ['id', 'tenant_id', 'company', 'contact_name', 'email', 'phone', 'segment', 'notes'],
    invitations: ['id', 'campaign_id', 'sponsor_id', 'email', 'token', 'status', 'expires_at', 'created_at'],
    pledges: ['id', 'campaign_id', 'sponsor_id', 'invitation_id', 'status', 'amount', 'comment', 'consent', 'source', 'created_at'],
    scenarios: ['id', 'campaign_id', 'params_json', 'results_json', 'created_at'],
    email_templates: ['id', 'tenant_id', 'key', 'subject', 'html', 'created_at'],
    email_events: ['id', 'invitation_id', 'type', 'meta_json', 'created_at'],
    scheduled_jobs: ['id', 'campaign_id', 'tenant_id', 'run_at', 'status', 'payload', 'created_at'],
  },
  views: {
    campaign_aggregates: ['campaign_id', 'sum_yes_amount', 'yes_count', 'maybe_count', 'no_count'],
  },
};

export function SchemaChecker() {
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<SchemaReport | null>(null);
  const toast = useToast();

  const checkTable = async (tableName: string, expectedColumns: string[]): Promise<TableCheck> => {
    const selectClause = expectedColumns.join(',');

    try {
      const { data, error } = await supabase
        .from(tableName)
        .select(selectClause)
        .limit(1);

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('column') || error.message.includes('does not exist')) {
          const missingCols = extractMissingColumns(error.message, expectedColumns);
          return {
            name: tableName,
            exists: true,
            columns: expectedColumns.map(col => ({
              name: col,
              present: !missingCols.includes(col),
            })),
            missingColumns: missingCols,
            extraColumns: [],
            rlsBlocked: false,
            error: error.message,
          };
        }

        if (error.code === '42P01' || error.message.includes('does not exist')) {
          return {
            name: tableName,
            exists: false,
            columns: expectedColumns.map(col => ({ name: col, present: false })),
            missingColumns: expectedColumns,
            extraColumns: [],
            rlsBlocked: false,
            error: 'Table does not exist',
          };
        }

        if (error.code === '42501' || error.message.includes('permission denied') || error.message.includes('RLS')) {
          return {
            name: tableName,
            exists: true,
            columns: expectedColumns.map(col => ({ name: col, present: true })),
            missingColumns: [],
            extraColumns: [],
            rlsBlocked: true,
            error: 'RLS blocks read (role=anon)',
          };
        }

        return {
          name: tableName,
          exists: true,
          columns: expectedColumns.map(col => ({ name: col, present: false })),
          missingColumns: expectedColumns,
          extraColumns: [],
          rlsBlocked: false,
          error: error.message,
        };
      }

      const actualColumns = data && data.length > 0 ? Object.keys(data[0]) : expectedColumns;
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
      const extraColumns = actualColumns.filter(col => !expectedColumns.includes(col));

      return {
        name: tableName,
        exists: true,
        columns: expectedColumns.map(col => ({
          name: col,
          present: actualColumns.includes(col),
        })),
        missingColumns,
        extraColumns,
        rlsBlocked: false,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        name: tableName,
        exists: false,
        columns: expectedColumns.map(col => ({ name: col, present: false })),
        missingColumns: expectedColumns,
        extraColumns: [],
        rlsBlocked: false,
        error: error.message,
      };
    }
  };

  const checkView = async (viewName: string, expectedColumns: string[]): Promise<ViewCheck> => {
    const selectClause = expectedColumns.join(',');

    try {
      const { data, error } = await supabase
        .from(viewName)
        .select(selectClause)
        .limit(1);

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('column')) {
          const missingCols = extractMissingColumns(error.message, expectedColumns);
          return {
            name: viewName,
            exists: true,
            columns: expectedColumns.map(col => ({
              name: col,
              present: !missingCols.includes(col),
            })),
            missingColumns: missingCols,
            error: error.message,
          };
        }

        if (error.code === '42P01' || error.message.includes('does not exist')) {
          return {
            name: viewName,
            exists: false,
            columns: expectedColumns.map(col => ({ name: col, present: false })),
            missingColumns: expectedColumns,
            error: 'View does not exist',
          };
        }

        return {
          name: viewName,
          exists: true,
          columns: expectedColumns.map(col => ({ name: col, present: false })),
          missingColumns: expectedColumns,
          error: error.message,
        };
      }

      const actualColumns = data && data.length > 0 ? Object.keys(data[0]) : expectedColumns;
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

      return {
        name: viewName,
        exists: true,
        columns: expectedColumns.map(col => ({
          name: col,
          present: actualColumns.includes(col),
        })),
        missingColumns,
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        name: viewName,
        exists: false,
        columns: expectedColumns.map(col => ({ name: col, present: false })),
        missingColumns: expectedColumns,
        error: error.message,
      };
    }
  };

  const extractMissingColumns = (errorMessage: string, expectedColumns: string[]): string[] => {
    const missing: string[] = [];
    expectedColumns.forEach(col => {
      if (errorMessage.includes(`column "${col}"`) || errorMessage.includes(`"${col}" does not exist`)) {
        missing.push(col);
      }
    });
    return missing;
  };

  const runSchemaCheck = async () => {
    setChecking(true);
    try {
      const tableChecks: TableCheck[] = [];

      for (const [tableName, columns] of Object.entries(EXPECTED_SCHEMA.tables)) {
        const check = await checkTable(tableName, columns);
        tableChecks.push(check);
      }

      const viewChecks: ViewCheck[] = [];

      for (const [viewName, columns] of Object.entries(EXPECTED_SCHEMA.views)) {
        const check = await checkView(viewName, columns);
        viewChecks.push(check);
      }

      const newReport: SchemaReport = {
        tables: tableChecks,
        views: viewChecks,
        timestamp: new Date().toISOString(),
      };

      setReport(newReport);
      toast.success('Vérification du schéma terminée');
    } catch (error) {
      toast.error('Erreur lors de la vérification du schéma');
      console.error(error);
    } finally {
      setChecking(false);
    }
  };

  const inferColumnType = (columnName: string, tableName: string): string => {
    if (columnName.endsWith('_id') || columnName === 'id') {
      return 'uuid';
    }

    if (columnName.endsWith('_amount') || columnName.includes('amount')) {
      return 'numeric';
    }

    if (columnName.endsWith('_estimate') || columnName.includes('estimate') || columnName.endsWith('_count') || columnName.includes('footfall')) {
      return 'integer';
    }

    if (columnName.endsWith('_json') || columnName.includes('json') || columnName.endsWith('_hours')) {
      return 'jsonb';
    }

    if (columnName.endsWith('_at') || columnName === 'created_at' || columnName === 'updated_at' || columnName === 'expires_at' || columnName === 'run_at') {
      return 'timestamptz';
    }

    if (columnName === 'deadline') {
      return 'date';
    }

    if (columnName === 'status') {
      if (tableName === 'tenants') return 'status_active';
      if (tableName === 'invitations' || tableName === 'pledges') return 'status_response';
      if (tableName === 'scheduled_jobs') return 'job_status';
      return 'text';
    }

    if (columnName === 'role') {
      return 'role_app';
    }

    if (columnName === 'segment') {
      return 'sponsor_segment';
    }

    if (columnName.startsWith('is_') || columnName.includes('consent') || columnName.endsWith('_enabled')) {
      return 'boolean';
    }

    if (columnName.endsWith('_html') || columnName.endsWith('_md')) {
      return 'text';
    }

    return 'text';
  };

  const getColumnDefault = (columnName: string, columnType: string): string => {
    if (columnType === 'uuid' && columnName === 'id') {
      return ' default gen_random_uuid()';
    }

    if (columnType === 'timestamptz' && columnName === 'created_at') {
      return ' default now()';
    }

    if (columnType === 'boolean') {
      if (columnName.includes('consent') || columnName.includes('is_public')) {
        return ' default false';
      }
      return ' default false';
    }

    if (columnType === 'integer' && columnName.endsWith('_count')) {
      return ' default 0';
    }

    if (columnType === 'status_active') {
      return " default 'active'";
    }

    if (columnType === 'status_response') {
      return " default 'pending'";
    }

    if (columnType === 'job_status') {
      return " default 'pending'";
    }

    return '';
  };

  const shouldBeNotNull = (columnName: string): boolean => {
    const notNullColumns = ['id', 'tenant_id', 'campaign_id', 'email', 'status', 'role', 'created_at'];
    return notNullColumns.includes(columnName);
  };

  const buildSqlPatch = (diff: SchemaReport): string => {
    const patches: string[] = [];
    patches.push('-- SQL Patch pour corriger le schéma');
    patches.push(`-- Généré le ${new Date(diff.timestamp).toLocaleString('fr-FR')}`);
    patches.push('');

    diff.tables.forEach(table => {
      if (!table.exists) {
        patches.push(`-- ERREUR: La table "${table.name}" n'existe pas!`);
        patches.push(`-- Vous devez créer cette table manuellement.`);
        patches.push('');
      } else {
        if (table.missingColumns.length > 0) {
          patches.push(`-- Colonnes manquantes dans la table "${table.name}"`);
          table.missingColumns.forEach(col => {
            const colType = inferColumnType(col, table.name);
            const defaultValue = getColumnDefault(col, colType);
            const notNull = shouldBeNotNull(col) ? ' not null' : '';
            patches.push(`alter table ${table.name} add column if not exists ${col} ${colType}${defaultValue}${notNull};`);
          });
          patches.push('');
        }

        if (table.extraColumns.length > 0) {
          patches.push(`-- Colonnes supplémentaires dans la table "${table.name}" (non destructif - décommenter si nécessaire)`);
          table.extraColumns.forEach(col => {
            patches.push(`-- alter table ${table.name} drop column if exists ${col};`);
          });
          patches.push('');
        }
      }
    });

    diff.views.forEach(view => {
      if (!view.exists) {
        patches.push(`-- Vue manquante: "${view.name}"`);

        if (view.name === 'campaign_aggregates') {
          patches.push(`create or replace view public.campaign_aggregates as`);
          patches.push(`select c.id as campaign_id,`);
          patches.push(`       sum(case when p.status='yes' then coalesce(p.amount,0) else 0 end) as sum_yes_amount,`);
          patches.push(`       count(*) filter (where p.status='yes') as yes_count,`);
          patches.push(`       count(*) filter (where p.status='maybe') as maybe_count,`);
          patches.push(`       count(*) filter (where p.status='no') as no_count`);
          patches.push(`from public.campaigns c`);
          patches.push(`left join public.pledges p on p.campaign_id = c.id`);
          patches.push(`group by c.id;`);
          patches.push('');
        } else {
          patches.push(`-- Définition de la vue à créer manuellement`);
          patches.push('');
        }
      }
    });

    const hasPledgesTable = diff.tables.some(t => t.name === 'pledges' && t.exists);
    if (hasPledgesTable) {
      patches.push('-- Contraintes de validation');
      patches.push('-- Assure que pledges.amount est non-négatif');
      patches.push('alter table pledges drop constraint if exists pledges_amount_check;');
      patches.push('alter table pledges add constraint pledges_amount_check check (amount >= 0);');
      patches.push('');
    }

    if (patches.length === 3) {
      patches.push('-- Aucune correction nécessaire! Le schéma est conforme.');
    }

    return patches.join('\n');
  };

  const generateSqlPatch = (): string => {
    if (!report) return '';
    return buildSqlPatch(report);
  };

  const copySqlPatch = () => {
    const sql = generateSqlPatch();
    navigator.clipboard.writeText(sql);
    toast.success('SQL patch copié dans le presse-papiers');
  };

  const downloadSqlPatch = () => {
    const sql = generateSqlPatch();
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'patch_add_columns.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Fichier patch_add_columns.sql téléchargé');
  };

  const generateViewPatch = (): string => {
    const patches: string[] = [];
    patches.push('-- Patch pour recréer la vue campaign_aggregates');
    patches.push(`-- Généré le ${new Date().toLocaleString('fr-FR')}`);
    patches.push('');
    patches.push('-- Supprime la vue existante si présente');
    patches.push('drop view if exists public.campaign_aggregates;');
    patches.push('');
    patches.push('-- Crée la vue avec LEFT JOIN pour inclure toutes les campagnes');
    patches.push('create or replace view public.campaign_aggregates as');
    patches.push('select c.id as campaign_id,');
    patches.push('       sum(case when p.status=\'yes\' then coalesce(p.amount,0) else 0 end) as sum_yes_amount,');
    patches.push('       count(*) filter (where p.status=\'yes\') as yes_count,');
    patches.push('       count(*) filter (where p.status=\'maybe\') as maybe_count,');
    patches.push('       count(*) filter (where p.status=\'no\') as no_count');
    patches.push('from public.campaigns c');
    patches.push('left join public.pledges p on p.campaign_id = c.id');
    patches.push('group by c.id;');
    return patches.join('\n');
  };

  const downloadViewPatch = () => {
    const sql = generateViewPatch();
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'patch_view_campaign_aggregates.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Fichier patch_view_campaign_aggregates.sql téléchargé');
  };

  const getStatusIcon = (exists: boolean, missingColumns: string[], rlsBlocked: boolean) => {
    if (!exists) return <XCircle className="w-5 h-5 text-red-600" />;
    if (rlsBlocked) return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    if (missingColumns.length > 0) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <CheckCircle className="w-5 h-5 text-green-600" />;
  };

  const allTablesOk = report?.tables.every(t => t.exists && t.missingColumns.length === 0 && !t.rlsBlocked) ?? false;
  const allViewsOk = report?.views.every(v => v.exists && v.missingColumns.length === 0) ?? false;
  const allOk = allTablesOk && allViewsOk;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Database className="w-8 h-8 text-blue-600" />
                Vérificateur de Schéma
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Vérifie que toutes les tables et colonnes requises sont présentes dans la base de données
              </p>
            </div>
            <button
              onClick={runSchemaCheck}
              disabled={checking}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Vérification...' : 'Vérifier le schéma'}
            </button>
          </div>
        </div>

        {report && (
          <div className="space-y-6" data-testid="schema-report">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {allOk ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        Schéma Conforme
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                        Problèmes Détectés
                      </>
                    )}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Vérifié le {new Date(report.timestamp).toLocaleString('fr-FR')}
                  </p>
                </div>
                {!allOk && (
                  <button
                    onClick={copySqlPatch}
                    data-testid="btn-copy-sql-patch"
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copier le SQL patch
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Tables</h3>
                {report.tables.map(table => (
                  <div
                    key={table.name}
                    data-testid={`row-${table.name}`}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(table.exists, table.missingColumns, table.rlsBlocked)}
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {table.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {!table.exists && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                            Table manquante
                          </span>
                        )}
                        {table.rlsBlocked && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded">
                            RLS bloqué
                          </span>
                        )}
                        {table.exists && table.missingColumns.length > 0 && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                            {table.missingColumns.length} colonne(s) manquante(s)
                          </span>
                        )}
                        {table.exists && table.extraColumns.length > 0 && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                            {table.extraColumns.length} colonne(s) supplémentaire(s)
                          </span>
                        )}
                        {table.exists && table.missingColumns.length === 0 && !table.rlsBlocked && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                            OK
                          </span>
                        )}
                      </div>
                    </div>

                    {table.error && (
                      <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-900 rounded text-xs font-mono text-slate-600 dark:text-slate-400">
                        {table.error}
                      </div>
                    )}

                    {table.missingColumns.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Colonnes manquantes :
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {table.missingColumns.map(col => (
                            <span
                              key={col}
                              className="px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded text-sm font-mono"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {table.extraColumns.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Colonnes supplémentaires :
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {table.extraColumns.map(col => (
                            <span
                              key={col}
                              className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-sm font-mono"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-6">Vues</h3>
                {report.views.map(view => (
                  <div
                    key={view.name}
                    data-testid={`row-${view.name}`}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(view.exists, view.missingColumns, false)}
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {view.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {view.name === 'campaign_aggregates' && (
                          <button
                            onClick={downloadViewPatch}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition flex items-center gap-1.5 text-xs"
                            title="Télécharger patch pour recréer la vue avec LEFT JOIN"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Patch Vue
                          </button>
                        )}
                        {!view.exists && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
                            Vue manquante
                          </span>
                        )}
                        {view.exists && view.missingColumns.length > 0 && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                            {view.missingColumns.length} colonne(s) manquante(s)
                          </span>
                        )}
                        {view.exists && view.missingColumns.length === 0 && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                            OK
                          </span>
                        )}
                      </div>
                    </div>

                    {view.error && (
                      <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-900 rounded text-xs font-mono text-slate-600 dark:text-slate-400">
                        {view.error}
                      </div>
                    )}

                    {view.missingColumns.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Colonnes manquantes :
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {view.missingColumns.map(col => (
                            <span
                              key={col}
                              className="px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded text-sm font-mono"
                            >
                              {col}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!allOk && (
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      SQL Patch Suggéré
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copySqlPatch}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 text-sm"
                    >
                      <Copy className="w-4 h-4" />
                      Copier
                    </button>
                    <button
                      onClick={downloadSqlPatch}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={generateSqlPatch()}
                  className="w-full h-96 bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        )}

        {!report && !checking && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-12 text-center">
            <Database className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Aucune vérification effectuée
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Cliquez sur "Vérifier le schéma" pour commencer l'analyse de la base de données
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
