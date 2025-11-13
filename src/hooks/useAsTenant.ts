import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAsTenantId } from '../lib/tenantContext';

export function useAsTenant() {
  const { profile } = useAuth();
  const [asTenantId, setAsTenantIdState] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = getAsTenantId();
    setAsTenantIdState(tenantId);
  }, []);

  const setAsTenantId = (tenantId: string | null) => {
    if (tenantId) {
      localStorage.setItem('as_tenant_id', tenantId);
      setAsTenantIdState(tenantId);
    } else {
      localStorage.removeItem('as_tenant_id');
      setAsTenantIdState(null);
    }
  };

  const clearAsTenant = () => {
    localStorage.removeItem('as_tenant_id');
    setAsTenantIdState(null);
  };

  const isMasquerading = profile?.role === 'super_admin' && !!asTenantId;

  const effectiveTenantId = asTenantId || profile?.tenant_id || null;

  return {
    asTenantId,
    isMasquerading,
    setAsTenantId,
    clearAsTenant,
    effectiveTenantId,
  };
}
