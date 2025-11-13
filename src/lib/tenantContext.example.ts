import { supabase } from './supabase';
import { getAsTenantId, loadTenantBasics } from './tenantContext';

async function exampleUsage() {
  const asTenantId = getAsTenantId();
  console.log('Current asTenant ID:', asTenantId);

  if (asTenantId) {
    const tenantData = await loadTenantBasics(supabase, asTenantId);

    if (tenantData) {
      console.log('Tenant name:', tenantData.name);
      console.log('Email signature:', tenantData.email_signature_html);
      console.log('RGPD content:', tenantData.rgpd_content_md);
      console.log('CGU content:', tenantData.cgu_content_md);
      console.log('Privacy content:', tenantData.privacy_content_md);
    }
  }
}

export { exampleUsage };
