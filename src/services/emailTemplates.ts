import { supabase } from '../lib/supabase';

function pick<T extends object>(obj: T, keys: (keyof T)[]) {
  const out: any = {};
  for (const k of keys) if (k in obj && obj[k] !== undefined) out[k as string] = obj[k];
  return out;
}

// Export pick pour utilisation dans d'autres composants
export { pick };

export type EmailTemplateInput = {
  id?: string;               // présent = update, sinon insert
  tenant_id?: string | null; // null = global
  key: string;               // en Mode B ça mappe "type"
  subject: string;
  html: string;              // en Mode B ça mappe "html_body"
  text_body?: string | null; // optionnel
};

export type SaveResult =
  | { ok: true; id: string; mode: 'A' | 'B'; action: 'insert' | 'update' }
  | { ok: false; mode?: 'A' | 'B'; status?: number; message?: string; details?: string; hint?: string };

function isMissingColumnError(err: any) {
  const m = (err?.message || '').toLowerCase();
  return m.includes('column') && m.includes('does not exist');
}

function buildPayloadModeA(input: EmailTemplateInput) {
  // Stop-list : ne construire QUE les colonnes existantes (Mode A)
  const raw: any = {};
  if (typeof input.subject === 'string') raw.subject = input.subject;
  if (typeof input.key === 'string') raw.key = input.key;
  if (typeof input.html === 'string') raw.html = input.html;

  // Filtrer avec pick pour garantir que seules ces 3 colonnes sont envoyées
  return pick(raw, ['subject', 'key', 'html']);
}

export async function saveEmailTemplateA(id: string, input: EmailTemplateInput) {
  const payload = buildPayloadModeA(input);
  console.debug('[TEMPLATES] UPDATE payload', { id, payload });

  const q = supabase
    .from('email_templates')
    .update(payload, { returning: 'representation' })
    .eq('id', id)
    .select('id, key, subject');

  const { data, error, status } = await q;

  if (error) {
    console.error('[TEMPLATES] UPDATE error', { status, error });
    throw {
      status,
      message: error.message,
      details: error.details,
      hint: error.hint,
    };
  }
  return data?.[0];
}

export async function saveEmailTemplateMin(
  id: string,
  form: { subject: string; html: string; key: string }
) {
  // ⚠️ Stop-list : filtrer AVANT l'envoi pour n'envoyer QUE les colonnes existantes
  // Tant que DB n'a pas text_body, updated_at, updated_by, type, html_body, etc.
  const payload = pick(
    {
      subject: form.subject ?? '',
      html: form.html ?? '',
      key: form.key ?? '',
    },
    ['subject', 'html', 'key'] // <-- n'envoyer QUE ça (Mode A)
  );

  const { data, error, status } = await supabase
    .from('email_templates')
    .update(payload)
    .eq('id', id)
    .select('id, key, subject') // force "Prefer: return=representation" pour voir l'erreur
    .single();

  if (error) {
    const enrichedError = {
      ...error,
      status,
      sentKeys: Object.keys(payload),
    };
    console.error('SAVE_TPL_ERR', {
      status,
      message: error.message,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
      code: (error as any)?.code,
      sentKeys: Object.keys(payload),
    });
    throw enrichedError;
  }
  return data;
}

export async function saveEmailTemplate(input: EmailTemplateInput): Promise<SaveResult> {
  const hasId = !!input.id;
  const now = new Date().toISOString();

  // 1) UPDATE : utilise la nouvelle logique avec buildPayloadModeA
  if (hasId) {
    try {
      const result = await saveEmailTemplateA(input.id!, input);
      return { ok: true, id: result.id, mode: 'A', action: 'update' };
    } catch (err: any) {
      if (!isMissingColumnError(err)) {
        return { ok: false, mode: 'A', status: err.status, message: err.message, details: err.details, hint: err.hint };
      }
      // Si erreur de colonne manquante, essaye Mode B
    }

    // Fallback Mode B pour UPDATE
    try {
      // Stop-list : filtrer les colonnes envoyées (Mode B)
      const rawB: any = {
        subject: input.subject,
        type: input.key,
        html_body: input.html,
      };
      const payloadB = pick(rawB, ['subject', 'type', 'html_body']);

      const { data, error, status } = await supabase
        .from('email_templates')
        .update(payloadB)
        .eq('id', input.id)
        .select('id')
        .single();

      if (error) throw { ...error, status, mode: 'B' };
      return { ok: true, id: data.id, mode: 'B', action: 'update' };
    } catch (err: any) {
      return { ok: false, mode: 'B', status: err.status, message: err.message, details: err.details, hint: err.hint };
    }
  }

  // 2) INSERT : Tente Mode A (key/html)
  try {
    // Stop-list : construire le payload avec colonnes potentielles
    const rawA: any = {
      subject: input.subject,
      key: input.key,
      html: input.html,
      tenant_id: input.tenant_id ?? null,
    };
    if (input.text_body !== undefined) rawA.text_body = input.text_body;

    // Filtrer pour n'envoyer QUE les colonnes qui existent (Mode A)
    const allowedKeysA = ['subject', 'key', 'html', 'tenant_id'];
    if (input.text_body !== undefined) allowedKeysA.push('text_body');
    const payloadA = pick(rawA, allowedKeysA);

    const { data, error, status } = await supabase
      .from('email_templates')
      .insert(payloadA)
      .select('id')
      .single();

    if (error) throw { ...error, status, mode: 'A' };
    return { ok: true, id: data.id, mode: 'A', action: 'insert' };
  } catch (err: any) {
    if (!isMissingColumnError(err)) {
      return { ok: false, mode: 'A', status: err.status, message: err.message, details: err.details, hint: err.hint };
    }
  }

  // 3) Fallback Mode B pour INSERT (type/html_body)
  try {
    // Stop-list : construire le payload avec colonnes potentielles
    const rawB: any = {
      subject: input.subject,
      type: input.key,
      html_body: input.html,
      tenant_id: input.tenant_id ?? null,
    };
    if (input.text_body !== undefined) rawB.text_body = input.text_body;

    // Filtrer pour n'envoyer QUE les colonnes qui existent (Mode B)
    const allowedKeysB = ['subject', 'type', 'html_body', 'tenant_id'];
    if (input.text_body !== undefined) allowedKeysB.push('text_body');
    const payloadB = pick(rawB, allowedKeysB);

    const { data, error, status } = await supabase
      .from('email_templates')
      .insert(payloadB)
      .select('id')
      .single();

    if (error) throw { ...error, status, mode: 'B' };
    return { ok: true, id: data.id, mode: 'B', action: 'insert' };
  } catch (err: any) {
    return { ok: false, mode: 'B', status: err.status, message: err.message, details: err.details, hint: err.hint };
  }
}
