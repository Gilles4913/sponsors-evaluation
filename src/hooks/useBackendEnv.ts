import { useMemo } from 'react';

interface BackendEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  backendName?: string;
  projectId: string;
  isProduction: boolean;
  isCorrectBackend: boolean;
}

const EXPECTED_PROJECT_ID = 'umjewxduvqehqzepuwby';

export function useBackendEnv(): BackendEnv {
  return useMemo(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const backendName = import.meta.env.VITE_BACKEND_NAME;

    let projectId = '';
    try {
      const url = new URL(supabaseUrl);
      const subdomain = url.hostname.split('.')[0];
      projectId = subdomain;
    } catch (e) {
      projectId = 'unknown';
    }

    const isProduction = import.meta.env.PROD;
    const isCorrectBackend = projectId === EXPECTED_PROJECT_ID;

    return {
      supabaseUrl,
      supabaseAnonKey,
      backendName,
      projectId,
      isProduction,
      isCorrectBackend,
    };
  }, []);
}
