import { TenantBasics } from './tenantContext';

export function appendLegal(html: string, tenant: TenantBasics | null): string {
  if (!tenant) return html;

  const sig = tenant.email_signature_html ?? '';
  const rgpd = tenant.rgpd_content_md
    ? '<hr/><small>' + tenant.rgpd_content_md.replace(/\n/g, '<br/>') + '</small>'
    : '';

  return html + '<br/>' + sig + rgpd;
}
