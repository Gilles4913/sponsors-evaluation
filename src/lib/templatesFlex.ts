import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalized email template structure that works across both schema modes.
 * Provides a consistent interface regardless of underlying database schema.
 */
export interface NormalizedTemplate {
  /** Template ID */
  id: string;
  /** Tenant ID (null for global templates) */
  tenant_id: string | null;
  /** Template scope: 'global' for tenant_id=null, 'tenant' otherwise */
  scope: 'global' | 'tenant';
  /** Template key/type identifier */
  key: string;
  /** Email subject line */
  subject: string;
  /** HTML email body */
  html: string;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Explained PostgREST error with parsed components
 */
export interface ExplainedError {
  /** HTTP status code (if available) */
  status?: number;
  /** Error message */
  message?: string;
  /** Additional error details */
  details?: string;
  /** Hint for resolving the error */
  hint?: string;
}

/**
 * Result of flexible template loading operation
 */
export interface LoadTemplatesResult {
  /** Schema mode used: 'A' for (key, html), 'B' for (type, html_body) */
  mode: 'A' | 'B';
  /** Normalized template rows */
  rows: NormalizedTemplate[];
  /** Last SQL query executed (human-readable format) */
  lastSql?: string;
  /** Error details if loading failed */
  error?: ExplainedError;
  /** Warning message if tenantId was falsy (loaded only global templates) */
  warning?: string;
}

/**
 * Checks if an error is due to missing/unknown columns in the query.
 * Detects PostgREST 400/406 errors with "column ... does not exist" message.
 *
 * @param error - The error object from Supabase/PostgREST
 * @returns true if error indicates missing columns
 *
 * @example
 * ```ts
 * const { error } = await supabase.from('table').select('nonexistent_col');
 * if (isMissingColumnError(error)) {
 *   console.log('Column does not exist, trying fallback schema');
 * }
 * ```
 */
export function isMissingColumnError(error: any): boolean {
  if (!error) return false;

  const code = error.code ? parseInt(error.code) : null;
  const message = error.message?.toLowerCase() || '';

  const isBadStatus = code === 400 || code === 406;
  const hasColumnError =
    message.includes('column') &&
    message.includes('does not exist');

  return isBadStatus || hasColumnError;
}

/**
 * Parses a PostgREST error into a structured format with status, message, details, and hint.
 *
 * @param error - The error object from Supabase/PostgREST
 * @returns Structured error information
 *
 * @example
 * ```ts
 * const { error } = await supabase.from('table').select('*');
 * const explained = explainPostgrestError(error);
 * console.log(`Status: ${explained.status}, Message: ${explained.message}`);
 * ```
 */
export function explainPostgrestError(error: any): ExplainedError {
  if (!error) {
    return {
      message: 'Unknown error',
    };
  }

  return {
    status: error.code ? parseInt(error.code) : undefined,
    message: error.message || String(error),
    details: error.details || undefined,
    hint: error.hint || undefined,
  };
}

/**
 * Normalizes a database row from either schema mode into a consistent NormalizedTemplate.
 * Handles both Mode A (key, html, created_at) and Mode B (type, html_body, updated_at).
 *
 * @param row - Raw database row
 * @returns Normalized template object
 */
function normalizeRow(row: any): NormalizedTemplate {
  const key = row.key ?? row.type ?? 'unknown';
  const html = row.html ?? row.html_body ?? '';
  const scope = row.tenant_id ? 'tenant' : 'global';
  const updated_at = row.updated_at ?? row.created_at ?? undefined;

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    scope,
    key,
    subject: row.subject || '',
    html,
    updated_at,
  };
}

/**
 * Flexibly loads email templates from the database, automatically detecting and adapting to schema changes.
 *
 * Attempts to load templates using two schema modes:
 * - **Mode A**: Uses columns `key`, `html`, `created_at` (newer schema)
 * - **Mode B**: Uses columns `type`, `html_body`, `updated_at` (older/fallback schema)
 *
 * If Mode A fails with a missing column error, automatically retries with Mode B.
 * Results are normalized to a consistent format regardless of schema used.
 *
 * @param supabase - Supabase client instance
 * @param tenantId - Optional tenant ID to filter templates (null for global templates only)
 * @returns Promise with mode used, normalized rows, and any errors
 *
 * @example
 * ```ts
 * import { supabase } from './supabase';
 * import { loadTemplatesFlex } from './templatesFlex';
 *
 * // Load all templates for a specific tenant
 * const result = await loadTemplatesFlex(supabase, 'tenant-123');
 * if (result.error) {
 *   console.error('Failed to load templates:', result.error);
 * } else {
 *   console.log(`Loaded ${result.rows.length} templates using Mode ${result.mode}`);
 *   result.rows.forEach(tpl => {
 *     console.log(`${tpl.scope} template: ${tpl.key}`);
 *   });
 * }
 *
 * // Load only global templates
 * const globalResult = await loadTemplatesFlex(supabase, null);
 * ```
 */
export async function loadTemplatesFlex(
  supabase: SupabaseClient,
  tenantId?: string | null
): Promise<LoadTemplatesResult> {
  let warning: string | undefined;
  let lastSql = '';

  const isTenantIdFalsy = !tenantId || tenantId === '';

  if (isTenantIdFalsy && tenantId !== null) {
    warning = 'Tenant ID est vide ou invalide. Chargement des templates globaux uniquement.';
    console.warn('[loadTemplatesFlex]', warning, { tenantId });
  }

  const tenantFilter = tenantId === null || isTenantIdFalsy
    ? 'tenant_id IS NULL'
    : `(tenant_id IS NULL OR tenant_id='${tenantId}')`;

  lastSql = `SELECT id, tenant_id, key, subject, html, created_at FROM email_templates WHERE ${tenantFilter} ORDER BY tenant_id ASC NULLS FIRST, created_at DESC`;

  let query = supabase
    .from('email_templates')
    .select('id, tenant_id, key, subject, html, created_at');

  if (tenantId === null || isTenantIdFalsy) {
    query = query.is('tenant_id', null);
  } else {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  }

  query = query.order('tenant_id', { ascending: true, nullsFirst: true });
  query = query.order('created_at', { ascending: false });

  const { data: dataA, error: errorA } = await query;

  if (!errorA && dataA) {
    const normalized = dataA.map(normalizeRow);
    return {
      mode: 'A',
      rows: normalized,
      lastSql,
      warning,
    };
  }

  if (!isMissingColumnError(errorA)) {
    return {
      mode: 'A',
      rows: [],
      lastSql,
      error: explainPostgrestError(errorA),
      warning,
    };
  }

  lastSql = `SELECT id, tenant_id, type, subject, html_body, updated_at FROM email_templates WHERE ${tenantFilter} ORDER BY tenant_id ASC NULLS FIRST, updated_at DESC`;

  let queryB = supabase
    .from('email_templates')
    .select('id, tenant_id, type, subject, html_body, updated_at');

  if (tenantId === null || isTenantIdFalsy) {
    queryB = queryB.is('tenant_id', null);
  } else {
    queryB = queryB.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  }

  queryB = queryB.order('tenant_id', { ascending: true, nullsFirst: true });
  queryB = queryB.order('updated_at', { ascending: false });

  const { data: dataB, error: errorB } = await queryB;

  if (errorB) {
    return {
      mode: 'B',
      rows: [],
      lastSql,
      error: explainPostgrestError(errorB),
      warning,
    };
  }

  const normalized = (dataB || []).map(normalizeRow);
  return {
    mode: 'B',
    rows: normalized,
    lastSql,
    warning,
  };
}
