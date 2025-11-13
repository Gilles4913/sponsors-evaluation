import { SupabaseClient } from '@supabase/supabase-js';

export interface TenantBasics {
  id: string;
  name: string;
  email_signature_html: string;
  rgpd_content_md: string;
  cgu_content_md: string;
  privacy_content_md: string;
}

export function getAsTenantId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const queryTenantId = params.get('asTenant');

  if (queryTenantId) {
    localStorage.setItem('as_tenant_id', queryTenantId);
    return queryTenantId;
  }

  const storedTenantId = localStorage.getItem('as_tenant_id');
  return storedTenantId;
}

export async function loadTenantBasics(
  supabase: SupabaseClient,
  id: string
): Promise<TenantBasics | null> {
  if (!id) return null;

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, email_signature_html, rgpd_content_md, cgu_content_md, privacy_content_md')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error loading tenant basics:', error);
    return null;
  }

  return data;
}
