import { supabase } from './supabase';

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const out: any = {};
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) {
      out[k as string] = obj[k];
    }
  }
  return out;
}

interface EmailTemplateForm {
  subject: string;
  key: string;
  html: string;
  text_body?: string;
}

export async function saveEmailTemplateProd(
  templateId: string,
  form: EmailTemplateForm
) {
  if (!templateId) throw new Error('templateId manquant');

  const textBody = (form.text_body ?? htmlToText(form.html || '')) || null;
  const now = new Date().toISOString();
  const userId = await getUserId();

  const payload = pick(
    {
      subject: form.subject ?? '',
      key: form.key ?? '',
      html: form.html ?? '',
      text_body: textBody,
      updated_at: now,
      updated_by: userId,
    },
    ['subject', 'key', 'html', 'text_body', 'updated_at', 'updated_by']
  );

  console.log('[saveEmailTemplateProd] Payload to send:', {
    templateId,
    payloadKeys: Object.keys(payload),
    textBodyLength: textBody?.length || 0,
    payload
  });

  const { data, error, status } = await supabase
    .from('email_templates')
    .update(payload)
    .eq('id', templateId)
    .select('id,key,subject,text_body,updated_at');

  console.log('[saveEmailTemplateProd] Response:', { data, error, status });

  if (error) {
    console.error('SAVE_TPL_ERR', { status, ...error, sentKeys: Object.keys(payload) });
    throw Object.assign(new Error(error.message), {
      status,
      details: (error as any).details,
      hint: (error as any).hint,
      code: (error as any).code,
      sentKeys: Object.keys(payload),
    });
  }

  if (!data || data.length === 0) {
    throw new Error('Aucune ligne mise à jour - vérifiez les permissions RLS');
  }

  return data[0] || data;
}
