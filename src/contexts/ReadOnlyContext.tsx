import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAsTenant } from '../hooks/useAsTenant';

interface ReadOnlyContextType {
  isReadOnly: boolean;
  isLoading: boolean;
}

const ReadOnlyContext = createContext<ReadOnlyContextType | undefined>(undefined);

export function ReadOnlyProvider({ children }: { children: ReactNode }) {
  const { asTenantId } = useAsTenant();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (asTenantId) {
      checkTenantStatus(asTenantId);
    } else {
      setIsReadOnly(false);
    }
  }, [asTenantId]);

  const checkTenantStatus = async (tenantId: string) => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('tenants')
        .select('status')
        .eq('id', tenantId)
        .maybeSingle();

      setIsReadOnly(data?.status === 'inactive');
    } catch (error) {
      console.error('[ReadOnlyContext] Error checking tenant status:', error);
      setIsReadOnly(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ReadOnlyContext.Provider value={{ isReadOnly, isLoading }}>
      {children}
    </ReadOnlyContext.Provider>
  );
}

export function useReadOnly() {
  const context = useContext(ReadOnlyContext);
  if (context === undefined) {
    throw new Error('useReadOnly must be used within a ReadOnlyProvider');
  }
  return context;
}
