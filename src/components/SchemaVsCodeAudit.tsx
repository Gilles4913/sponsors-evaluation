import { useState } from 'react';
import {
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  FileCode,
  Loader2,
  PlayCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Layout } from './Layout';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  udt_name?: string;
}

interface EnumValue {
  enum_name: string;
  value: string;
}

interface TableSchema {
  columns: ColumnInfo[];
  enums: Record<string, string[]>;
}

interface ExpectedColumn {
  type: string;
  nullable?: boolean;
  defaultValue?: string;
}

interface DiffResult {
  table: string;
  missing: string[];
  extra: string[];
  mismatches: string[];
  enumIssues: string[];
  status: 'ok' | 'warning' | 'error';
}

const EXPECTED_SCHEMA: Record<string, Record<string, ExpectedColumn>> = {
  tenants: {
    id: { type: 'uuid', nullable: false },
    name: { type: 'text', nullable: false },
    email_contact: { type: 'text', nullable: false },
    status: { type: 'status_active', nullable: false, defaultValue: 'active' },
    billing_email: { type: 'text', nullable: true },
    logo_url: { type: 'text', nullable: true },
    email_signature_html: { type: 'text', nullable: true },
    rgpd_content_md: { type: 'text', nullable: true },
    cgu_content_md: { type: 'text', nullable: true },
    privacy_content_md: { type: 'text', nullable: true },
    max_campaigns: { type: 'integer', nullable: false },
    max_invitations_per_month: { type: 'integer', nullable: false },
    created_at: { type: 'timestamptz', nullable: false },
  },
  app_users: {
    id: { type: 'uuid', nullable: false },
    email: { type: 'text', nullable: false },
    name: { type: 'text', nullable: true },
    role: { type: 'role_app', nullable: false },
    tenant_id: { type: 'uuid', nullable: true },
    created_at: { type: 'timestamptz', nullable: false },
  },
  campaigns: {
    id: { type: 'uuid', nullable: false },
    tenant_id: { type: 'uuid', nullable: false },
    title: { type: 'text', nullable: false },
    screen_type: { type: 'screen_type', nullable: false },
    location: { type: 'text', nullable: true },
    annual_price_hint: { type: 'numeric', nullable: true },
    objective_amount: { type: 'numeric', nullable: true },
    daily_footfall_estimate: { type: 'integer', nullable: true },
    lighting_hours: { type: 'jsonb', nullable: true },
    cover_image_url: { type: 'text', nullable: true },
    deadline: { type: 'date', nullable: true },
    description_md: { type: 'text', nullable: true },
    is_public_share_enabled: { type: 'boolean', nullable: false, defaultValue: 'false' },
    public_slug: { type: 'text', nullable: true },
    cost_estimate: { type: 'numeric', nullable: true },
    created_at: { type: 'timestamptz', nullable: false },
  },
  sponsors: {
    id: { type: 'uuid', nullable: false },
    tenant_id: { type: 'uuid', nullable: false },
    company: { type: 'text', nullable: false },
    contact_name: { type: 'text', nullable: true },
    email: { type: 'text', nullable: false },
    phone: { type: 'text', nullable: true },
    segment: { type: 'sponsor_segment', nullable: true },
    notes: { type: 'text', nullable: true },
    created_at: { type: 'timestamptz', nullable: false },
  },
  invitations: {
    id: { type: 'uuid', nullable: false },
    campaign_id: { type: 'uuid', nullable: false },
    sponsor_id: { type: 'uuid', nullable: false },
    email: { type: 'text', nullable: false },
    token: { type: 'text', nullable: false },
    status: { type: 'invitation_status', nullable: false },
    expires_at: { type: 'timestamptz', nullable: true },
    created_at: { type: 'timestamptz', nullable: false },
  },
  pledges: {
    id: { type: 'uuid', nullable: false },
    campaign_id: { type: 'uuid', nullable: false },
    sponsor_id: { type: 'uuid', nullable: true },
    invitation_id: { type: 'uuid', nullable: true },
    status: { type: 'pledge_status', nullable: false },
    amount: { type: 'numeric', nullable: true },
    comment: { type: 'text', nullable: true },
    consent: { type: 'boolean', nullable: false, defaultValue: 'false' },
    source: { type: 'text', nullable: false },
    created_at: { type: 'timestamptz', nullable: false },
  },
  scenarios: {
    id: { type: 'uuid', nullable: false },
    campaign_id: { type: 'uuid', nullable: false },
    params_json: { type: 'jsonb', nullable: false },
    results_json: { type: 'jsonb', nullable: false },
    created_at: { type: 'timestamptz', nullable: false },
  },
  email_templates: {
    id: { type: 'uuid', nullable: false },
    tenant_id: { type: 'uuid', nullable: true },
    key: { type: 'text', nullable: false },
    subject: { type: 'text', nullable: false },
    html: { type: 'text', nullable: false },
    created_at: { type: 'timestamptz', nullable: false },
  },
  email_events: {
    id: { type: 'uuid', nullable: false },
    invitation_id: { type: 'uuid', nullable: false },
    type: { type: 'email_event_type', nullable: false },
    meta_json: { type: 'jsonb', nullable: true },
    created_at: { type: 'timestamptz', nullable: false },
  },
  scheduled_jobs: {
    id: { type: 'uuid', nullable: false },
    campaign_id: { type: 'uuid', nullable: false },
    tenant_id: { type: 'uuid', nullable: false },
    run_at: { type: 'timestamptz', nullable: false },
    status: { type: 'job_status', nullable: false },
    payload: { type: 'jsonb', nullable: false },
    created_at: { type: 'timestamptz', nullable: false },
  },
};

export function SchemaVsCodeAudit() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiffResult[]>([]);
  const [realSchema, setRealSchema] = useState<Record<string, TableSchema>>({});

  const runAudit = async () => {
    setLoading(true);
    setResults([]);
    setRealSchema({});

    try {
      const tables = Object.keys(EXPECTED_SCHEMA);
      const schemaData: Record<string, TableSchema> = {};
      const diffs: DiffResult[] = [];

      const { data: enumData, error: enumError } = await supabase.rpc('get_enum_values');
      const enumsMap: Record<string, string[]> = {};

      if (!enumError && enumData) {
        for (const row of enumData) {
          if (!enumsMap[row.enum_name]) {
            enumsMap[row.enum_name] = [];
          }
          enumsMap[row.enum_name].push(row.enum_value);
        }
      }

      for (const table of tables) {
        try {
          const { data: columnData, error: columnError } = await supabase.rpc('get_table_columns', {
            table_name: table
          });

          if (columnError || !columnData) {
            toast.error(`Table ${table} inaccessible: ${columnError?.message}`);
            diffs.push({
              table,
              missing: ['Table non accessible ou inexistante'],
              extra: [],
              mismatches: [],
              enumIssues: [],
              status: 'error',
            });
            continue;
          }

          const columns: ColumnInfo[] = columnData.map((col: any) => ({
            column_name: col.column_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            column_default: col.column_default,
            udt_name: col.udt_name,
          }));

          schemaData[table] = {
            columns,
            enums: enumsMap,
          };

          const diff = compareTableSchema(table, schemaData[table], EXPECTED_SCHEMA[table]);
          diffs.push(diff);
        } catch (err: any) {
          toast.error(`Erreur ${table}: ${err.message}`);
          diffs.push({
            table,
            missing: ['Erreur lors de la vérification'],
            extra: [],
            mismatches: [],
            enumIssues: [],
            status: 'error',
          });
        }
      }

      try {
        const { data: viewData, error: viewError } = await supabase
          .from('campaign_aggregates')
          .select('*')
          .limit(0);

        if (viewError || !viewData) {
          diffs.push({
            table: 'campaign_aggregates (view)',
            missing: ['Vue complète manquante'],
            extra: [],
            mismatches: [],
            enumIssues: [],
            status: 'error',
          });
        } else {
          diffs.push({
            table: 'campaign_aggregates (view)',
            missing: [],
            extra: [],
            mismatches: [],
            enumIssues: [],
            status: 'ok',
          });
        }
      } catch (err: any) {
        diffs.push({
          table: 'campaign_aggregates (view)',
          missing: ['Vue inaccessible'],
          extra: [],
          mismatches: [],
          enumIssues: [],
          status: 'error',
        });
      }

      setRealSchema(schemaData);
      setResults(diffs);
      toast.success('Audit terminé!');
    } catch (error: any) {
      toast.error(`Erreur audit: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const compareTableSchema = (
    tableName: string,
    real: TableSchema,
    expected: Record<string, ExpectedColumn>
  ): DiffResult => {
    const missing: string[] = [];
    const extra: string[] = [];
    const mismatches: string[] = [];
    const enumIssues: string[] = [];

    const realColumns = new Set(real.columns.map((c) => c.column_name));
    const expectedColumns = Object.keys(expected);

    for (const expCol of expectedColumns) {
      if (!realColumns.has(expCol)) {
        missing.push(
          `${expCol} (${expected[expCol].type}${expected[expCol].nullable ? '?' : ''})`
        );
      } else {
        const realCol = real.columns.find((c) => c.column_name === expCol)!;
        const expType = expected[expCol];

        const typeCompatible = isTypeCompatible(realCol.data_type, expType.type, realCol.udt_name);
        const nullableMatch =
          (realCol.is_nullable === 'YES') === (expType.nullable !== false);

        if (!typeCompatible) {
          mismatches.push(
            `${expCol}: type attendu=${expType.type}, trouvé=${realCol.udt_name || realCol.data_type}`
          );
        }

        if (!nullableMatch) {
          mismatches.push(
            `${expCol}: nullable attendu=${expType.nullable !== false}, trouvé=${realCol.is_nullable === 'YES'}`
          );
        }

        if (expType.type.includes('_') && realCol.udt_name) {
          const enumName = realCol.udt_name;
          const enumValues = real.enums[enumName];
          if (!enumValues) {
            enumIssues.push(`${expCol}: enum ${enumName} non trouvé`);
          }
        }
      }
    }

    for (const realCol of real.columns) {
      if (!expectedColumns.includes(realCol.column_name)) {
        extra.push(`${realCol.column_name} (${realCol.data_type})`);
      }
    }

    let status: 'ok' | 'warning' | 'error' = 'ok';
    if (missing.length > 0 || mismatches.some((m) => m.includes('type attendu'))) {
      status = 'error';
    } else if (extra.length > 0 || mismatches.length > 0 || enumIssues.length > 0) {
      status = 'warning';
    }

    return {
      table: tableName,
      missing,
      extra,
      mismatches,
      enumIssues,
      status,
    };
  };

  const isTypeCompatible = (
    realType: string,
    expectedType: string,
    udtName?: string
  ): boolean => {
    const typeMap: Record<string, string[]> = {
      text: ['text', 'character varying', 'varchar'],
      uuid: ['uuid'],
      numeric: ['numeric', 'double precision', 'real'],
      integer: ['integer', 'bigint', 'smallint'],
      boolean: ['boolean'],
      timestamptz: ['timestamp with time zone', 'timestamp without time zone'],
      date: ['date'],
      jsonb: ['jsonb', 'json'],
    };

    if (expectedType.includes('_')) {
      return udtName === expectedType;
    }

    const compatibleTypes = typeMap[expectedType] || [expectedType];
    return compatibleTypes.includes(realType);
  };

  const mapTypeToSql = (jsType: string): string => {
    const typeMap: Record<string, string> = {
      text: 'text',
      uuid: 'uuid',
      int: 'integer',
      integer: 'integer',
      numeric: 'numeric',
      bool: 'boolean',
      boolean: 'boolean',
      jsonb: 'jsonb',
      date: 'date',
      timestamptz: 'timestamptz',
      role_app: 'role_app',
      status_active: 'status_active',
      screen_type: 'screen_type',
      sponsor_segment: 'sponsor_segment',
      invitation_status: 'invitation_status',
      pledge_status: 'pledge_status',
      email_event_type: 'email_event_type',
      job_status: 'job_status',
    };

    return typeMap[jsType] || jsType;
  };

  const buildSqlPatch = (): string => {
    const lines: string[] = [];
    lines.push('/*');
    lines.push('  Schema Patch SQL');
    lines.push('  Généré automatiquement par SchemaVsCodeAudit');
    lines.push('  ');
    lines.push('  ATTENTION: Vérifier et tester ce patch avant application en production!');
    lines.push('*/');
    lines.push('');

    let hasViewIssue = false;
    const enumsToAdd: Record<string, string[]> = {};

    for (const diff of results) {
      if (diff.table === 'campaign_aggregates (view)') {
        if (diff.status === 'error') {
          hasViewIssue = true;
        }
        continue;
      }

      if (
        diff.missing.length === 0 &&
        diff.mismatches.length === 0 &&
        diff.enumIssues.length === 0
      )
        continue;

      lines.push(`-- ========================================`);
      lines.push(`-- Table: ${diff.table}`);
      lines.push(`-- ========================================`);
      lines.push('');

      for (const missing of diff.missing) {
        const match = missing.match(/^(\w+)\s+\((.+?)\)$/);
        if (!match) continue;

        const colName = match[1];
        const colType = match[2];
        const isNullable = colType.includes('?');
        const baseType = colType.replace('?', '');
        const sqlType = mapTypeToSql(baseType);

        const expectedCol = EXPECTED_SCHEMA[diff.table]?.[colName];
        const notNull = !isNullable ? 'NOT NULL' : '';
        const defaultValue = expectedCol?.defaultValue
          ? `DEFAULT ${expectedCol.defaultValue}`
          : '';

        lines.push(
          `ALTER TABLE public.${diff.table} ADD COLUMN IF NOT EXISTS ${colName} ${sqlType} ${defaultValue} ${notNull};`.trim()
        );
      }

      if (diff.missing.length > 0) lines.push('');

      for (const mismatch of diff.mismatches) {
        if (mismatch.includes('type attendu')) {
          const colName = mismatch.split(':')[0];
          const match = mismatch.match(/type attendu=(\w+), trouvé=(\w+)/);
          if (match) {
            const [, expectedType, foundType] = match;
            lines.push(
              `-- ATTENTION: ${colName} - type actuel '${foundType}' vs attendu '${expectedType}'`
            );
            lines.push(
              `-- Migration potentiellement destructrice. À faire manuellement avec USING:`
            );
            lines.push(
              `-- ALTER TABLE public.${diff.table} ALTER COLUMN ${colName} TYPE ${mapTypeToSql(expectedType)} USING ${colName}::${mapTypeToSql(expectedType)};`
            );
            lines.push('');
          }
        } else if (mismatch.includes('nullable')) {
          const colName = mismatch.split(':')[0];
          const shouldBeNullable = mismatch.includes('nullable attendu=true');

          if (shouldBeNullable) {
            lines.push(
              `ALTER TABLE public.${diff.table} ALTER COLUMN ${colName} DROP NOT NULL;`
            );
          } else {
            lines.push('');
            lines.push(`-- Rendre ${colName} NOT NULL (vérifier qu'il n'y a pas de valeurs NULL)`);
            lines.push(`-- UPDATE public.${diff.table} SET ${colName} = '<default>' WHERE ${colName} IS NULL;`);
            lines.push(`ALTER TABLE public.${diff.table} ALTER COLUMN ${colName} SET NOT NULL;`);
          }
        }
      }

      if (diff.mismatches.length > 0) lines.push('');

      for (const enumIssue of diff.enumIssues) {
        const match = enumIssue.match(/(\w+):\s+enum\s+(\w+)/);
        if (match) {
          const [, colName, enumName] = match;
          lines.push(`-- Enum manquant pour ${colName}: ${enumName}`);
          lines.push(`-- Vérifier que l'enum ${enumName} existe et est correctement référencé`);
          lines.push('');
        }
      }

      lines.push('');
    }

    if (hasViewIssue) {
      lines.push(`-- ========================================`);
      lines.push(`-- Vue: campaign_aggregates`);
      lines.push(`-- ========================================`);
      lines.push('');
      lines.push(`CREATE OR REPLACE VIEW public.campaign_aggregates AS`);
      lines.push(`SELECT`);
      lines.push(`  c.id AS campaign_id,`);
      lines.push(`  c.tenant_id,`);
      lines.push(`  SUM(CASE WHEN p.status = 'yes' THEN COALESCE(p.amount, 0) ELSE 0 END) AS sum_yes_amount,`);
      lines.push(`  COUNT(*) FILTER (WHERE p.status = 'yes') AS yes_count,`);
      lines.push(`  COUNT(*) FILTER (WHERE p.status = 'maybe') AS maybe_count,`);
      lines.push(`  COUNT(*) FILTER (WHERE p.status = 'no') AS no_count,`);
      lines.push(`  COUNT(*) AS total_invitations`);
      lines.push(`FROM public.campaigns c`);
      lines.push(`LEFT JOIN public.pledges p ON p.campaign_id = c.id`);
      lines.push(`GROUP BY c.id, c.tenant_id;`);
      lines.push('');
    }

    lines.push(`-- ========================================`);
    lines.push(`-- Contraintes de validation`);
    lines.push(`-- ========================================`);
    lines.push('');
    lines.push(`-- Montant des pledges non négatif`);
    lines.push(`ALTER TABLE public.pledges DROP CONSTRAINT IF EXISTS pledges_amount_nonneg;`);
    lines.push(`ALTER TABLE public.pledges ADD CONSTRAINT pledges_amount_nonneg CHECK (amount IS NULL OR amount >= 0);`);
    lines.push('');

    lines.push(`-- ========================================`);
    lines.push(`-- Valeurs d'enums manquantes (si détectées)`);
    lines.push(`-- ========================================`);
    lines.push('');
    lines.push(`-- Exemple pour ajouter une valeur à un enum:`);
    lines.push(`-- DO $$`);
    lines.push(`-- BEGIN`);
    lines.push(`--   IF NOT EXISTS (`);
    lines.push(`--     SELECT 1 FROM pg_type t`);
    lines.push(`--     JOIN pg_enum e ON e.enumtypid = t.oid`);
    lines.push(`--     WHERE t.typname = 'pledge_status' AND e.enumlabel = 'nouvelle_valeur'`);
    lines.push(`--   ) THEN`);
    lines.push(`--     ALTER TYPE pledge_status ADD VALUE IF NOT EXISTS 'nouvelle_valeur';`);
    lines.push(`--   END IF;`);
    lines.push(`-- END $$;`);
    lines.push('');

    return lines.join('\n');
  };

  const buildTodosList = (): string => {
    const todos: string[] = [];
    todos.push('# TODO Code - Schema Audit');
    todos.push('');
    todos.push('Généré automatiquement par SchemaVsCodeAudit');
    todos.push('');

    const codeTodos: string[] = [];

    for (const diff of results) {
      if (
        diff.missing.length === 0 &&
        diff.mismatches.length === 0 &&
        diff.enumIssues.length === 0 &&
        diff.extra.length === 0
      )
        continue;

      todos.push(`## Table: ${diff.table}`);
      todos.push('');

      if (diff.missing.length > 0) {
        todos.push('### Colonnes manquantes dans la DB:');
        diff.missing.forEach((m) => {
          const match = m.match(/^(\w+)\s+\((.+?)\)$/);
          if (match) {
            const [, colName, colType] = match;
            todos.push(`- [ ] Ajouter colonne ${colName} (${colType}) dans la table ${diff.table}`);
            todos.push(`  - Appliquer la migration SQL correspondante`);
            todos.push(`  - Vérifier que le code TypeScript utilise bien cette colonne`);
          } else {
            todos.push(`- [ ] ${m}`);
          }
        });
        todos.push('');
      }

      if (diff.extra.length > 0) {
        todos.push('### Colonnes en trop dans la DB:');
        diff.extra.forEach((e) => {
          const match = e.match(/^(\w+)\s+\((.+?)\)$/);
          if (match) {
            const [, colName] = match;
            todos.push(`- [ ] Vérifier si colonne ${colName} est utilisée dans le code`);
            todos.push(`  - Si oui: ajouter au EXPECTED_SCHEMA`);
            todos.push(`  - Si non: considérer suppression ou documenter raison`);

            codeTodos.push(
              `// TODO(code): Vérifier utilisation de ${diff.table}.${colName} dans le code`
            );
          } else {
            todos.push(`- [ ] ${e}`);
          }
        });
        todos.push('');
      }

      if (diff.mismatches.length > 0) {
        todos.push('### Mismatches type/nullable:');
        diff.mismatches.forEach((m) => {
          const colName = m.split(':')[0];

          if (m.includes('type attendu')) {
            const match = m.match(/type attendu=(\w+), trouvé=(\w+)/);
            if (match) {
              const [, expectedType, foundType] = match;
              todos.push(`- [ ] ${colName}: aligner type DB (${foundType}) avec type attendu (${expectedType})`);
              todos.push(`  - Vérifier impact sur données existantes`);
              todos.push(`  - Mettre à jour le code TypeScript si nécessaire`);

              codeTodos.push(
                `// TODO(code): Aligner type TS de ${diff.table}.${colName} avec type DB '${expectedType}'`
              );
            }
          } else if (m.includes('nullable')) {
            const shouldBeNullable = m.includes('nullable attendu=true');
            if (shouldBeNullable) {
              todos.push(`- [ ] ${colName}: rendre nullable dans la DB (actuellement NOT NULL)`);
              todos.push(`  - Appliquer: ALTER COLUMN ${colName} DROP NOT NULL`);
            } else {
              todos.push(`- [ ] ${colName}: rendre NOT NULL dans la DB (actuellement nullable)`);
              todos.push(`  - Vérifier qu'il n'y a pas de valeurs NULL existantes`);
              todos.push(`  - Mettre à jour les données si nécessaire`);
              todos.push(`  - Appliquer: ALTER COLUMN ${colName} SET NOT NULL`);

              codeTodos.push(
                `// TODO(code): Rendre ${diff.table}.${colName} requis dans les formulaires (NOT NULL en DB)`
              );
            }
          }
        });
        todos.push('');
      }

      if (diff.enumIssues.length > 0) {
        todos.push('### Problèmes enums:');
        diff.enumIssues.forEach((e) => {
          const match = e.match(/(\w+):\s+enum\s+(\w+)/);
          if (match) {
            const [, colName, enumName] = match;
            todos.push(`- [ ] ${colName}: vérifier enum ${enumName}`);
            todos.push(`  - Confirmer que l'enum existe dans la DB`);
            todos.push(`  - Vérifier les valeurs de l'enum`);
            todos.push(`  - Synchroniser avec le type TypeScript`);

            codeTodos.push(
              `// TODO(code): Aligner type TS de ${diff.table}.${colName} avec enum '${enumName}'`
            );
          } else {
            todos.push(`- [ ] Résoudre: ${e}`);
          }
        });
        todos.push('');
      }
    }

    if (codeTodos.length > 0) {
      todos.push('---');
      todos.push('');
      todos.push('## TODO Code (à intégrer dans les fichiers TypeScript)');
      todos.push('');
      todos.push('```typescript');
      codeTodos.forEach((todo) => todos.push(todo));
      todos.push('```');
      todos.push('');
      todos.push('### Actions suggérées:');
      todos.push('');
      todos.push('1. **CampaignForm.tsx, CampaignDetail.tsx**');
      todos.push('   - Vérifier que les props correspondent aux colonnes DB');
      todos.push('   - Exemple: `coverUrl` → `cover_image_url`');
      todos.push('   - Adapter le mapping des données');
      todos.push('');
      todos.push('2. **SponsorsList.tsx, InviteModal.tsx**');
      todos.push('   - Rendre les champs requis si NOT NULL en DB');
      todos.push('   - Ajouter validation appropriée');
      todos.push('   - Exemple: `company` → required');
      todos.push('');
      todos.push('3. **database.types.ts**');
      todos.push('   - Régénérer les types Supabase après migrations');
      todos.push('   - Commande: `npx supabase gen types typescript --project-id <id>`');
      todos.push('   - Vérifier alignement avec EXPECTED_SCHEMA');
      todos.push('');
    }

    return todos.join('\n');
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copié!`);
    } catch (error) {
      toast.error('Erreur lors de la copie');
    }
  };

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    if (status === 'ok') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Schema vs Code Audit
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Compare le schéma Supabase réel avec le modèle attendu
                  </p>
                </div>
              </div>

              <button
                onClick={runAudit}
                disabled={loading}
                data-testid="audit-run"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Audit en cours...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    Lancer l'audit
                  </>
                )}
              </button>
            </div>
          </div>

          {results.length > 0 && (
            <>
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {results.filter((r) => r.status === 'ok').length} OK,{' '}
                    {results.filter((r) => r.status === 'warning').length} Warnings,{' '}
                    {results.filter((r) => r.status === 'error').length} Errors
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(buildSqlPatch(), 'SQL patch')}
                      data-testid="btn-copy-sql"
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm font-medium"
                    >
                      <Copy className="w-4 h-4" />
                      Copier SQL patch
                    </button>

                    <button
                      onClick={() => copyToClipboard(buildTodosList(), 'TODO code')}
                      data-testid="btn-copy-todos"
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm font-medium"
                    >
                      <FileCode className="w-4 h-4" />
                      Copier TODO code
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4" data-testid="audit-report">
                {results.map((diff) => (
                  <div
                    key={diff.table}
                    data-testid={`row-${diff.table}`}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900">
                      {getStatusIcon(diff.status)}
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {diff.table}
                      </h3>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {diff.missing.length + diff.mismatches.length + diff.enumIssues.length} issues
                      </span>
                    </div>

                    {(diff.missing.length > 0 || diff.extra.length > 0 || diff.mismatches.length > 0 || diff.enumIssues.length > 0) && (
                      <div className="p-4 space-y-3">
                        {diff.missing.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                              Colonnes manquantes ({diff.missing.length})
                            </h4>
                            <ul className="space-y-1">
                              {diff.missing.map((col, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-slate-700 dark:text-slate-300 pl-4"
                                >
                                  <span className="text-red-600 dark:text-red-400">✗</span>{' '}
                                  {col}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {diff.extra.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">
                              Colonnes en trop ({diff.extra.length})
                            </h4>
                            <ul className="space-y-1">
                              {diff.extra.map((col, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-slate-700 dark:text-slate-300 pl-4"
                                >
                                  <span className="text-orange-600 dark:text-orange-400">
                                    ⚠
                                  </span>{' '}
                                  {col}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {diff.mismatches.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">
                              Mismatches ({diff.mismatches.length})
                            </h4>
                            <ul className="space-y-1">
                              {diff.mismatches.map((mismatch, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-slate-700 dark:text-slate-300 pl-4"
                                >
                                  <span className="text-orange-600 dark:text-orange-400">
                                    ⚠
                                  </span>{' '}
                                  {mismatch}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {diff.enumIssues.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                              Problèmes enums ({diff.enumIssues.length})
                            </h4>
                            <ul className="space-y-1">
                              {diff.enumIssues.map((issue, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-slate-700 dark:text-slate-300 pl-4"
                                >
                                  <span className="text-red-600 dark:text-red-400">✗</span>{' '}
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && results.length === 0 && (
            <div className="p-12 text-center">
              <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                Cliquez sur "Lancer l'audit" pour commencer
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
